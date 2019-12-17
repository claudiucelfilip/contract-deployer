const util = require("util");
const exec = util.promisify(require("child_process").exec);
const execLive = require("child_process").exec;
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);
const { Wavelet, JSBI } = require("wavelet-client");
const path = require("path");

const DEFAULT_HOST = process.env.WAVELET_API_URL || "https://devnet.perlin.net";
const DEFAULT_PRIVATE_KEY =
  process.env.DEFAULT_PRIVATE_KEY ||
  "ba3daa36b1612a30fb0f7783f98eb508e8f045ffb042124f86281fb41aee8705e919a3626df31b6114ec79567726e9a31c600a5d192e871de1b862412ae8e4c0";

const cloneRepo = async (repo, repoRoot, branch) => {
  const repoPath = repo.replace(/#.*/, "");
  try {
    console.log("CLONE", `git clone -branch ${branch} ${repoPath} ${repoRoot}`);
    const cloneResponse = await exec(`
      cd contracts && git clone ${repoPath} ${repoRoot} && cd ${repoRoot} && git checkout ${branch}
    `);

    console.log(
      "Contract cloned: \n",
      cloneResponse.stdout,
      cloneResponse.stderr
    );
  } catch (err) {
    console.log("Clone error", err.message);
    const pullResponse = await exec(`
      cd contracts/${repoRoot} && git pull
    `);
    console.log(
      "Contract pulled: \n",
      pullResponse.stdout,
      pullResponse.stderr
    );
    if (pullResponse.stdout.includes("Already up to date.")) {
      return false;
    }
  }
  console.log("........................................");
  return true;
};

const build = async cargoPath => {
  const liveBuild = () => {
    return new Promise(resolve => {
      console.log("Build started");
      const buildProcess = execLive(
        `wasm-pack -v build ${path.resolve("contracts", cargoPath)}`
      );

      buildProcess.on("message", (msg) => {
        console.log(msg);
      });
      buildProcess.stdout.pipe(process.stdout);
      buildProcess.stderr.pipe(process.stderr);
      buildProcess.on("close", resolve);
    });
  };

  await liveBuild();

  const wasmResponse = await exec(
    `ls ${path.resolve("contracts", cargoPath, "pkg/*.wasm")}`
  );
  console.log("Contract file: \n", wasmResponse.stdout, wasmResponse.stderr);
  console.log("........................................");

  const wasmPath = wasmResponse.stdout.trim();
  console.log("........................................");

  return await readFile(wasmPath);
};

const deploy = async (
  cargoPath,
  outputPath = "",
  repo = "",
  waveletUrl = DEFAULT_HOST,
  privateKey = DEFAULT_PRIVATE_KEY,
  envVarName = ""
) => {
  if (!cargoPath) {
    throw new Error("You must specify a path to smart contract project");
  }
  const client = new Wavelet(waveletUrl);
  const wallet = Wavelet.loadWalletFromPrivateKey(privateKey);
  let codeChanged = false;

  const repoSufix = repo.replace(/.*\//, "");
  const [repoRoot, branch = "master"] = repoSufix.split("#");
  cargoPath = path.resolve("contracts", repoRoot, cargoPath);

  if (repo) {
    codeChanged = await cloneRepo(repo, repoRoot, branch);
  }

  console.log("Code Changed?", codeChanged);
  const artifactPath = path.resolve("contracts", repoRoot, "contractId");

  try {
    const deployedId = await readFile(artifactPath, "utf-8");
    if (deployedId) {
      const { id } = await client.getTransaction(deployedId);
      console.log("Contract already deployed under", id);
      return id;
    }
  } catch (_) {}

  const contractCode = await build(cargoPath);

  const { id } = await client.deployContract(
    wallet,
    toArrayBuffer(contractCode),
    JSBI.BigInt(100000)
  );
  console.log("Waiting for contract");
  await waitForDeploy(client, id);
  console.log("Contract ID: \n", id);

  if (outputPath) {
    write(outputPath, id, envVarName);
  }

  writeFile(artifactPath, id);

  return id;
};

function waitForDeploy(client, id) {
  return new Promise((resolve, reject) => {
    client.pollTransactions(
      { onTransactionApplied: resolve, onTransactionRejected: reject },
      { id, tx_id: id }
    );
  });
}
function toArrayBuffer(buffer) {
  var ab = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return ab;
}

const write = async (outputPath, contractId, envVarName = "CONTRACT_ID") => {
  if (!outputPath) {
    throw new Error("You must specify an outputPath");
  }
  if (!contractId) {
    throw new Error("You must specify an contractId");
  }

  await writeFile(outputPath, `${envVarName}=${contractId}`);
  console.log("Wrote to ", outputPath);
};
module.exports = {
  deploy,
  write,
};

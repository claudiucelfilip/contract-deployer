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

const cloneRepo = async (repo, repoRoot, branch, log) => {
  const repoPath = repo.replace(/#.*/, "");
  try {
    log("CLONE", `git clone -branch ${branch} ${repoPath} ${repoRoot}`);
    const cloneResponse = await exec(`
      cd contracts && git clone ${repoPath} ${repoRoot} && cd ${repoRoot} && git checkout ${branch}
    `);

    log("Contract cloned: \n", cloneResponse.stdout, cloneResponse.stderr);
  } catch (err) {
    log("Couldn't clone. Project already there, proably.", err.message);
    const pullResponse = await exec(`
      cd contracts/${repoRoot} && git pull
    `);
    log("Contract pulled: \n", pullResponse.stdout, pullResponse.stderr);
    if (pullResponse.stdout.includes("Already up to date.")) {
      return false;
    }
  }
  return true;
};

const build = async (contractsRoot, cargoPath, log) => {
  const liveBuild = () => {
    return new Promise(resolve => {
      log("Building contract...");
      const buildProcess = execLive(
        `wasm-pack build ${path.resolve(contractsRoot, cargoPath)}`
      );
      buildProcess.stdout.on("data", log);
      buildProcess.stdout.pipe(process.stdout);
      buildProcess.stderr.pipe(process.stderr);
      buildProcess.on("close", resolve);
    });
  };

  await liveBuild();

  const wasmResponse = await exec(
    `ls ${path.resolve(contractsRoot, cargoPath, "pkg/*.wasm")}`
  );

  const wasmPath = wasmResponse.stdout.trim();
  log("........................................");

  return await readFile(wasmPath);
};

const deploy = async (
  cargoPath,
  outputPath = "",
  repo = "",
  deposit = 0,
  envVarName = "CONTRACT_ID",
  logHandle,
  isRemote = false,
  waveletApiUrl = DEFAULT_HOST,
  privateKey = DEFAULT_PRIVATE_KEY
) => {
  const contractsRoot = isRemote ? "contracts" : ".";
  const log = (...args) => {
    console.log(...args);
    if (logHandle) {
      logHandle(...args);
    }
  };
  if (!cargoPath) {
    throw new Error("You must specify a path to smart contract project");
  }
  const client = new Wavelet(waveletApiUrl);
  const wallet = Wavelet.loadWalletFromPrivateKey(privateKey);
  let codeChanged = false;

  const repoSufix = repo.replace(/.*\//, "");
  const [repoRoot, branch = "master"] = repoSufix.split("#");
  cargoPath = path.resolve(contractsRoot, repoRoot, cargoPath);

  if (repo) {
    codeChanged = await cloneRepo(repo, repoRoot, branch, log);
  }

  log("Code Changed?", codeChanged);
  const artifactPath = path.resolve(contractsRoot, repoRoot, "contractId");

  try {
    const deployedId = await readFile(artifactPath, "utf-8");
    if (deployedId) {
      const { id } = await client.getTransaction(deployedId);
      log("Contract already deployed under", id);
      return { contractId: id, waveletApiUrl };
    }
  } catch (_) {}

  const contractCode = await build(contractsRoot, cargoPath, log);

  const { id } = await client.deployContract(
    wallet,
    toArrayBuffer(contractCode),
    100000000,
    deposit
  );

  log("Waiting for contract");
  await waitForDeploy(client, id);
  log("Contract ID: \n", id);

  if (outputPath) {
    write(outputPath, id, waveletApiUrl, envVarName);
  }

  if (isRemote) {
    writeFile(artifactPath, id);
  }

  return { contractId: id, waveletApiUrl };
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

const write = async (outputPath, contractId, waveletApiUrl, envVarName = "CONTRACT_ID") => {
  if (!outputPath) {
    throw new Error("You must specify an outputPath");
  }
  if (!contractId) {
    throw new Error("You must specify an contractId");
  }

  await writeFile(outputPath, `
    ${envVarName}=${contractId}
    REACT_APP_${envVarName}=${contractId}
    WAVELET_API_URL=${waveletApiUrl}
    REACT_APP_WAVELET_API_URL=${waveletApiUrl}   
  `);
  log("Wrote to ", outputPath);
};
module.exports = {
  deploy,
  write,
};

const util = require("util");
const exec = util.promisify(require("child_process").exec);
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);
const { Wavelet, JSBI } = require("wavelet-client");
const path = require("path");

const DEFAULT_HOST = process.env.WAVELET_API_URL || "https://devnet.perlin.net";
const DEFAULT_PRIVATE_KEY =
  process.env.DEFAULT_PRIVATE_KEY ||
  "ba3daa36b1612a30fb0f7783f98eb508e8f045ffb042124f86281fb41aee8705e919a3626df31b6114ec79567726e9a31c600a5d192e871de1b862412ae8e4c0";

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
  const repoRoot = "cargo-" + Date.now();

  if (repo) {
    const cloneResponse = await exec(`
      git clone ${repo} ${repoRoot}
    `);
    cargoPath = path.resolve(repoRoot, cargoPath);
    console.log(
      "Contract cloned: \n",
      cloneResponse.stdout,
      cloneResponse.stderr
    );
    console.log("........................................");
  }

  const lsResponse = await exec(`
  ls ${path.resolve(cargoPath)}
`);

  console.log("Contract root: \n", lsResponse.stdout);

  const buildResponse = await exec(
    `cd ${path.resolve(cargoPath)} && wasm-pack build`
  );
  console.log("Contract build: \n", buildResponse.stdout, buildResponse.stderr);
  console.log("........................................");

  const wasmResponse = await exec(
    `ls ${path.resolve(
      cargoPath,
      "pkg/*.wasm"
    )}`
  );
  console.log("Contract file: \n", wasmResponse.stdout, wasmResponse.stderr);
  console.log("........................................");

  const wasmPath = wasmResponse.stdout.trim();
  const contractCode = await readFile(wasmPath);
  console.log("........................................");

  try {
    const { id } = await client.deployContract(
      wallet,
      toArrayBuffer(contractCode),
      JSBI.BigInt(100000)
    );
    console.log("Contract ID: \n", id);

    if (outputPath) {
      write(outputPath, id, envVarName);
    }
    if (repo) {
      (async () => {
        const removeResponse = await exec(
          `rm -rf ${path.resolve(repoRoot)}`
        );
        console.log(`Repo removed: ${repoRoot} \n`, removeResponse.stdout, removeResponse.stderr);
      })(); 
    }
    return id;
  } catch (err) {
    console.error(err);
  }
};

function toArrayBuffer(buffer) {
  var ab = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return ab;
}

const write = async (outputPath, contractId, envVarName= "CONTRACT_ID") => {
  if (!outputPath) {
    throw new Error("You must specify an outputPath");
  }
  if (!contractId) {
    throw new Error("You must specify an contractId");
  }

  await writeFile(outputPath, `${envVarName} ${contractId}`);
  console.log("Wrote to ", outputPath);
};
module.exports = {
  deploy,
  write
};
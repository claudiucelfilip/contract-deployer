const util = require("util");
const exec = util.promisify(require("child_process").exec);
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);
const { Wavelet, JSBI } = require("wavelet-client");
const path = require("path");

const DEFAULT_HOST = process.env.WAVELET_API_URL || "http://localhost:9000";
const DEFAULT_PRIVATE_KEY = process.env.DEFAULT_PRIVATE_KEY || 
  "85e7450f7cf0d9cd1d1d7bf4169c2f364eea4ba833a7280e0f931a1d92fd92c2696937c2c8df35dba0169de72990b80761e51dd9e2411fa1fce147f68ade830a";

module.exports = async (
  cargoPath,
  outputPath,
  envVarName = "CONTRACT_ID",
  waveletUrl = DEFAULT_HOST,
  privateKey = DEFAULT_PRIVATE_KEY
) => {
  if (!cargoPath) {
    throw new Error("You must specify a path to the smart contract project");
  }
  const client = new Wavelet(waveletUrl);
  const wallet = Wavelet.loadWalletFromPrivateKey(privateKey);

  const buildResponse = await exec(
    `cd ${path.resolve(
      // __dirname,
      cargoPath
    )} && wasm-pack build`
  );
  console.log("Contract build: \n", buildResponse.stdout, buildResponse.stderr);

  console.log("........................................");

  const wasmResponse = await exec(
    `ls ${path.resolve(
      // __dirname,
      cargoPath,
      "pkg/*.wasm"
    )}`
  );
  console.log("Contract folder: \n", wasmResponse.stdout, wasmResponse.stderr);

  console.log("........................................");

  const wasmPath = wasmResponse.stdout.trim();
  const contractCode = await readFile(wasmPath);
  console.log("Contract: \n", contractCode, toArrayBuffer(contractCode));

  console.log("........................................");

  const { id } = await client.deployContract(
    wallet,
    toArrayBuffer(contractCode),
    JSBI.BigInt(100000)
  );
  console.log("Contract ID: \n", id);

  if (outputPath) {
    console.log("Writing to ", outputPath);
    await writeFile(outputPath, `${envVarName} ${id}`);
  }
  return id;
};

function toArrayBuffer(buffer) {
  var ab = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return ab;
}

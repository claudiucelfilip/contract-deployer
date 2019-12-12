const util = require("util");
const exec = util.promisify(require("child_process").exec);
const readFile = util.promisify(require("fs").readFile);
const { Wavelet, JSBI } = require("wavelet-client");
const path = require("path");

export default deploy = async (waveletUrl, privateKey, cargoPath) => {
  const client = new Wavelet(waveletUrl);
  const wallet = Wavelet.loadWalletFromPrivateKey(privateKey);

  const buildResponse = await exec(
    `cd ${path.resolve(
      __dirname,
      cargoPath
    )} && cargo build --release --target wasm32-unknown-unknown`
  );
  console.log("Contract build: \n", buildResponse.stdout, buildResponse.stderr);

  console.log("........................................");

  const wasmResponse = await exec(
    `ls ${path.resolve(
      __dirname,
      cargoPath,
      "target/wasm32-unknown-unknown/release/*.wasm"
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
    toArrayBuffer(res3),
    JSBI.BigInt(100000)
  );
  console.log("Contract ID: \n", id);

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

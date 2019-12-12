const util = require("util");
const exec = util.promisify(require("child_process").exec);
const readFile = util.promisify(require("fs").readFile);
const { Wavelet, JSBI } = require("wavelet-client");
const path = require("path");
(async () => {
  const client = new Wavelet("http://localhost:9000");
  const wallet = Wavelet.loadWalletFromPrivateKey(
    "87a6813c3b4cf534b6ae82db9b1409fa7dbd5c13dba5858970b56084c4a930eb400056ee68a7cc2695222df05ea76875bc27ec6e61e8e62317c336157019c405"
  );

  try {
    const res1 = await exec(
      "cd .. && cargo build --release --target wasm32-unknown-unknown"
    );
    console.log("Contract build: \n", res1.stdout, res1.stderr);

    console.log("");

    const res2 = await exec(
      "ls ../target/wasm32-unknown-unknown/release/*.wasm"
    );
    console.log("Contract folder: \n", res2.stdout, res2.stderr);

    console.log("");

    const res3 = await readFile(res2.stdout.trim());
    console.log("Contract: \n", res3, toArrayBuffer(res3));

    console.log("");

    const {id} = await client.deployContract(wallet, toArrayBuffer(res3), JSBI.BigInt(100000));
    console.log("Contract ID: \n", id);
  } catch (err) {
    console.error(err);
  }
})();


function toArrayBuffer(buffer) {
  var ab = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
  }
  return ab;
}
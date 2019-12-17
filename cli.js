#!/usr/bin/env node
const util = require("util");
const { deploy } = require("./deploy");
const { argv } = require("yargs");
const exec = require("child_process").exec;
const socketClient = require("socket.io-client");
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);

let repo = "";
let template = "";
const envVarName = argv.envVarName || "CONTRACT_ID";

if (argv.repo) {
  repo = argv.repo.replace(/^(?!https:\/\/github.com)/g, "https://github.com/");
}

console.log(repo);

const postDeploy = (contractId, waveletApiUrl) => {
  if (argv.postDeploy) {
    console.log("Processing post deploy command:", argv.postDeploy);
    console.log("Using", envVarName, contractId);
    const env = {
      ...process.env,
      [envVarName]: contractId,
      ["REACT_APP_" + envVarName]: contractId,
      WAVELET_API_URL: process.env.WAVELET_API_URL || waveletApiUrl,
      REACT_APP_WAVELET_API_URL: process.env.WAVELET_API_URL || waveletApiUrl,
    };
    
    const postDeployProcess = exec(argv.postDeploy, {
      env,
    });

    postDeployProcess.stdout.pipe(process.stdout);
    postDeployProcess.stderr.pipe(process.stderr);
  }
};
const localDeploy = async () => {
  console.log("Starting local deploy");

  const { contractId, waveletApiUrl } = await deploy(
    argv.cargoPath,
    argv.outputPath,
    repo,
    argv.deposit
  );
  postDeploy(contractId, waveletApiUrl);
};

const remoteDeploy = async () => {
  if (argv.outputTemplate) {
    template = await readFile(argv.outputTemplate, "utf8");
    console.log(template);
  }
  console.log("Starting remote deploy");

  if (!argv.repo) {
    throw new Error("Repo is needed for remote deploys");
  }
  const socket = socketClient(argv.remote);
  socket.emit("deploy-contract", {
    cargoPath: argv.cargoPath,
    repo,
    deposit: argv.deposit,
    envVarName,
    waveletApiUrl: process.env.WAVELET_API_URL,
    privateKey: process.env.DEFAULT_PRIVATE_KEY
  });

  socket.on("log", args => {
    console.log(...args);
  });
  socket.on("deployed-contract", async body => {
    const { contractId, waveletApiUrl } = body;

    if (template) {
      const regexp = new RegExp(`{{${envVarName}}}`, "g");
      let output = template
        .replace(regexp, contractId)
        .replace(/{{WAVELET_API_URL}}/, waveletApiUrl);
      const outputPath = argv.outputTemplate.replace(/\.template/, "");
      await writeFile(outputPath, output);
      console.log("wrote to", outputPath);
    }
    socket.close();

    postDeploy(contractId, waveletApiUrl);
  });

  socket.on("deployment-failed", err => {
    console.error(err.message);
    socket.close();
  });
  socket.on("error", err => {
    console.error(err);
    socket.close();
  });

  socket.on("disconnect", () => {
    console.log("Connection closed");
    socket.close();
  });
};

if (argv.remote) {
  remoteDeploy();
} else {
  localDeploy();
}

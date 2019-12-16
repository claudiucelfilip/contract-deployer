#!/usr/bin/env node
const { deploy, write } = require("./deploy");
const { argv } = require("yargs");
const request = require("request");
const socketClient = require("socket.io-client");

let repo = "";

if (argv.repo) {
  repo = argv.repo.replace(/^(?!https:\/\/github.com)/g, "https://github.com/");
}
console.log(repo);

const localDeploy = () => {
  console.log("Starting local deploy");

  deploy(argv.cargoPath, argv.outputPath, repo);
};

const remoteDeploy = async () => {
  console.log("Starting remote deploy");

  if (!argv.repo) {
    throw new Error("Repo is needed for remote deploys");
  }
  const socket = socketClient(argv.remote);
  console.log("connect socket");
  socket.emit("deploy-contract", {
    cargoPath: argv.cargoPath,
    repo,
  });

  socket.on("deployed-contract", body => {
    const { result: contractId } = body;

    if (argv.outputPath) {
      write(argv.outputPath, contractId, argv.envVarName);
    }
    socket.close();
  });
};

if (argv.remote) {
  remoteDeploy();
} else {
  localDeploy();
}

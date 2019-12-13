#!/usr/bin/env node
const { deploy, write } = require("./deploy");
const { argv } = require("yargs");
const axios = require("axios");

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
  const { data } = await axios.post(argv.remote + "/deploy-contract", {
    cargoPath: argv.cargoPath,
    repo,
  });
  const { result: contractId } = data;
  console.log("Remote deployed: ", contractId);
  if (argv.outputPath) {
    write(argv.outputPath, contractId, argv.envVarName);
  }
};

if (argv.remote) {
  remoteDeploy();
} else {
  localDeploy();
}

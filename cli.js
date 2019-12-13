#!/usr/bin/env node
const { deploy, write } = require("./deploy");
const { argv } = require("yargs");
const request = require("request");

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
  request.post(
    argv.remote + "/deploy-contract",
    {
      json: {
        cargoPath: argv.cargoPath,
        repo,
      },
      timeout: 999999
    },
    (error, res, body) => {
        console.log("Remote deployed: ", body);
      const { result: contractId } = body;
      
      if (argv.outputPath) {
        write(argv.outputPath, contractId, argv.envVarName);
      }
    }
  );
};

if (argv.remote) {
  remoteDeploy();
} else {
  localDeploy();
}

#!/usr/bin/env node
const util = require("util");
const { deploy, write } = require("./deploy");
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

const postDeploy = (contractId) => {
  if (argv.postDeploy) {
    console.log("Processing post deploy command:", argv.postDeploy);
    console.log("Using", envVarName, contractId);
    const env = {
      ...process.env,
      [envVarName]: contractId,
    };
    console.log("env", env);
    const postDeployResponse = exec(argv.postDeploy, {
      env
    });

    postDeployResponse.stdout.pipe(process.stdout);
    postDeployResponse.stderr.pipe(process.stderr);
  }
}
const localDeploy = async () => {
  console.log("Starting local deploy");

  const contractId =  await deploy(argv.cargoPath, argv.outputPath, repo);
  postDeploy(contractId);
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
  console.log("connect socket");
  socket.emit("deploy-contract", {
    cargoPath: argv.cargoPath,
    repo,
  });

  socket.on("deployed-contract", async body => {
    const { result: contractId } = body;

    if (template) {
      const regexp = new RegExp(`{{${envVarName}}}`, "g");
      const output = template.replace(regexp, contractId);
      const outputPath = argv.outputTemplate.replace(/\.template/, "");
      await writeFile(outputPath, output);
      console.log("wrote to", outputPath);
    }
    socket.close();

    postDeploy(contractId);
  });
};

if (argv.remote) {
  remoteDeploy();
} else {
  localDeploy();
}

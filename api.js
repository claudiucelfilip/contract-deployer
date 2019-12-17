const express = require("express");
const app = express();
const port = process.env.PORT || 3011;
const bodyParser = require("body-parser");
const { deploy } = require("./deploy");
const socketServer = require("socket.io");

module.exports = (...args) => {
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  const server = require("http").createServer(app);
  const io = socketServer(server);

  io.on("connection", socket => {
    console.log("new connection");
    const logHandler = (...args) => {
      socket.emit("log", args);
    };
    socket.on("deploy-contract", async body => {
      console.log("deploy-contract", body);

      try {
        const result = await deploy(body.cargoPath, null, body.repo, body.deposit, body.envVarName, logHandler, true, body.waveletApiUrl, body.privateKey);
        socket.emit("deployed-contract", result);
      } catch (err) {
        console.error(err.message);
        socket.emit("deployment-failed", err);
      }
      
      
    });
  });

  server.listen(port, () =>
    console.log(`Example app listening on ports ${port}!`)
  );
};

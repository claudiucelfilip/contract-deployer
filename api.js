const express = require("express");
const app = express();
const port = process.env.PORT || 3011;
const bodyParser = require("body-parser");
const { deploy } = require("./deploy");

module.exports = (...args) => {
  app.use(bodyParser.json());
  app.post("/deploy-contract", async (req, res) => {
    body = req.body;
    const contractId = await deploy(body.cargoPath, null, body.repo);
    res.send({
      result: contractId,
    });
  });
  // parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: false }));

  // parse application/json
  app.use(bodyParser.json());
  app.listen(port, () =>
    console.log(`Example app listening on ports ${port}!`)
  );
};

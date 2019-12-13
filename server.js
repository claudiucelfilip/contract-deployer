const { runApi } = require(".");

const [, , ...args] = process.argv;

runApi(...args);

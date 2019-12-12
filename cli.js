#!/usr/bin/env node
const deploy = require("./index");

const [, , ...args] = process.argv;

console.log("Hello world", deploy(...args));

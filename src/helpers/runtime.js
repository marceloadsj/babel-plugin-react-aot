const fs = require("fs");
const { parse } = require("@babel/parser");

function injectRuntimeFns(body, runtimeFns) {
  Object.keys(runtimeFns).forEach(key => {
    if (runtimeFns[key]) {
      runtimeFns[key] = false;

      body.push(
        parse(fs.readFileSync(`${__dirname}/../runtime/${key}.js`).toString())
      );
    }
  });
}

module.exports = { injectRuntimeFns };

console.log("Starting");

const babel = require("@babel/core");
const fs = require("fs");

const plugin = require("./src/index");

console.log("Loading the File");

const code = fs.readFileSync(`${__dirname}/in.js`).toString();

console.log("Transforming the Code");

const transformedCode = babel.transform(code, {
  plugins: ["@babel/plugin-transform-react-jsx", plugin]
  // plugins: ["@babel/plugin-transform-react-jsx"]
}).code;

console.log("Saving the Result");

fs.writeFileSync(`${__dirname}/out.js`, transformedCode);

console.log("Finished");

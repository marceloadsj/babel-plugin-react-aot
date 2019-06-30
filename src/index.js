const fs = require("fs");
const t = require("@babel/core").types;
const { parse } = require("@babel/parser");

const stateVarNames = {};
const varNamesCount = {};
const runtimeFns = {};

function getVarName(argument) {
  const tag = argument.value;

  if (!varNamesCount[tag]) varNamesCount[tag] = 0;
  varNamesCount[tag]++;

  return `${tag}${varNamesCount[tag]}`;
}

function isReactCreateElement(node) {
  if (
    node &&
    node.callee &&
    node.callee.object &&
    node.callee.property &&
    node.callee.object.name === "React" &&
    node.callee.property.name === "createElement"
  ) {
    return true;
  }

  return false;
}

function isReactCreateElementArgument(node) {
  if (isReactCreateElement(node)) return true;

  return false;
}

function isReactUseState(node) {
  if (
    node &&
    node.callee &&
    node.callee.object &&
    node.callee.property &&
    node.callee.object.name === "React" &&
    node.callee.property.name === "useState"
  ) {
    return true;
  }

  return false;
}

function isReactUseEffect(node) {
  if (
    node &&
    node.callee &&
    node.callee.object &&
    node.callee.property &&
    node.callee.object.name === "React" &&
    node.callee.property.name === "useEffect"
  ) {
    return true;
  }

  return false;
}

function createReactElement(node, isChild) {
  node.callee = node.callee.property;

  const varNames = [];
  let varName;

  node.arguments = node.arguments.map((argument, index) => {
    if (index === 0 && isChild) {
      varName = getVarName(argument);
      varNames.push(varName);
    } else if (index > 1) {
      if (
        argument.type === "StringLiteral" ||
        argument.type === "Identifier" ||
        argument.type === "BinaryExpression"
      ) {
        const childVarName = getVarName({ value: "text" });

        let stateVarName;
        if (argument.type === "Identifier") {
          stateVarName = argument.name;
        } else if (argument.type === "BinaryExpression") {
          // TODO: recursively check left and right args
          stateVarName = argument.left.name;
        }

        if (stateVarNames[stateVarName]) {
          stateVarNames[stateVarName].push(
            t.ExpressionStatement(
              t.AssignmentExpression(
                "=",
                t.MemberExpression(
                  t.Identifier(childVarName),
                  t.Identifier("data")
                ),
                argument
              )
            )
          );
        }

        runtimeFns.createTextNode = true;

        varNames.push(childVarName);

        let value;
        if (argument.type === "StringLiteral") {
          value = t.StringLiteral(argument.value);
        } else {
          value = argument;
        }

        return t.AssignmentExpression(
          "=",
          t.Identifier(childVarName),
          t.CallExpression(t.Identifier("createTextNode"), [value])
        );
      } else if (argument.type === "CallExpression") {
        if (isReactCreateElement(argument)) {
          const [childVarNames, childVarName] = createReactElement(
            argument,
            true
          );

          varNames.push(...childVarNames);

          return t.AssignmentExpression(
            "=",
            t.Identifier(childVarName),
            argument
          );
        }
      }
    }

    return argument;
  });

  return [varNames, varName];
}

function createVarDeclaration(path, varNames) {
  path
    .getStatementParent()
    .insertBefore(
      t.VariableDeclaration(
        "let",
        varNames.map(name => t.VariableDeclarator(t.Identifier(name)))
      )
    );
}

function createRuntimeFn(body, fnName) {
  body.push(
    parse(fs.readFileSync(`${__dirname}/runtime/${fnName}.js`).toString())
  );
}

function CallExpressionExit(path) {
  if (
    isReactCreateElement(path.node) &&
    !isReactCreateElementArgument(path.parentPath.node)
  ) {
    if (path.container.type === "VariableDeclarator") {
      runtimeFns.createElement = true;

      const [varNames] = createReactElement(path.node);

      createVarDeclaration(path, varNames);
    } else if (path.container.type === "ReturnStatement") {
      runtimeFns.createElement = true;

      const [varNames, varName] = createReactElement(path.node, true);

      createVarDeclaration(path, varNames);

      path.parentPath.replaceWith(
        t.AssignmentExpression("=", t.Identifier(varName), path.node)
      );

      path.parentPath.insertAfter(t.ReturnStatement(t.Identifier(varName)));
    }
  } else if (isReactUseState(path.node)) {
    runtimeFns.useState = true;

    const varName = path.getStatementParent().node.declarations[0].id
      .elements[0].name;

    stateVarNames[varName] = [];

    path.node.callee = t.CallExpression(path.node.callee.property, [
      t.ArrowFunctionExpression(
        [],
        t.MemberExpression(t.Identifier("update"), t.Identifier(varName)),
        false
      )
    ]);
  } else if (isReactUseEffect(path.node)) {
    runtimeFns.useEffect = true;

    path.node.callee = path.node.callee.property;
  }
}

function ProgramExit(path) {
  const { body } = path.node;

  if (runtimeFns.createElement) {
    runtimeFns.createElement = false;

    createRuntimeFn(body, "createElement");
  }

  if (runtimeFns.createTextNode) {
    runtimeFns.createTextNode = false;

    createRuntimeFn(body, "createTextNode");
  }

  if (runtimeFns.useState) {
    runtimeFns.useState = false;

    createRuntimeFn(body, "useState");
  }

  if (runtimeFns.useEffect) {
    runtimeFns.useEffect = false;

    createRuntimeFn(body, "useEffect");
  }

  // TODO: only used in development
  body.push(parse("document.body.appendChild(Component())"));
}

function FunctionDeclarationExit(path) {
  const { body } = path.node.body;

  if (runtimeFns.useState) {
    body.unshift(parse("const update = {};"));
  }

  const returnStatement = body[body.length - 1];
  delete body[body.length - 1];

  Object.entries(stateVarNames).map(([varName, expressions]) => {
    body.push(
      t.AssignmentExpression(
        "=",
        t.MemberExpression(t.Identifier("update"), t.Identifier(varName)),
        t.ArrowFunctionExpression(
          [t.Identifier(varName)],
          t.BlockStatement(expressions, []),
          false
        )
      )
    );
  });

  body.push(returnStatement);
}

module.exports = () => ({
  name: "react-aot",
  visitor: {
    CallExpression: { exit: CallExpressionExit },
    FunctionDeclaration: { exit: FunctionDeclarationExit },
    Program: { exit: ProgramExit }
  }
});

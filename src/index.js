const fs = require("fs");
const t = require("@babel/core").types;
const { parse } = require("@babel/parser");

const stateVarNames = {
  global: []
};
const varNamesCount = {};
const runtimeFns = {};

const updateId = t.Identifier("u");

function getVarName(argument) {
  const tag = argument.value;

  if (!varNamesCount[tag]) varNamesCount[tag] = 0;
  varNamesCount[tag]++;

  return `${tag}${varNamesCount[tag]}`;
}

function isReactFnName(node, name) {
  return (
    node.callee &&
    ((node.callee.name && node.callee.name === name) ||
      (node.callee.object &&
        node.callee.property &&
        node.callee.object.name === "React" &&
        node.callee.property.name === name))
  );
}

function isReactCreateElement(node) {
  return isReactFnName(node, "createElement");
}

function isReactUseState(node) {
  return isReactFnName(node, "useState");
}

function isReactUseEffect(node) {
  return isReactFnName(node, "useEffect");
}

function createReactElement(node, isChild) {
  node.callee = t.Identifier("ce");

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
          t.CallExpression(t.Identifier("ctn"), [value])
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
  // If is a React.createElement call not inside another React.createElement
  if (
    isReactCreateElement(path.node) &&
    !isReactCreateElement(path.parentPath.node)
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

    if (path.getFunctionParent().node.id.name.startsWith("use")) {
      path.node.callee = t.CallExpression(t.Identifier("us"), [updateId]);
    } else {
      // TODO: for now we accept only const [x, y] = ... approach
      const varName = path.getStatementParent().node.declarations[0].id
        .elements[0].name;

      stateVarNames[varName] = stateVarNames[varName] || [];

      path.node.callee = t.CallExpression(t.Identifier("us"), [
        t.ArrowFunctionExpression(
          [],
          t.MemberExpression(updateId, t.Identifier(varName)),
          false
        )
      ]);
    }
  } else if (isReactUseEffect(path.node)) {
    runtimeFns.useEffect = true;

    const varName = getVarName({ value: "effect" });

    path.node.callee = t.CallExpression(t.Identifier("ue"), []);

    path.parentPath.replaceWith(
      t.VariableDeclaration("const", [
        t.VariableDeclarator(t.Identifier(varName), path.node)
      ])
    );

    stateVarNames.global.push(
      t.ExpressionStatement(t.CallExpression(t.Identifier(varName), []))
    );

    // TODO: check how can we do to run useEffect again
  } else if (path.node.calee && path.node.callee.name.startsWith("use")) {
    // TODO: for now we accept only const [x, y] = ... approach
    const varName = path.getStatementParent().node.declarations[0].id.name;

    stateVarNames[varName] = [];

    path.node.callee = t.CallExpression(path.node.callee, [
      t.ArrowFunctionExpression(
        [],
        t.MemberExpression(updateId, t.Identifier(varName)),
        false
      )
    ]);
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
  // If the fn starts with uppercase, it's a component
  if (path.node.id.name[0] === path.node.id.name[0].toUpperCase()) {
    const { body } = path.node.body;

    if (runtimeFns.useState) {
      body.unshift(parse("const u = {};"));
    }

    const returnStatement = body[body.length - 1];
    delete body[body.length - 1];

    Object.entries(stateVarNames).forEach(([varName, expressions]) => {
      if (varName !== "global") {
        body.push(
          t.AssignmentExpression(
            "=",
            t.MemberExpression(updateId, t.Identifier(varName)),
            t.ArrowFunctionExpression(
              [t.Identifier(varName)],
              t.BlockStatement([...expressions, ...stateVarNames.global], []),
              false
            )
          )
        );
      }
    });

    body.push(returnStatement);
  } else if (path.node.id.name.startsWith("use")) {
    path.node.body.body = [
      t.ReturnStatement(
        t.ArrowFunctionExpression(
          path.node.params,
          t.BlockStatement(path.node.body.body, []),
          false
        )
      )
    ];

    path.node.params = [updateId];
  }
}

module.exports = () => ({
  name: "react-aot",
  visitor: {
    CallExpression: { exit: CallExpressionExit },
    FunctionDeclaration: { exit: FunctionDeclarationExit },
    Program: { exit: ProgramExit }
  }
});

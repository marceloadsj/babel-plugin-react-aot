const t = require("@babel/core").types;

const {
  renderId,
  updateId,
  createElementId,
  useStateId,
  useEffectId
} = require("./helpers/ids");

const { injectRuntimeFns } = require("./helpers/runtime");

const {
  isReactCreateElement,
  isReactUseState,
  isReactUseEffect,
  isReactDomRender
} = require("./helpers/reactFilters");

const stateVarNames = { global: [] };
const runtimeFns = {};
const varNamesCount = {};

function getVarName(argument) {
  const tag = argument.value;

  if (!varNamesCount[tag]) varNamesCount[tag] = 0;
  varNamesCount[tag]++;

  return `_${tag}${varNamesCount[tag]}`;
}

function createVarDeclaration(path, name) {
  path
    .getStatementParent()
    .insertBefore(
      t.VariableDeclaration("let", [t.VariableDeclarator(t.Identifier(name))])
    );
}

// ---

function FunctionDeclarationExit(path) {
  // If the fn starts with uppercase, it's a component
  if (path.node.id.name[0] === path.node.id.name[0].toUpperCase()) {
    if (stateVarNames[path.node.id.name]) {
      const { body } = path.node.body;

      if (runtimeFns.useState) {
        body.unshift(
          t.VariableDeclaration("const", [
            t.VariableDeclarator(updateId, t.ObjectExpression([]))
          ])
        );
      }

      const returnStatement = body[body.length - 1];
      delete body[body.length - 1];

      Object.entries(stateVarNames[path.node.id.name]).forEach(
        ([varName, expressions]) => {
          if (varName !== "global") {
            body.push(
              t.AssignmentExpression(
                "=",
                t.MemberExpression(updateId, t.Identifier(varName)),
                t.ArrowFunctionExpression(
                  [t.Identifier(varName)],
                  t.BlockStatement(
                    [...expressions, ...stateVarNames.global],
                    []
                  ),
                  false
                )
              )
            );
          }
        }
      );
      body.push(returnStatement);
    }
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

function CallExpressionExit(path) {
  if (isReactDomRender(path.node)) {
    runtimeFns.render = true;
    path.node.callee = renderId;
  } else if (
    isReactCreateElement(path.node) &&
    !isReactCreateElement(path.parentPath.node)
  ) {
    runtimeFns.createElement = true;
    path.node.callee = createElementId;

    if (path.container.type === "ReturnStatement") {
      const varName = getVarName(path.node.arguments[0]);

      createVarDeclaration(path, varName);

      path.parentPath.replaceWith(
        t.ReturnStatement(
          t.AssignmentExpression("=", t.Identifier(varName), path.node)
        )
      );

      if (path.getFunctionParent()) {
        const parentName = path.getFunctionParent().node.id.name;

        path.node.arguments.forEach((argument, index) => {
          if (index > 1) {
            if (argument.type === "Identifier") {
              if (
                stateVarNames[parentName] &&
                stateVarNames[parentName][argument.name]
              ) {
                stateVarNames[parentName][argument.name].push(
                  t.ExpressionStatement(
                    t.CallExpression(
                      t.Identifier(`${varName}.children[${index - 2}].setData`),
                      [t.Identifier(argument.name)]
                    )
                  )
                );
              }
            } else if (argument.type === "LogicalExpression") {
              if (
                argument.left.type === "Identifier" &&
                stateVarNames[parentName][argument.left.name]
              ) {
                stateVarNames[parentName][argument.left.name].push(
                  t.ExpressionStatement(
                    t.CallExpression(
                      t.Identifier(
                        `${varName}.children[${index - 2}].replaceWith`
                      ),
                      [argument]
                    )
                  )
                );
              }
            }
          }
        });
      }
    }
  } else if (isReactUseState(path.node)) {
    runtimeFns.useState = true;

    if (path.getFunctionParent().node.id.name.startsWith("use")) {
      path.node.callee = t.CallExpression(useStateId, [updateId]);
    } else {
      // TODO: for now we accept only const [x, y] = ... approach
      const varName = path.getStatementParent().node.declarations[0].id
        .elements[0].name;

      const parentName = path.getFunctionParent().node.id.name;

      stateVarNames[parentName] = stateVarNames[parentName] || {};
      stateVarNames[parentName][varName] =
        stateVarNames[parentName][varName] || [];

      path.node.callee = t.CallExpression(useStateId, [
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

    path.node.callee = t.CallExpression(useEffectId, []);

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
  injectRuntimeFns(path.node.body, runtimeFns);
}

module.exports = () => ({
  name: "react-aot",
  visitor: {
    CallExpression: { exit: CallExpressionExit },
    FunctionDeclaration: { exit: FunctionDeclarationExit },
    Program: { exit: ProgramExit }
  }
});

function isObjectFnName(object, name, node) {
  return (
    node.callee &&
    ((node.callee.name && node.callee.name === name) ||
      (node.callee.object &&
        node.callee.property &&
        node.callee.object.name === object &&
        node.callee.property.name === name))
  );
}

function isReactFnName(name, node) {
  return isObjectFnName("React", name, node);
}

function isReactCreateElement(node) {
  return isReactFnName("createElement", node);
}

function isReactUseState(node) {
  return isReactFnName("useState", node);
}

function isReactUseEffect(node) {
  return isReactFnName("useEffect", node);
}

function isReactDomFnName(name, node) {
  return isObjectFnName("ReactDOM", name, node);
}

function isReactDomRender(node) {
  return isReactDomFnName("render", node);
}

module.exports = {
  isReactCreateElement,
  isReactUseState,
  isReactUseEffect,
  isReactDomRender
};

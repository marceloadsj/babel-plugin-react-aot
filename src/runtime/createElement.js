function _createElement(type, props, ...children) {
  const element = { type };

  element.render = () => {
    if (typeof type === "function") {
      element.component = type({ ...props, children });
    } else {
      try {
        element.component = document.createElement(type);

        element.children = _createChildren(children, element);

        if (props) {
          Object.entries(props).forEach(([key, value]) => {
            element.component[key.toLowerCase()] = value;
          });
        }
      } catch (error) {
        console.log(error);

        element.component = document.createTextNode(type);
      }
    }

    return element.component;
  };

  return element;
}

function _createChildren(children, element) {
  const elements = [];

  children.forEach(child => {
    if (Array.isArray(child)) {
      elements.push(_createChildren(child, element));
    } else {
      const childElement = _createChildElement(child);

      elements.push(childElement);

      if (childElement.component) {
        element.component.appendChild(childElement.component);
      }
    }
  });

  return elements;
}

function _createChildElement(child) {
  const element = {
    replaceWith(newChild) {
      const childElement = _createChildElement(newChild);

      element.component.replaceWith(childElement.component);
      element.component = childElement.component;
    },

    setData(data) {
      element.component.data = data;
    }
  };

  if (typeof child === "number" || typeof child === "string") {
    element.component = document.createTextNode(child);
  } else if (child && typeof child === "object" && child.render) {
    let component = child.render();

    if (component.render) component = component.render();
    element.component = component;
  } else {
    element.component = document.createTextNode("");
  }

  return element;
}

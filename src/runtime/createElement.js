function createElement(tag, props, ...children) {
  const element = document.createElement(tag);

  children
    .filter(child => typeof child === "object")
    .forEach(child => {
      element.appendChild(child);
    });

  return element;
}

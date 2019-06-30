function ce(tag, props, ...children) {
  const element = document.createElement(tag);

  children
    .filter(child => typeof child === "object")
    .forEach(child => {
      element.appendChild(child);
    });

  if (props) {
    if (props.onClick) {
      element.onclick = props.onClick;
    }
  }

  return element;
}

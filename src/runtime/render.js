function _render(element, container) {
  const component = element.render();

  if (component.render) {
    _render(component, container);
  } else {
    container.appendChild(component);
  }
}

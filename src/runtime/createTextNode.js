function ctn(value) {
  if (typeof value !== "object") return document.createTextNode(value);

  return value;
}

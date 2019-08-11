function _useEffect(...arguments) {
  return callback => {
    setTimeout(() => callback(...arguments));
    return callback;
  };
}

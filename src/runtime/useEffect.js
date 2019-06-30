function ue(...arguments) {
  return callback => {
    setTimeout(() => callback(...arguments));
    return callback;
  };
}

function useState(update) {
  return initialState => {
    let state = initialState;

    return [
      state,
      newState => {
        if (typeof newState === "function") {
          state = newState(state);
        } else {
          state = newState;
        }

        update()(state);
      }
    ];
  };
}

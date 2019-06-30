function us(update) {
  return initialState => {
    let state = initialState;

    if (typeof initialState === "function") {
      state = initialState();
    }

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

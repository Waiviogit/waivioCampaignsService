exports.parseJson = (json, onErrorResponse = {}) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    return onErrorResponse;
  }
};

const t = require("@babel/core").types;

const updateId = t.Identifier("_update");
const renderId = t.Identifier("_render");
const createElementId = t.Identifier("_createElement");
const useStateId = t.Identifier("_useState");
const useEffectId = t.Identifier("_useEffect");

module.exports = {
  renderId,
  updateId,
  createElementId,
  useStateId,
  useEffectId
};

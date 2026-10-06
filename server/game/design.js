const defaults = require('./config')
const fields = Object.freeze(['speed', 'armor', 'attack', 'vision', 'cargo', 'communication', 'cpu', 'energy'])

function validateDesign(design = {}, config = defaults) {
  if (!design || typeof design !== 'object' || Array.isArray(design)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(design))) throw new Error('Design must be a dictionary')
  if (Object.keys(design).some(key => !fields.includes(key))) throw new Error('Unknown design parameter')
  const result = { ...config.designDefaults, ...design }
  for (const field of fields) {
    if (!Number.isSafeInteger(result[field]) || result[field] < 0) throw new Error('Design points must be non-negative integers')
  }
  if (Object.values(result).reduce((sum, value) => sum + value, 0) > config.designPoints) throw new Error('Design point budget exceeded')
  return Object.freeze(result)
}

function designCost(design, config) {
  const cost = { ...config.spawnCost }
  for (const field of fields) {
    cost.metal += design[field] * config.designCostMetal[field]
    cost.energy += design[field] * config.designCostEnergy[field]
    cost.silicon += design[field] * config.designCostSilicon[field]
  }
  return cost
}

module.exports = { fields, validateDesign, designCost }

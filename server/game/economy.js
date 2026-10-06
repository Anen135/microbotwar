const resourceTypes = Object.freeze(['metal', 'energy', 'silicon'])
const emptyStock = () => ({ metal: 0, energy: 0, silicon: 0 })
const cargoTotal = cargo => resourceTypes.reduce((sum, type) => sum + cargo[type], 0)

module.exports = { resourceTypes, emptyStock, cargoTotal }

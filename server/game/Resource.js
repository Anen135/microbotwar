const { randomUUID } = require('node:crypto')
const defaults = require('./config')
const { resourceTypes } = require('./economy')

class Resource {
  constructor({ x, y, amount = defaults.resourceAmount, resourceType = 'metal' }) {
    if (!resourceTypes.includes(resourceType) || !Number.isFinite(x) || !Number.isFinite(y)
      || !Number.isFinite(amount) || amount < 0) throw new Error('Invalid resource')
    this.id = randomUUID()
    this.x = x
    this.y = y
    this.amount = amount
    this.resourceType = resourceType
  }
}

module.exports = Resource

const { randomUUID } = require('node:crypto')
const defaults = require('./config')

class Resource {
  constructor({ x, y, amount = defaults.resourceAmount }) {
    this.id = randomUUID()
    this.x = x
    this.y = y
    this.amount = amount
  }
}

module.exports = Resource

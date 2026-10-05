const { randomUUID } = require('node:crypto')
const defaults = require('./config')

class Base {
  constructor({ ownerId, x, y, config = defaults }) {
    this.id = randomUUID()
    this.ownerId = ownerId
    this.x = x
    this.y = y
    this.hp = config.baseHp
    this.maxHp = config.baseHp
  }
}

module.exports = Base

const { randomUUID } = require('node:crypto')
const defaults = require('./config')

class Player {
  constructor({ name, color, config = defaults }) {
    this.id = randomUUID()
    this.name = name
    this.color = color
    this.resources = config.startingResources
    this.alive = true
    this.control = 'manual'
    this.program = null
    this.source = ''
    this.error = null
    this.cpu = 0
  }
}

module.exports = Player

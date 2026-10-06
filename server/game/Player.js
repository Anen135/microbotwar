const { randomUUID } = require('node:crypto')
const defaults = require('./config')
const { ProgramRegistry } = require('../scripting/ProgramRegistry')
const { compile } = require('../scripting/Interpreter')

class Player {
  constructor({ name, color, config = defaults }) {
    this.id = randomUUID()
    this.name = name
    this.color = color
    this.resources = { ...config.startingResources }
    this.alive = true
    this.control = 'manual'
    this.programs = new ProgramRegistry(config)
    this.debug = null
    this.baseProgram = compile('')
    this.baseSource = ''
    this.source = ''
    this.error = null
    this.cpu = 0
  }
}

module.exports = Player

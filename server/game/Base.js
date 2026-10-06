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
    this.visionRange = config.baseVisionRange
    this.communicationRange = config.baseCommunicationRange
    this.inbox = []
    this.memory = Object.create(null)
    this.tags = Object.create(null)
    this.maxEnergy = config.baseEnergy
    this.energy = this.maxEnergy
    this.cpuBudget = config.baseCpuBudget
    this.cpu = 0
    this.limited = false
    this.needsSpawn = true
    this.damageEvents = []
  }
}

module.exports = Base

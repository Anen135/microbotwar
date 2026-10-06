const { randomUUID } = require('node:crypto')
const defaults = require('./config')
const { emptyStock } = require('./economy')
const { validateDesign } = require('./design')

class Bot {
  constructor({ ownerId, x, y, programId = 'default', design = {}, tags = {}, config = defaults }) {
    this.id = randomUUID()
    this.ownerId = ownerId
    this.x = x
    this.y = y
    this.design = validateDesign(design, config)
    this.hp = config.botHp + this.design.armor * config.designScaling.armor
    this.maxHp = this.hp
    this.armor = this.design.armor * config.armorPerPoint
    this.speed = config.botSpeed + this.design.speed * config.designScaling.speed
    this.attackDamage = config.botDamage + this.design.attack * config.designScaling.attack
    this.attackRange = config.botAttackRange
    this.attackCooldown = config.botAttackCooldown
    this.visionRange = config.visionRange + this.design.vision * config.designScaling.vision
    this.target = null
    this.programId = programId
    this.memory = Object.create(null)
    this.cargo = emptyStock()
    this.cargoCapacity = config.cargoCapacity + this.design.cargo * config.designScaling.cargo
    this.communicationRange = config.communicationRange + this.design.communication * config.designScaling.communication
    this.cpuBudget = config.scriptOperationLimit + this.design.cpu * config.designScaling.cpu
    this.maxEnergy = config.botEnergy + this.design.energy * config.designScaling.energy
    this.energy = this.maxEnergy
    this.cpu = 0
    this.limited = false
    this.tags = tags
    this.needsSpawn = true
    this.damageEvents = []
    this.inbox = []
    this.nextAttackTick = 0
    this.lastMineTick = -1
    this.lastUnloadTick = -1
  }

  moveTo(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('Movement coordinates must be finite numbers')
    }
    this.target = { x, y }
  }
}

module.exports = Bot

const { randomUUID } = require('node:crypto')
const defaults = require('./config')

class Bot {
  constructor({ ownerId, x, y, config = defaults }) {
    this.id = randomUUID()
    this.ownerId = ownerId
    this.x = x
    this.y = y
    this.hp = config.botHp
    this.maxHp = config.botHp
    this.speed = config.botSpeed
    this.attackDamage = config.botDamage
    this.attackRange = config.botAttackRange
    this.attackCooldown = config.botAttackCooldown
    this.visionRange = config.visionRange
    this.target = null
    this.program = null
    this.nextAttackTick = 0
    this.lastCollectTick = -1
  }

  moveTo(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('Movement coordinates must be finite numbers')
    }
    this.target = { x, y }
  }
}

module.exports = Bot

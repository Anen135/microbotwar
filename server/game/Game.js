const defaults = require('./config')
const Player = require('./Player')
const Base = require('./Base')
const Bot = require('./Bot')
const Resource = require('./Resource')
const { compile, run } = require('../scripting/Interpreter')
const { createApi } = require('../scripting/Api')

class Game {
  constructor(config = {}, random = Math.random) {
    this.config = Object.freeze({ ...defaults, ...config })
    for (const [key, value] of Object.entries(this.config)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${key} must be a finite non-negative number`)
      }
    }
    for (const key of ['tickRate', 'mapWidth', 'mapHeight', 'resourceRespawnInterval', 'botCost']) {
      if (this.config[key] === 0) throw new RangeError(`${key} must be positive`)
    }
    this.players = []
    this.bases = []
    this.bots = []
    this.resources = []
    this.tickCount = 0
    this.timer = null
    this.random = random
    this.state = 'setup'
    this.winnerId = null
  }

  addPlayer({ name, color, x, y }) {
    if (this.state !== 'setup') throw new Error('Match already started')
    if (this.players.length >= this.config.maxPlayers) throw new Error('Too many players')
    const { mapWidth, mapHeight } = this.config
    if (!Number.isFinite(x) || !Number.isFinite(y)
      || x < 0 || x > mapWidth || y < 0 || y > mapHeight) {
      throw new RangeError('Starting position must be inside the map')
    }
    const player = new Player({ name, color, config: this.config })
    const position = { ownerId: player.id, x, y, config: this.config }
    this.players.push(player)
    this.bases.push(new Base(position))
    this.bots.push(new Bot(position))
    return player
  }

  tick() {
    if (this.state === 'finished') return
    if (this.state === 'running') {
      for (const player of this.players) {
        player.error = null
        player.cpu = 0
        player.limited = false
      }
      for (const bot of [...this.bots]) {
        if (bot.hp <= 0) continue
        const player = this.players.find(p => p.id === bot.ownerId)
        if (player.control === 'ai') this.runAi(bot)
        if (player.control === 'script' && bot.program) {
          const api = createApi(this, bot, player)
          const result = run(bot.program, api.functions, this.config.scriptOperationLimit)
          player.cpu = Math.max(player.cpu, result.cpu)
          player.limited ||= result.limited
          if (result.error) {
            player.error ??= result.error
            bot.target = null
          } else api.commit()
        }
      }
    }
    const { tickRate, mapWidth, mapHeight } = this.config
    for (const bot of this.bots) {
      if (!bot.target || bot.hp <= 0) continue

      // Clamp destinations so a bot stops at the edge instead of leaving the map.
      const x = Math.max(0, Math.min(mapWidth, bot.target.x))
      const y = Math.max(0, Math.min(mapHeight, bot.target.y))
      const dx = x - bot.x
      const dy = y - bot.y
      const distance = Math.hypot(dx, dy)
      const step = bot.speed / tickRate

      if (distance <= step) {
        bot.x = x
        bot.y = y
        bot.target = null
      } else {
        bot.x += dx / distance * step
        bot.y += dy / distance * step
      }
    }
    this.tickCount += 1
    this.bots = this.bots.filter(bot => bot.hp > 0)
    this.bases = this.bases.filter(base => base.hp > 0)
    this.resources = this.resources.filter(resource => resource.amount > 0)
    if (this.state === 'running') {
      const respawnTicks = Math.max(1, Math.ceil(this.config.resourceRespawnInterval * tickRate / 1000))
      if (this.tickCount % respawnTicks === 0) this.fillResources()
      this.checkWinner()
    }
  }

  beginMatch() {
    if (this.players.length < 2) throw new Error('At least two players are required')
    this.state = 'running'
    this.fillResources()
  }

  applyProgram(player, source) {
    const program = compile(source)
    player.program = program
    player.source = source
    player.control = 'script'
    player.error = null
    for (const bot of this.bots.filter(bot => bot.ownerId === player.id)) {
      bot.program = program
      bot.target = null
    }
  }

  restart() {
    this.stop()
    this.bots = []
    this.bases = []
    this.resources = []
    this.tickCount = 0
    this.winnerId = null
    this.players.forEach((player, index) => {
      player.alive = true
      player.resources = this.config.startingResources
      player.error = null
      player.cpu = 0
      const angle = index * 2 * Math.PI / this.players.length
      const position = {
        ownerId: player.id,
        x: this.config.mapWidth * (0.5 + Math.cos(angle) * 0.35),
        y: this.config.mapHeight * (0.5 + Math.sin(angle) * 0.35),
        config: this.config,
      }
      this.bases.push(new Base(position))
      const bot = new Bot(position)
      bot.program = player.program
      this.bots.push(bot)
    })
    this.beginMatch()
  }

  fillResources() {
    while (this.resources.length < this.config.resourceCount) {
      this.resources.push(new Resource({
        x: this.random() * this.config.mapWidth,
        y: this.random() * this.config.mapHeight,
        amount: this.config.resourceAmount,
      }))
    }
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  nearest(bot, kind) {
    const entities = kind === 'resource' ? this.resources : [...this.bots, ...this.bases]
    let nearest = null
    let range = bot.visionRange
    for (const entity of entities) {
      if (entity.id === bot.id || entity.hp <= 0 || entity.amount <= 0) continue
      if (kind === 'enemy' && entity.ownerId === bot.ownerId) continue
      if (kind === 'friendly' && entity.ownerId !== bot.ownerId) continue
      const distance = this.distance(bot, entity)
      if (distance <= range) {
        range = distance
        nearest = entity
      }
    }
    return nearest
  }

  collect(bot) {
    if (bot.hp <= 0 || bot.lastCollectTick === this.tickCount) return false
    const resource = this.nearest(bot, 'resource')
    if (!resource || this.distance(bot, resource) > this.config.collectRange) return false
    const player = this.players.find(p => p.id === bot.ownerId)
    const amount = Math.min(resource.amount, this.config.collectAmount)
    resource.amount -= amount
    player.resources += amount
    bot.lastCollectTick = this.tickCount
    return true
  }

  canSpawn(player) {
    return player.alive && player.resources >= this.config.botCost
      && this.bases.some(base => base.ownerId === player.id && base.hp > 0)
      && this.bots.filter(bot => bot.ownerId === player.id && bot.hp > 0).length < this.config.maxBotsPerPlayer
  }

  spawn(player) {
    if (!this.canSpawn(player)) return null
    const base = this.bases.find(base => base.ownerId === player.id && base.hp > 0)
    const bot = new Bot({ ownerId: player.id, x: base.x, y: base.y, config: this.config })
    bot.program = player.program
    player.resources -= this.config.botCost
    this.bots.push(bot)
    return bot
  }

  attack(bot, target) {
    if (bot.hp <= 0 || !target || target.hp <= 0 || target.ownerId === bot.ownerId
      || ![...this.bots, ...this.bases].includes(target)
      || this.distance(bot, target) > Math.min(bot.attackRange, bot.visionRange)
      || this.tickCount < bot.nextAttackTick) return false
    target.hp = Math.max(0, target.hp - bot.attackDamage)
    bot.nextAttackTick = this.tickCount + Math.max(1, Math.ceil(bot.attackCooldown * this.config.tickRate / 1000))
    return true
  }

  runAi(bot) {
    const player = this.players.find(p => p.id === bot.ownerId)
    const enemy = this.nearest(bot, 'enemy')
    const resource = this.nearest(bot, 'resource')
    if (enemy) {
      if (this.distance(bot, enemy) <= bot.attackRange) {
        bot.target = null
        this.attack(bot, enemy)
      } else bot.moveTo(enemy.x, enemy.y)
    } else if (resource) {
      bot.moveTo(resource.x, resource.y)
      this.collect(bot)
    } else if (!bot.target) {
      bot.moveTo(this.random() * this.config.mapWidth, this.random() * this.config.mapHeight)
    }
    if (this.canSpawn(player)) this.spawn(player)
  }

  eliminate(playerId) {
    this.bots = this.bots.filter(bot => bot.ownerId !== playerId)
    this.bases = this.bases.filter(base => base.ownerId !== playerId)
    const player = this.players.find(p => p.id === playerId)
    if (player) player.alive = false
    if (this.state === 'running') this.checkWinner()
  }

  checkWinner() {
    for (const player of this.players) {
      player.alive = this.bases.some(base => base.ownerId === player.id && base.hp > 0)
        || this.bots.some(bot => bot.ownerId === player.id && bot.hp > 0)
    }
    const survivors = this.players.filter(player => player.alive)
    if (survivors.length <= 1) {
      this.winnerId = survivors[0]?.id ?? null
      this.state = 'finished'
      this.stop()
    }
  }

  snapshot() {
    return {
      tick: this.tickCount,
      gameState: this.state,
      winnerId: this.winnerId,
      config: this.config,
      players: this.players.map(({ id, name, color, resources, alive, control }) => ({ id, name, color, resources, alive, control })),
      bots: this.bots.map(({ id, ownerId, x, y, hp, maxHp }) => ({ id, ownerId, x, y, hp, maxHp })),
      bases: this.bases.map(({ id, ownerId, x, y, hp, maxHp }) => ({ id, ownerId, x, y, hp, maxHp })),
      resources: this.resources.map(({ id, x, y, amount }) => ({ id, x, y, amount })),
    }
  }

  start() {
    if (this.timer !== null) return
    this.timer = setInterval(() => this.tick(), 1000 / this.config.tickRate)
  }

  stop() {
    clearInterval(this.timer)
    this.timer = null
  }
}

module.exports = Game

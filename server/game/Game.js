const { snapshotFor, resetVisibility } = require('./visibility')
const defaults = require('./config')
const Player = require('./Player')
const Base = require('./Base')
const Bot = require('./Bot')
const Resource = require('./Resource')
const MessageBus = require('./MessageBus')
const { compile, run } = require('../scripting/Interpreter')
const { createApi } = require('../scripting/Api')
const { resourceTypes, cargoTotal } = require('./economy')
const { designCost } = require('./design')
const { cloneData } = require('../scripting/data')

class Game {
  constructor(config = {}, random = Math.random) {
    if (Object.keys(config).some(key => !Object.hasOwn(defaults, key))) throw new RangeError('Unknown game configuration field')
    const merged = { ...defaults, ...config }
    for (const key of Object.keys(defaults)) {
      if (typeof defaults[key] !== 'object') continue
      if (config[key] !== undefined && (!config[key] || typeof config[key] !== 'object' || Array.isArray(config[key]))) throw new RangeError(`${key} must be a dictionary`)
      if (config[key] && Object.keys(config[key]).some(field => !Object.hasOwn(defaults[key], field))) throw new RangeError(`Unknown ${key} field`)
      merged[key] = Object.freeze({ ...defaults[key], ...config[key] })
    }
    this.config = Object.freeze(merged)
    for (const [key, setting] of Object.entries(this.config)) {
      for (const value of typeof setting === 'object' ? Object.values(setting) : [setting]) {
        if (!Number.isFinite(value) || value < 0) throw new RangeError(`${key} must contain finite non-negative numbers`)
      }
    }
    for (const key of ['tickRate', 'mapWidth', 'mapHeight', 'resourceRespawnInterval', 'cpuOperationCost']) {
      if (this.config[key] === 0) throw new RangeError(`${key} must be positive`)
    }
    for (const key of ['resourceCount', 'maxPlayers', 'maxBotsPerPlayer', 'designPoints', 'maxPrograms', 'scriptOperationLimit', 'baseCpuBudget', 'maxMessagesPerTick', 'maxInboxMessages', 'maxQueuedMessages', 'messageMaxBytes', 'memoryMaxBytes', 'tagsMaxBytes']) {
      if (!Number.isSafeInteger(this.config[key])) throw new RangeError(`${key} must be a safe integer`)
    }
    for (const [key, max] of Object.entries({ resourceCount: 1000, maxPlayers: 16, maxBotsPerPlayer: 256, maxPrograms: 64, designPoints: 100, scriptOperationLimit: 10000, baseCpuBudget: 10000, maxMessagesPerTick: 32, maxInboxMessages: 64, maxQueuedMessages: 16384, messageMaxBytes: 4096, memoryMaxBytes: 65536, tagsMaxBytes: 8192 })) {
      if (this.config[key] > max) throw new RangeError(`${key} exceeds its supported limit`)
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
    this.messageBus = new MessageBus(this)
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
      this.messageBus.deliver()
      for (const player of this.players) {
        player.error = null
        player.cpu = 0
        player.limited = false
        player.debug = null
      }
      const entities = [...this.bases, ...this.bots]
      for (const entity of entities) {
        entity.target = null
        entity.cpu = 0
        entity.limited = false
        entity.energy = Math.min(entity.maxEnergy, entity.energy + (this.bases.includes(entity) ? this.config.baseEnergyRegen : this.config.energyRegen))
      }
      for (const entity of entities) {
        if (entity.hp <= 0) continue
        const player = this.players.find(p => p.id === entity.ownerId)
        const isBase = this.bases.includes(entity)
        const program = isBase ? player.baseProgram : player.programs.get(entity.programId)?.program
        if (program) this.executeEntity(entity, player, program, isBase)
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
      if (this.state === 'running' && distance > 0) {
        if (bot.energy < this.config.actionEnergyCosts.movement) { bot.target = null; continue }
        bot.energy -= this.config.actionEnergyCosts.movement
      }

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

  executeEntity(entity, player, program, isBase) {
    const api = createApi(this, entity, player, isBase)
    const budget = { used: 0, limit: entity.cpuBudget }
    const events = []
    if (entity.needsSpawn) { events.push({ name: 'on_spawn' }); entity.needsSpawn = false }
    for (const message of entity.inbox) events.push({ name: 'on_message', parameter: 'message', value: message })
    for (const damage of entity.damageEvents) {
      if (damage.tick <= this.tickCount) events.push({ name: 'on_damage', parameter: 'attacker', value: damage.attacker })
    }
    entity.damageEvents = entity.damageEvents.filter(damage => damage.tick > this.tickCount)
    events.push({ name: null })
    let result = { cpu: 0, error: null, limited: false }
    for (const event of events) {
      if (event.name && !program.events?.[event.name]) continue
      const variables = { ...api.variables }
      if (event.parameter) variables[event.parameter] = cloneData(event.value)
      result = run(program, api.functions, entity.cpuBudget, {
        variables, budget, event: event.name, costs: this.config.apiCpuCosts, operationCost: this.config.cpuOperationCost,
      })
      if (result.error || result.limited) break
    }
    entity.cpu = budget.used
    entity.limited = result.limited
    if (!result.error) {
      try { api.commit() } catch (error) { result.error = error.message }
    }
    if (result.error) { entity.target = null; player.error ??= result.error }
    player.cpu = Math.max(player.cpu, entity.cpu)
    player.limited ||= entity.limited
    const debug = { programId: isBase ? '@base' : entity.programId, entityId: entity.id, error: result.error, cpu: entity.cpu, limited: entity.limited, cpuBudget: entity.cpuBudget }
    const rank = item => item?.error ? 3 : item?.limited ? 2 : 1
    if (!player.debug || rank(debug) > rank(player.debug) || (rank(debug) === rank(player.debug) && debug.cpu > player.debug.cpu)) player.debug = debug
  }

  applyProgram(player, source, programId = 'default', design) {
    const entry = player.programs.apply(programId, source, design)
    if (programId === 'default') player.source = source
    player.control = 'script'
    player.error = null
    for (const bot of this.bots.filter(bot => bot.ownerId === player.id)) {
      if (bot.programId === programId) bot.target = null
    }
    return entry
  }

  applyBaseProgram(player, source) {
    const program = compile(source)
    player.baseProgram = program
    player.baseSource = source
    player.error = null
    return { source }
  }

  restart() {
    this.stop()
    resetVisibility(this)
    this.bots = []
    this.bases = []
    this.resources = []
    this.messageBus.clear()
    this.tickCount = 0
    this.winnerId = null
    this.players.forEach((player, index) => {
      player.alive = true
      player.resources = { ...this.config.startingResources }
      player.error = null
      player.cpu = 0
      player.debug = null
      const angle = index * 2 * Math.PI / this.players.length
      const position = {
        ownerId: player.id,
        x: this.config.mapWidth * (0.5 + Math.cos(angle) * 0.35),
        y: this.config.mapHeight * (0.5 + Math.sin(angle) * 0.35),
        config: this.config,
      }
      this.bases.push(new Base(position))
      const bot = new Bot({ ...position, design: player.programs.get('default').design })
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
        resourceType: resourceTypes[this.resources.length % resourceTypes.length],
      }))
    }
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  scan(entity) {
    return [...this.bots, ...this.bases, ...this.resources]
      .filter(item => item.id !== entity.id && (item.hp === undefined || item.hp > 0)
        && (item.amount === undefined || item.amount > 0) && this.distance(entity, item) <= entity.visionRange)
      .map(item => ({
        id: item.id, type: this.bots.includes(item) ? 'bot' : this.bases.includes(item) ? 'base' : 'resource',
        x: item.x, y: item.y, position: { x: item.x, y: item.y }, distance: this.distance(entity, item),
        ...(item.ownerId ? { ownerId: item.ownerId } : {}),
        ...(item.resourceType ? { resourceType: item.resourceType } : {}),
      }))
  }

  mine(bot, resource) {
    if (bot.hp <= 0 || bot.lastMineTick === this.tickCount || !this.resources.includes(resource)
      || resource.amount <= 0 || this.distance(bot, resource) > Math.min(this.config.mineRange, bot.visionRange)) return false
    const amount = Math.min(resource.amount, this.config.mineAmount, bot.cargoCapacity - cargoTotal(bot.cargo))
    if (amount <= 0) return false
    resource.amount -= amount
    bot.cargo[resource.resourceType] += amount
    bot.lastMineTick = this.tickCount
    return true
  }

  unload(bot, base) {
    if (bot.hp <= 0 || bot.lastUnloadTick === this.tickCount || !this.bases.includes(base) || base.hp <= 0
      || base.ownerId !== bot.ownerId || this.distance(bot, base) > this.config.unloadRange || cargoTotal(bot.cargo) === 0) return false
    const player = this.players.find(p => p.id === bot.ownerId)
    for (const type of resourceTypes) { player.resources[type] += bot.cargo[type]; bot.cargo[type] = 0 }
    bot.lastUnloadTick = this.tickCount
    return true
  }

  canSpawn(player, programId = 'default') {
    const entry = player.programs.get(programId)
    const cost = entry && designCost(entry.design, this.config)
    return !!entry && player.alive
      && resourceTypes.every(type => player.resources[type] >= cost[type])
      && this.bases.some(base => base.ownerId === player.id && base.hp > 0)
      && this.bots.filter(bot => bot.ownerId === player.id && bot.hp > 0).length < this.config.maxBotsPerPlayer
  }

  spawn(player, programId = 'default', tags = {}) {
    const safeTags = cloneData(tags, this.config.tagsMaxBytes)
    if (!safeTags || Array.isArray(safeTags) || typeof safeTags !== 'object') throw new Error('Tags must be a dictionary')
    if (!this.canSpawn(player, programId)) return null
    const base = this.bases.find(base => base.ownerId === player.id && base.hp > 0)
    const entry = player.programs.get(programId)
    const bot = new Bot({ ownerId: player.id, x: base.x, y: base.y, programId, design: entry.design, tags: safeTags, config: this.config })
    const cost = designCost(entry.design, this.config)
    for (const type of resourceTypes) player.resources[type] -= cost[type]
    this.bots.push(bot)
    return bot
  }

  attack(bot, target) {
    if (bot.hp <= 0 || !target || target.hp <= 0 || target.ownerId === bot.ownerId
      || ![...this.bots, ...this.bases].includes(target)
      || this.distance(bot, target) > Math.min(bot.attackRange, bot.visionRange)
      || this.tickCount < bot.nextAttackTick) return false
    target.hp = Math.max(0, target.hp - Math.max(this.config.minimumDamage, bot.attackDamage - (target.armor ?? 0)))
    if (target.damageEvents.length < this.config.maxDamageEvents) {
      const attacker = this.distance(bot, target) <= target.visionRange
        ? { id: bot.id, type: 'bot', ownerId: bot.ownerId, x: bot.x, y: bot.y, position: { x: bot.x, y: bot.y }, distance: this.distance(bot, target) } : null
      target.damageEvents.push({ tick: this.tickCount + 1, attacker })
    }
    bot.nextAttackTick = this.tickCount + Math.max(1, Math.ceil(bot.attackCooldown * this.config.tickRate / 1000))
    return true
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

  snapshotFor(playerId) {
    return snapshotFor(this, playerId)
  }

  snapshot() {
    return {
      tick: this.tickCount,
      gameState: this.state,
      winnerId: this.winnerId,
      config: this.config,
      players: this.players.map(({ id, name, color, resources, alive, control }) => ({ id, name, color, resources, alive, control })),
      bots: this.bots.map(({ id, ownerId, x, y, hp, maxHp, programId, cargo, cargoCapacity, memory, tags, visionRange, communicationRange, cpu, cpuBudget, limited, energy, maxEnergy, design }) => ({ id, ownerId, x, y, hp, maxHp, programId, cargo: { ...cargo }, cargoCapacity, memory: cloneData(memory, this.config.memoryMaxBytes), tags: cloneData(tags, this.config.tagsMaxBytes), visionRange, communicationRange, cpu, cpuBudget, limited, energy, maxEnergy, design })),
      bases: this.bases.map(({ id, ownerId, x, y, hp, maxHp, visionRange, communicationRange, cpu, cpuBudget, limited, energy, maxEnergy, memory }) => ({ id, ownerId, x, y, hp, maxHp, visionRange, communicationRange, cpu, cpuBudget, limited, energy, maxEnergy, memory: cloneData(memory, this.config.memoryMaxBytes) })),
      resources: this.resources.map(({ id, x, y, amount, resourceType }) => ({ id, x, y, amount, resourceType })),
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

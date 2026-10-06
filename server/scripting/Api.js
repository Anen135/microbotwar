// The DSL only sees values returned here, never server objects or JavaScript APIs.
const { cloneData, safeKey, writeKey, validateProgramId } = require('./data')
const defaults = require('../game/config')
const argumentCounts = {
  scan: [0], len: [1], send: [2], receive: [0], moveTo: [1, 2], attack: [1], mine: [1], unload: [1],
  getCargo: [0], canSpawn: [1], spawn: [1, 2], distance: [1], random: [0], getBots: [0], count: [1],
  getPosition: [0], getBase: [0], getHealth: [0], getResources: [0], getEnergy: [0], getTags: [0], setTag: [2],
}
const definitions = Object.freeze(Object.fromEntries(Object.entries(argumentCounts).map(([name, args]) => [name, { args, cost: defaults.apiCpuCosts[name] }])))

function createApi(game, bot, player, isBase = false) {
  const commands = []
  const memory = cloneData(bot.memory, game.config.memoryMaxBytes)
  const tags = cloneData(bot.tags, game.config.tagsMaxBytes)
  let energy = bot.energy
  function spendEnergy(action) {
    const cost = game.config.actionEnergyCosts[action]
    if (energy < cost) return false
    energy -= cost
    return true
  }
  let inbox = bot.inbox.map(message => cloneData(message))
  const reference = entity => entity ? Object.freeze({ id: entity.id, x: entity.x, y: entity.y }) : null
  const position = target => {
    if (!target || typeof target !== 'object' || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
      throw new Error('Expected a target; check that it exists with if')
    }
    return target
  }
  const functions = {
    scan: () => spendEnergy('scan') ? game.scan(bot) : [],
    send: (channel, payload) => {
      const data = game.messageBus.prepare(bot, channel, payload).payload
      if (!spendEnergy('send')) return false
      commands.push(() => game.messageBus.send(bot, channel, data))
      return null
    },
    receive: () => { const messages = inbox; inbox = []; return messages },
    len: value => {
      if (!Array.isArray(value) && typeof value !== 'string') throw new Error('len expects a list or string')
      return value.length
    },
    moveTo: (...args) => {
      const target = args.length === 1 ? position(args[0]) : { x: args[0], y: args[1] }
      position(target)
      const { x, y } = target
      commands.push(() => bot.moveTo(x, y))
      return null
    },
    attack: target => {
      position(target)
      const entity = [...game.bots, ...game.bases].find(item => item.id === target.id)
      if (!spendEnergy('attack')) return false
      commands.push(() => game.attack(bot, entity))
      return null
    },
    mine: target => {
      position(target)
      const resource = game.resources.find(item => item.id === target.id)
      if (!spendEnergy('mine')) return false
      commands.push(() => game.mine(bot, resource))
      return null
    },
    unload: target => {
      position(target)
      const base = game.bases.find(item => item.id === target.id)
      if (!spendEnergy('unload')) return false
      commands.push(() => game.unload(bot, base))
      return null
    },
    canSpawn: programId => { validateProgramId(programId); return game.canSpawn(player, programId) },
    spawn: (programId, metadata = {}) => {
      validateProgramId(programId)
      const data = cloneData(metadata, game.config.tagsMaxBytes)
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Tags must be a dictionary')
      if (!game.canSpawn(player, programId) || !spendEnergy('spawn')) return false
      commands.push(() => game.spawn(player, programId, data))
      return null
    },
    distance: target => game.distance(bot, position(target)),
    random: () => game.random(),
    getPosition: () => reference(bot),
    getBase: () => reference(game.bases.find(base => base.ownerId === player.id && base.hp > 0)),
    getHealth: () => bot.hp,
    getCargo: () => ({ ...bot.cargo, total: Object.values(bot.cargo).reduce((sum, value) => sum + value, 0), capacity: bot.cargoCapacity }),
    getEnergy: () => energy,
    getTags: () => tags,
    setTag: (key, value) => { writeKey(tags, safeKey(key), value); return null },
    getResources: () => ({ ...player.resources }),
    getBots: () => game.bots.filter(item => item.ownerId === player.id && item.hp > 0)
      .map(item => ({ id: item.id, type: 'bot', ownerId: item.ownerId, x: item.x, y: item.y, hp: item.hp, programId: item.programId, tags: cloneData(item.tags, game.config.tagsMaxBytes) })),
    count: programId => {
      validateProgramId(programId)
      return game.bots.filter(item => item.ownerId === player.id && item.hp > 0 && item.programId === programId).length
    },
  }
  const unavailable = isBase ? ['moveTo', 'attack', 'mine', 'unload', 'getCargo'] : ['canSpawn', 'spawn', 'getResources', 'getBots', 'count']
  for (const name of unavailable) delete functions[name]
  return { functions, variables: { memory, tags }, commit: () => {
    const nextMemory = cloneData(memory, game.config.memoryMaxBytes)
    const nextTags = cloneData(tags, game.config.tagsMaxBytes)
    bot.energy = energy
    for (const command of commands) command()
    bot.memory = nextMemory
    bot.tags = nextTags
  } }
}

module.exports = { definitions, createApi }

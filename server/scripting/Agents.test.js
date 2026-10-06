const { test } = require('node:test')
const assert = require('node:assert/strict')
const Game = require('../game/Game')
const Resource = require('../game/Resource')
const { compile, run } = require('./Interpreter')

function match(config = {}) {
  const game = new Game({ resourceCount: 0, ...config })
  game.addPlayer({ name: 'A', color: 'blue', x: 100, y: 100 })
  game.addPlayer({ name: 'B', color: 'red', x: 1000, y: 100 })
  game.beginMatch()
  return game
}

test('scan returns only local public data and no global query is callable', () => {
  const game = match()
  const bot = game.bots[0]
  game.resources.push(new Resource({ x: 200, y: 100 }), new Resource({ x: 900, y: 100 }))
  const objects = game.scan(bot)
  assert.equal(objects.filter(item => item.type === 'resource').length, 1)
  assert.equal(objects.some(item => item.ownerId === game.players[1].id), false)
  for (const item of objects) {
    assert.deepEqual(Object.keys(item).sort(), [...['id', 'type', 'x', 'y', 'position', 'distance'], ...(item.ownerId ? ['ownerId'] : []), ...(item.resourceType ? ['resourceType'] : [])].sort())
  }
  for (const fn of ['nearestEnemy', 'nearestResource', 'all_enemies', 'enemy_count']) assert.throws(() => compile(`${fn}()`))
  game.applyProgram(game.players[0], 'x = getResources()')
  game.tick()
  assert.match(game.players[0].error, /unavailable/)
})

test('bot memory survives ticks independently and empty scripts clear prior movement', () => {
  const game = match()
  const player = game.players[0]
  game.applyProgram(player, 'memory["ticks"] = (memory["ticks"] or 0) + 1\nmoveTo(200, 100)')
  game.tick()
  game.tick()
  assert.equal(game.bots[0].memory.ticks, 2)
  assert.equal(game.bots[1].memory.ticks, undefined)
  assert.equal(game.bots[0].x, 116)
  game.applyProgram(player, '')
  game.tick()
  assert.equal(game.bots[0].x, 116)
  assert.equal(game.bots[0].memory.ticks, 2)
})

test('lists, dictionaries, fields, indexed assignment and iteration are usable', () => {
  const memory = Object.create(null)
  const source = 'items = [{"x": 10}, {"x": 20}]\nmemory["total"] = 0\nfor item in items:\n    memory["total"] = memory["total"] + item.x\nif memory["total"] == 30:\n    memory["answer"] = "#ok"\nelif true:\n    memory["answer"] = "wrong"'
  const result = run(compile(source), {}, 100, { variables: { memory } })
  assert.equal(result.error, null)
  assert.equal(memory.total, 30)
  assert.equal(memory.answer, '#ok')
})

test('unsafe keys, cyclic memory and excessive AST depth cannot affect engine state', () => {
  const game = match()
  const player = game.players[0]
  for (const source of ['memory["constructor"] = 1', 'memory["self"] = memory']) {
    game.applyProgram(player, `moveTo(200, 100)\n${source}`)
    game.tick()
    assert.ok(player.error)
    assert.equal(game.bots[0].x, 100)
    assert.equal(Object.keys(game.bots[0].memory).length, 0)
  }
  assert.throws(() => compile('x = memory.constructor'))
  assert.throws(() => compile('x = ' + Array(40).fill('1').join('+')), /AST nesting/)
  game.bots[0].hp = 0
  game.tick()
  assert.equal(game.bots.some(bot => bot.ownerId === player.id), false)
})

module.exports = { match }

test('typed cargo respects shared capacity, own-base distance and explicit unloading', () => {
  const game = match({ cargoCapacity: 3 })
  const bot = game.bots[0]
  const player = game.players[0]
  const starting = { ...player.resources }
  for (const type of ['metal', 'energy', 'silicon']) {
    const resource = new Resource({ x: bot.x, y: bot.y, resourceType: type, amount: 5 })
    game.resources.push(resource)
    game.mine(bot, resource)
    game.tick()
  }
  assert.equal(bot.cargo.metal, 2)
  assert.equal(bot.cargo.energy, 1)
  assert.equal(bot.cargo.silicon, 0)
  assert.deepEqual(player.resources, starting)
  bot.x = game.bases[0].x + game.config.unloadRange + 1
  assert.equal(game.unload(bot, game.bases[0]), false)
  bot.x -= 1
  assert.equal(game.unload(bot, game.bases[0]), true)
  assert.deepEqual(player.resources, { metal: starting.metal + 2, energy: starting.energy + 1, silicon: starting.silicon })
  assert.equal(game.unload(bot, game.bases[0]), false)
})

test('messages deliver next tick at send range boundary, only to allies, without forwarding', () => {
  const game = match()
  const sender = game.bots[0]
  const player = game.players[0]
  const nearby = game.spawn(player)
  const remote = game.spawn(player)
  nearby.x = sender.x + sender.communicationRange
  remote.x = nearby.x + 1
  game.bots[1].x = sender.x
  const payload = { x: 777 }
  assert.equal(game.messageBus.send(sender, 'target', payload), true)
  payload.x = -1
  game.tick()
  assert.equal(nearby.inbox.length, 0)
  nearby.x = 900 // Delivery depends on the positions at send time.
  game.tick()
  assert.equal(nearby.inbox.length, 1)
  assert.deepEqual({ ...nearby.inbox[0], payload: { ...nearby.inbox[0].payload } }, { sender: sender.id, channel: 'target', payload: { x: 777 }, tick: 0 })
  assert.equal(remote.inbox.length, 0)
  assert.equal(game.bots[1].inbox.length, 0)
  assert.equal(game.bases[0].inbox.length, 1)
  game.tick()
  assert.equal(remote.inbox.length, 0)
})

test('message limits, invalid payloads and destroyed recipients are bounded', () => {
  const game = match({ maxMessagesPerTick: 2, maxInboxMessages: 1 })
  const sender = game.bots[0]
  const recipient = game.spawn(game.players[0])
  assert.throws(() => game.messageBus.send(sender, 'x', { value: Infinity }))
  assert.throws(() => game.messageBus.send(sender, 'x', { value: 'x'.repeat(1024) }))
  assert.equal(game.messageBus.send(sender, 'x', 1), true)
  assert.equal(game.messageBus.send(sender, 'x', 2), true)
  assert.equal(game.messageBus.send(sender, 'x', 3), false)
  recipient.hp = 0
  game.tick()
  game.tick()
  assert.equal(game.bases[0].inbox.length, 1)
  assert.equal(game.messageBus.pending.length, 0)
})

test('send and receive permit user-defined protocols using local memory', () => {
  const game = match()
  const player = game.players[0]
  game.applyProgram(player, 'send("report", {"x": 210, "role": "scout"})')
  game.applyProgram(player, 'for message in receive():\n    memory["target"] = message.payload.x\n    memory["channel"] = message.channel', 'receiver')
  const receiver = game.spawn(player, 'receiver')
  game.tick()
  assert.equal(receiver.memory.target, undefined)
  game.tick()
  assert.equal(receiver.memory.target, 210)
  assert.equal(receiver.memory.channel, 'report')
  assert.equal(player.error, null)
})

test('designs use arbitrary program roles, bounded points and typed configurable costs', () => {
  const game = match()
  const player = game.players[0]
  player.resources = { metal: 100, energy: 100, silicon: 100 }
  const original = game.bots[0]
  game.applyProgram(player, 'pass', 'default', { speed: 3, vision: 2, communication: 1, cpu: 1, energy: 1, cargo: 1, armor: 1 })
  const bot = game.spawn(player, 'default', { squad: 'alpha' })
  assert.equal(bot.speed, 140)
  assert.equal(bot.visionRange, 370)
  assert.equal(bot.communicationRange, 180)
  assert.equal(bot.cpuBudget, 140)
  assert.equal(bot.maxEnergy, 55)
  assert.equal(bot.cargoCapacity, 15)
  assert.equal(bot.maxHp, 120)
  assert.equal(original.speed, 80)
  assert.equal(bot.tags.squad, 'alpha')
  assert.deepEqual(player.resources, { metal: 80, energy: 88, silicon: 96 })
  const entry = player.programs.get('default')
  for (const design of [{ speed: 11 }, { speed: -1 }, { speed: 0.5 }, { speed: Infinity }, { role: 1 }, null, []]) {
    assert.throws(() => game.applyProgram(player, 'moveTo(0,0)', 'default', design))
    assert.equal(player.programs.get('default'), entry)
  }
  assert.throws(() => new Game({ startingResources: 1 }))
  assert.throws(() => new Game({ resourceCount: 0.5 }))
  assert.throws(() => new Game({ cpuOperationCost: 0 }))
})

test('CPU exhaustion ends execution, commits only completed commands and resets per tick', () => {
  const game = match({ scriptOperationLimit: 20 })
  const player = game.players[0]
  game.applyProgram(player, 'moveTo(200,100)\nfor item in [1,2,3,4,5,6,7,8,9,10]:\n    getHealth()\nmoveTo(0,0)')
  game.tick()
  assert.equal(game.bots[0].x, 108)
  assert.equal(game.bots[0].limited, true)
  assert.ok(game.bots[0].cpu <= 20)
  game.tick()
  assert.equal(game.bots[0].x, 116)
  assert.equal(player.debug.programId, 'default')
  assert.equal(player.debug.entityId, game.bots[0].id)
})

test('energy is independent of CPU, limits actions and regenerates without fallback behavior', () => {
  const game = match({ botEnergy: 2, energyRegen: 0 })
  const player = game.players[0]
  game.applyProgram(player, 'scan()\nscan()\nscan()\nmemory["remaining"] = getEnergy()\nmoveTo(200,100)')
  game.tick()
  const bot = game.bots[0]
  assert.equal(bot.energy, 0)
  assert.equal(bot.memory.remaining, 0)
  assert.equal(bot.x, 100)
  assert.equal(bot.limited, false)
  assert.ok(bot.cpu > 0 && bot.cpu < bot.cpuBudget)
  const restoring = match({ botEnergy: 2, energyRegen: 1 })
  restoring.bots[0].energy = 0
  restoring.tick()
  assert.equal(restoring.bots[0].energy, 1)
  assert.equal(restoring.bots[0].x, 100)
  restoring.tick()
  assert.equal(restoring.bots[0].energy, 2)
})

test('generic tags persist locally and invalid metadata cancels actions and energy expenditure', () => {
  const game = match()
  const player = game.players[0]
  const bot = game.bots[0]
  game.applyProgram(player, 'setTag("squad", "alpha")\ntags["state"] = "guard"')
  game.tick()
  assert.equal(bot.tags.squad, 'alpha')
  assert.equal(bot.tags.state, 'guard')
  game.applyProgram(player, 'scan()\nmoveTo(200,100)\ntags["self"] = tags')
  game.tick()
  assert.match(player.error, /acyclic/)
  assert.equal(bot.x, 100)
  assert.equal(bot.energy, bot.maxEnergy)
  assert.equal(bot.tags.self, undefined)
})

test('spawn and tick handlers share one CPU budget; spawn runs once', () => {
  const game = match({ scriptOperationLimit: 20 })
  const player = game.players[0]
  game.applyProgram(player, 'def on_spawn():\n    memory["born"] = 1\n    getHealth()\n    getHealth()\ndef on_tick():\n    getHealth()\n    getHealth()\n    moveTo(200,100)')
  game.tick()
  const bot = game.bots[0]
  assert.equal(bot.memory.born, 1)
  assert.equal(bot.limited, true)
  assert.ok(bot.cpu <= 20)
  assert.equal(bot.x, 100)
  game.tick()
  assert.equal(bot.limited, false)
  assert.equal(bot.x, 108)
  assert.equal(bot.memory.born, 1)
  for (const source of ['def helper():\n    pass', 'def on_tick(message):\n    pass', 'def on_tick():\n    pass\ndef on_tick():\n    pass']) assert.throws(() => compile(source))
})

test('all message handlers and on_tick consume the same entity CPU budget', () => {
  const game = match({ scriptOperationLimit: 20 })
  const player = game.players[0]
  game.applyProgram(player, 'def on_message(message):\n    getHealth()\n    getHealth()\n    getHealth()\ndef on_tick():\n    moveTo(200,100)')
  const bot = game.bots[0]
  game.messageBus.send(game.bases[0], 'one', 1)
  game.messageBus.send(game.bases[0], 'two', 2)
  game.tick()
  assert.equal(bot.x, 108)
  game.tick()
  assert.equal(bot.x, 108)
  assert.equal(bot.limited, true)
  assert.equal(bot.cpu, 20)
  game.tick()
  assert.equal(bot.x, 116)
  assert.equal(bot.limited, false)
})

test('damage events reveal only an attacker sensed at the time of the hit', () => {
  const game = match()
  const [defender, attacker] = game.bots
  attacker.x = 130
  defender.visionRange = 10
  game.applyProgram(game.players[0], 'def on_damage(attacker):\n    if attacker:\n        memory["attacker"] = attacker.id\n    else:\n        memory["hidden"] = true')
  assert.equal(game.attack(attacker, defender), true)
  game.tick()
  assert.equal(defender.memory.hidden, undefined)
  game.tick()
  assert.equal(defender.memory.hidden, true)
  assert.equal(defender.memory.attacker, undefined)
  for (let i = 0; i < 3; i += 1) game.tick()
  defender.visionRange = 250
  game.attack(attacker, defender)
  game.tick()
  game.tick()
  assert.equal(defender.memory.attacker, attacker.id)
})

test('Base Controller owns production strategy and only knows its stock, bots and local scan', () => {
  const game = match()
  const player = game.players[0]
  game.applyProgram(player, 'def on_spawn():\n    memory["born"] = 1', 'hauler', { cargo: 1 })
  const source = 'def on_spawn():\n    memory["known"] = getBots()\n    memory["visible"] = scan()\ndef on_tick():\n    if count("hauler") < 2 and getResources().metal >= 11:\n        spawn("hauler", {"group": "miners"})'
  game.applyBaseProgram(player, source)
  const previous = player.baseProgram
  assert.throws(() => game.applyBaseProgram(player, 'eval(1)'))
  assert.equal(player.baseProgram, previous)
  game.tick()
  const base = game.bases[0]
  const first = game.bots.find(bot => bot.programId === 'hauler')
  assert.equal(first.memory.born, undefined)
  assert.equal(base.memory.known.length, 1)
  assert.equal(base.memory.known[0].ownerId, player.id)
  assert.equal(base.memory.known[0].memory, undefined)
  assert.equal(base.memory.visible.some(item => item.ownerId === game.players[1].id), false)
  assert.equal(first.tags.group, 'miners')
  game.tick()
  game.tick()
  assert.equal(first.memory.born, 1)
  assert.equal(game.bots.filter(bot => bot.programId === 'hauler').length, 2)
  assert.equal(player.resources.metal, 8)
  assert.equal(player.debug.programId, '@base')
  assert.equal(player.baseSource, source)
})

test('bots cannot produce or query stocks/army, and bases have no movement/mining/combat API', () => {
  const game = match()
  const player = game.players[0]
  for (const source of ['spawn("default")', 'getResources()', 'getBots()', 'count("default")', 'canSpawn("default")']) {
    game.applyProgram(player, source)
    game.tick()
    assert.match(player.error, /unavailable/)
    assert.equal(game.bots.length, 2)
  }
  game.applyProgram(player, '')
  for (const source of ['moveTo(200,100)', 'attack(getBase())', 'mine(getBase())', 'unload(getBase())', 'getCargo()']) {
    game.applyBaseProgram(player, source)
    game.tick()
    assert.match(player.error, /unavailable/)
    assert.equal(player.debug.programId, '@base')
  }
})

test('Base Controller receives only messages that reach it and keeps separate persistent memory', () => {
  const game = match()
  const player = game.players[0]
  game.applyBaseProgram(player, 'def on_message(message):\n    memory[message.channel] = message.payload\ndef on_tick():\n    memory["ticks"] = (memory["ticks"] or 0) + 1')
  const distant = game.spawn(player)
  distant.x = game.bases[0].x + distant.communicationRange + 1
  game.messageBus.send(distant, 'remote', { x: 999 })
  game.messageBus.send(game.bots[0], 'local', { x: 111 })
  game.tick()
  game.tick()
  const base = game.bases[0]
  assert.equal(base.memory.local.x, 111)
  assert.equal(base.memory.remote, undefined)
  assert.equal(base.memory.ticks, 2)
  assert.equal(game.bots[0].memory.ticks, undefined)
  const source = player.baseSource
  game.restart()
  assert.equal(player.baseSource, source)
  assert.equal(Object.keys(game.bases[0].memory).length, 0)
  assert.equal(game.messageBus.pending.length, 0)
})

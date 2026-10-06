const { test } = require('node:test')
const assert = require('node:assert/strict')
const Game = require('../game/Game')
const Resource = require('../game/Resource')

function match(config = {}) {
  const game = new Game({ resourceCount: 0, ...config })
  game.addPlayer({ name: 'A', color: 'blue', x: 100, y: 100 })
  game.addPlayer({ name: 'B', color: 'red', x: 1000, y: 100 })
  game.beginMatch()
  return game
}

test('message depth is validated with its envelope before any staged action commits', () => {
  const game = match()
  const player = game.players[0]
  const bot = game.bots[0]
  const resource = new Resource({ x: 100, y: 100 })
  game.resources.push(resource)
  const literal = '['.repeat(8) + '0' + ']'.repeat(8)
  game.applyProgram(player, 'for target in scan():\n    if target.type == "resource":\n        mine(target)\nmoveTo(200,100)\nsend("x", ' + literal + ')')
  assert.doesNotThrow(() => game.tick())
  assert.match(player.error, /deeply nested/)
  assert.equal(resource.amount, 20)
  assert.equal(bot.cargo.metal, 0)
  assert.equal(bot.energy, bot.maxEnergy)
  assert.equal(bot.x, 100)
  assert.equal(game.messageBus.pending.length, 0)
  game.applyProgram(player, '')
  assert.doesNotThrow(() => game.tick())
  let payload = 0
  for (let i = 0; i < 8; i += 1) payload = [payload]
  assert.throws(() => game.messageBus.send(bot, 'x', payload), /deeply nested/)
  assert.equal(game.messageBus.pending.length, 0)
})

test('accepted boundary-depth messages survive delivery, receive and on_message cloning', () => {
  const game = match()
  const player = game.players[0]
  const literal = '['.repeat(7) + '123' + ']'.repeat(7)
  const indexes = '[0]'.repeat(7)
  game.applyProgram(player, 'send("x", ' + literal + ')')
  game.applyProgram(player, 'def on_message(message):\n    memory["value"] = message.payload' + indexes, 'events')
  game.applyProgram(player, 'for message in receive():\n    memory["value"] = message.payload' + indexes, 'poll')
  const events = game.spawn(player, 'events')
  const poll = game.spawn(player, 'poll')
  assert.doesNotThrow(() => game.tick())
  assert.doesNotThrow(() => game.tick())
  assert.equal(player.error, null)
  assert.equal(events.memory.value, 123)
  assert.equal(poll.memory.value, 123)
})

test('message node limit includes envelope fields and accepts cloneable boundary payloads', () => {
  const game = match({ messageMaxBytes: 2048, scriptOperationLimit: 10000 })
  const player = game.players[0]
  const payload = [Array(256).fill(0), Array(252).fill(0)]
  game.applyProgram(player, 'moveTo(200,100)\nsend("x", ' + JSON.stringify(payload) + ')')
  game.tick()
  assert.match(player.error, /too large/)
  assert.equal(game.messageBus.pending.length, 0)
  assert.equal(game.bots[0].x, 100)
  game.applyProgram(player, '')
  game.applyProgram(player, 'for message in receive():\n    memory["items"] = len(message.payload[0]) + len(message.payload[1])', 'poll')
  const recipient = game.spawn(player, 'poll')
  assert.equal(game.messageBus.send(game.bots[0], 'x', [Array(256).fill(0), Array(245).fill(0)]), true)
  assert.doesNotThrow(() => game.tick())
  assert.doesNotThrow(() => game.tick())
  assert.equal(recipient.memory.items, 501)
})

test('queued movement captures coordinates before later script mutations', () => {
  const game = match()
  const player = game.players[0]
  const bot = game.bots[0]
  const resource = new Resource({ x: 100, y: 100 })
  game.resources.push(resource)
  game.applyProgram(player, 'for target in scan():\n    if target.type == "resource":\n        mine(target)\np = {"x": 200, "y": 100}\nmoveTo(p)\np.x = null\np.y = "invalid"')
  game.tick()
  assert.equal(player.error, null)
  assert.equal(bot.x, 108)
  assert.equal(bot.y, 100)
  assert.equal(bot.cargo.metal, 2)
  assert.equal(resource.amount, 18)
})

test('snapshots respect the configured persistent-memory limit above default clone size', () => {
  const game = match({ memoryMaxBytes: 16384 })
  const player = game.players[0]
  const source = 's = "' + 'a'.repeat(1000) + '"\n' + Array.from({ length: 9 }, (_, i) => `memory["k${i}"] = s`).join('\n')
  game.applyProgram(player, source)
  game.applyBaseProgram(player, source)
  game.tick()
  assert.equal(player.error, null)
  assert.ok(Buffer.byteLength(JSON.stringify(game.bots[0].memory)) > 8192)
  assert.doesNotThrow(() => game.snapshot())
  assert.doesNotThrow(() => game.snapshotFor(player.id))
})

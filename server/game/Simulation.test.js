const { test } = require('node:test')
const assert = require('node:assert/strict')
const Game = require('./Game')
const Resource = require('./Resource')

function seededRandom(seed) {
  return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296)
}

function match(config = {}, seed = 1) {
  const game = new Game(config, seededRandom(seed))
  game.addPlayer({ name: 'A', color: 'blue', x: 100, y: 100 })
  game.addPlayer({ name: 'B', color: 'red', x: game.config.mapWidth - 100, y: 100 })
  game.beginMatch()
  return game
}

test('mining respects distance, per-tick rate, cargo and depletion; only unload credits stocks', () => {
  const game = match({ resourceCount: 0 })
  const bot = game.bots[0]
  const resource = new Resource({ x: 126, y: 100, amount: 3 })
  game.resources.push(resource)
  const starting = { ...game.players[0].resources }
  assert.equal(game.mine(bot, resource), false)
  resource.x = 125
  assert.equal(game.mine(bot, resource), true)
  assert.equal(game.mine(bot, resource), false)
  assert.equal(bot.cargo.metal, 2)
  assert.deepEqual(game.players[0].resources, starting)
  game.tick()
  game.mine(bot, resource)
  assert.equal(bot.cargo.metal, 3)
  assert.equal(game.unload(bot, game.bases[1]), false)
  assert.equal(game.unload(bot, game.bases[0]), true)
  assert.equal(game.players[0].resources.metal, starting.metal + 3)
  assert.equal(bot.cargo.metal, 0)
  game.tick()
  assert.equal(game.resources.length, 0)
})

test('spawn charges once, respects the cap and needs a living base', () => {
  const game = match({ maxBotsPerPlayer: 2 })
  const player = game.players[0]
  player.resources = { metal: 0, energy: 0, silicon: 0 }
  assert.equal(game.spawn(player), null)
  player.resources = { metal: 20, energy: 10, silicon: 0 }
  assert.equal(game.spawn(player).ownerId, player.id)
  assert.deepEqual(player.resources, { metal: 10, energy: 5, silicon: 0 })
  assert.equal(game.spawn(player), null)
  game.bots.pop()
  game.bases[0].hp = 0
  assert.equal(game.spawn(player), null)
  assert.deepEqual(player.resources, { metal: 10, energy: 5, silicon: 0 })
})

test('resources respawn within map bounds at the configured interval', () => {
  const game = match({ resourceCount: 3, resourceRespawnInterval: 200 })
  game.resources = []
  game.tick()
  assert.equal(game.resources.length, 0)
  game.tick()
  assert.equal(game.resources.length, 3)
  assert.ok(game.resources.every(r => r.x >= 0 && r.x <= 1600 && r.y >= 0 && r.y <= 900))
})

test('combat enforces vision, attack range, ownership and cooldown', () => {
  const game = match({ resourceCount: 0 })
  const [a, b] = game.bots
  assert.equal(game.scan(a).some(item => item.id === b.id), false)
  b.x = 136
  assert.equal(game.attack(a, b), false)
  b.x = 135
  assert.equal(game.attack(a, b), true)
  assert.equal(b.hp, 90)
  assert.equal(game.attack(a, b), false)
  for (let i = 0; i < 5; i += 1) game.tick()
  assert.equal(game.attack(a, b), true)
  assert.equal(b.hp, 80)
  assert.equal(game.attack(a, game.bases[0]), false)
  b.x = 351
  assert.equal(game.scan(a).some(item => item.id === b.id), false)
  b.x = 350
  assert.equal(game.scan(a).some(item => item.id === b.id), true)
})

test('defeat needs both base and bots destroyed; winner stops simulation', () => {
  const game = match()
  game.bases[1].hp = 0
  game.tick()
  assert.equal(game.players[1].alive, true)
  game.bots[1].hp = 0
  game.tick()
  assert.equal(game.players[1].alive, false)
  assert.equal(game.winnerId, game.players[0].id)
  assert.equal(game.state, 'finished')
  const tick = game.tickCount
  game.tick()
  assert.equal(game.tickCount, tick)
})

test('empty programs never move, mine, attack or spawn, even beside targets', () => {
  const game = match({ resourceCount: 0 })
  const [a, b] = game.bots
  b.x = a.x + 10
  game.resources.push(new Resource({ x: a.x, y: a.y, amount: 20 }))
  game.players.forEach(player => {
    player.resources = { metal: 300, energy: 300, silicon: 300 }
    game.applyProgram(player, '')
  })
  const before = game.snapshot()
  for (let i = 0; i < 20; i += 1) game.tick()
  const after = game.snapshot()
  for (const key of ['bots', 'bases', 'resources', 'players']) assert.deepEqual(after[key], before[key])
})

test('the empty example cannot play the match automatically', () => {
  const game = match({}, 7)
  const example = require('../scripting/example')
  game.players.forEach(player => game.applyProgram(player, example))
  let spawned = false
  for (let i = 0; i < 20; i += 1) {
    game.tick()
    spawned ||= game.bots.length > 2
    assert.ok(game.players.every(player => !player.error && !player.limited))
  }
  assert.equal(spawned, false)
  assert.equal(game.state, 'running')
  assert.equal(game.winnerId, null)
})

test('restart preserves players and programs, recreates entities and balances', () => {
  const game = match()
  const player = game.players[0]
  game.applyProgram(player, 'pass')
  player.resources = { metal: 100, energy: 100, silicon: 100 }
  const oldBot = game.bots[0].id
  game.eliminate(game.players[1].id)
  game.restart()
  assert.equal(game.state, 'running')
  assert.equal(game.tickCount, 0)
  assert.equal(game.winnerId, null)
  assert.deepEqual(player.resources, game.config.startingResources)
  assert.equal(player.source, 'pass')
  assert.equal(game.bots[0].programId, 'default')
  assert.equal(player.programs.get('default').source, 'pass')
  assert.notEqual(game.bots[0].id, oldBot)
  assert.equal(game.bases.length, 2)
})

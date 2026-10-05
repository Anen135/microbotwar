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

test('collection respects distance, per-tick rate, balance and depletion', () => {
  const game = match({ resourceCount: 0 })
  const bot = game.bots[0]
  const resource = new Resource({ x: 126, y: 100, amount: 3 })
  game.resources.push(resource)
  assert.equal(game.collect(bot), false)
  resource.x = 125
  assert.equal(game.collect(bot), true)
  assert.equal(game.collect(bot), false)
  assert.equal(game.players[0].resources, 2)
  game.tick()
  game.collect(bot)
  assert.equal(game.players[0].resources, 3)
  game.tick()
  assert.equal(game.resources.length, 0)
})

test('spawn charges once, respects the cap and needs a living base', () => {
  const game = match({ maxBotsPerPlayer: 2 })
  const player = game.players[0]
  assert.equal(game.spawn(player), null)
  player.resources = 60
  assert.equal(game.spawn(player).ownerId, player.id)
  assert.equal(player.resources, 30)
  assert.equal(game.spawn(player), null)
  game.bots.pop()
  game.bases[0].hp = 0
  assert.equal(game.spawn(player), null)
  assert.equal(player.resources, 30)
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
  assert.equal(game.nearest(a, 'enemy'), null)
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
  assert.equal(game.nearest(a, 'enemy'), null)
  b.x = 350
  assert.equal(game.nearest(a, 'enemy'), b)
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

test('two built-in AIs finish matches across deterministic seeds', () => {
  for (const seed of [1, 2, 3]) {
    const game = match({}, seed)
    game.players.forEach(player => { player.control = 'ai' })
    for (let i = 0; i < 20000 && game.state === 'running'; i += 1) game.tick()
    assert.equal(game.state, 'finished', `seed ${seed}`)
    assert.ok(game.winnerId)
    assert.ok(game.bots.length > 0)
  }
})

test('the example DSL drives collection, spawning and combat to a winner', () => {
  const game = match({}, 7)
  const example = require('../scripting/example')
  game.players.forEach(player => game.applyProgram(player, example))
  let spawned = false
  for (let i = 0; i < 20000 && game.state === 'running'; i += 1) {
    game.tick()
    spawned ||= game.bots.length > 2
    assert.ok(game.players.every(player => !player.error && !player.limited))
  }
  assert.equal(spawned, true)
  assert.equal(game.state, 'finished')
  assert.ok(game.winnerId)
})

test('restart preserves players and programs, recreates entities and balances', () => {
  const game = match()
  const player = game.players[0]
  player.source = 'collect()'
  player.program = { example: true }
  player.resources = 100
  const oldBot = game.bots[0].id
  game.eliminate(game.players[1].id)
  game.restart()
  assert.equal(game.state, 'running')
  assert.equal(game.tickCount, 0)
  assert.equal(game.winnerId, null)
  assert.equal(player.resources, 0)
  assert.equal(player.source, 'collect()')
  assert.equal(game.bots[0].program, player.program)
  assert.notEqual(game.bots[0].id, oldBot)
  assert.equal(game.bases.length, 2)
})

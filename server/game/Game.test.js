const { test } = require('node:test')
const assert = require('node:assert/strict')
const Game = require('./Game')
const Resource = require('./Resource')

function setup(config) {
  const game = new Game(config)
  const player = game.addPlayer({ name: 'Alpha', color: '#4488ff', x: 100, y: 100 })
  return { game, player, bot: game.bots[0] }
}

test('players receive a base and bot with distinct IDs and the correct owner', () => {
  const { game, player, bot } = setup()
  const second = game.addPlayer({ name: 'Beta', color: '#ff8844', x: 1500, y: 800 })
  assert.equal(game.players.length, 2)
  assert.equal(game.bases.length, 2)
  assert.equal(game.bots.length, 2)
  assert.equal(game.bases[0].ownerId, player.id)
  assert.equal(bot.ownerId, player.id)
  assert.equal(game.bots[1].ownerId, second.id)
  assert.equal(new Set([...game.players, ...game.bases, ...game.bots].map(e => e.id)).size, 6)
  assert.deepEqual(player.resources, { metal: 30, energy: 20, silicon: 10 })
  assert.equal(player.alive, true)
  assert.equal(bot.hp, 100)
  assert.equal(game.bases[0].hp, 1000)
  assert.equal(new Resource({ x: 20, y: 30 }).amount, 20)
})

test('moveTo sets intent; ticks move at 80 units per simulated second', () => {
  const { game, bot } = setup()
  bot.moveTo(1000, 100)
  assert.equal(bot.x, 100)
  game.tick()
  assert.equal(bot.x, 108)
  for (let i = 0; i < 9; i += 1) game.tick()
  assert.equal(bot.x, 180)
  assert.equal(bot.y, 100)
})

test('diagonal movement has the same speed as horizontal movement', () => {
  const { game, bot } = setup()
  bot.moveTo(400, 500)
  game.tick()
  assert.ok(Math.abs(Math.hypot(bot.x - 100, bot.y - 100) - 8) < 1e-10)
  assert.ok(Math.abs(bot.x - 104.8) < 1e-10)
  assert.ok(Math.abs(bot.y - 106.4) < 1e-10)
})

test('a bot reaches a nearby target exactly and stays stopped', () => {
  const { game, bot } = setup()
  bot.moveTo(97, 96)
  game.tick()
  assert.equal(bot.target, null)
  for (let i = 0; i < 10; i += 1) game.tick()
  assert.deepEqual([bot.x, bot.y], [97, 96])
})

test('an idle bot and a target at its current position remain finite and stationary', () => {
  const { game, bot } = setup()
  game.tick()
  bot.moveTo(100, 100)
  game.tick()
  assert.deepEqual([bot.x, bot.y, bot.target], [100, 100, null])
})

test('a new movement command replaces the previous destination', () => {
  const { game, bot } = setup()
  bot.moveTo(1000, 100)
  game.tick()
  bot.moveTo(100, 100)
  game.tick()
  assert.deepEqual([bot.x, bot.y, bot.target], [100, 100, null])
})

test('destinations outside the map stop at the map boundaries', () => {
  const { game, bot } = setup({ mapWidth: 110, mapHeight: 110, botSpeed: 2000 })
  bot.moveTo(-50, 200)
  game.tick()
  assert.deepEqual([bot.x, bot.y, bot.target], [0, 110, null])
  bot.moveTo(200, -50)
  game.tick()
  assert.deepEqual([bot.x, bot.y, bot.target], [110, 0, null])
})

test('invalid coordinates do not corrupt movement or create partial players', () => {
  const { game, bot } = setup()
  bot.moveTo(200, 100)
  for (const value of [NaN, Infinity, -Infinity, '10', undefined]) {
    assert.throws(() => bot.moveTo(value, 0), TypeError)
    assert.throws(() => bot.moveTo(0, value), TypeError)
  }
  assert.deepEqual(bot.target, { x: 200, y: 100 })
  assert.throws(() => game.addPlayer({ x: -1, y: 0 }), RangeError)
  assert.equal(game.players.length, 1)
  assert.equal(game.bots.length, 1)
  assert.equal(game.bases.length, 1)
})

test('tick rate changes resolution without changing speed per second', () => {
  const { game, bot } = setup({ tickRate: 20 })
  bot.moveTo(1000, 100)
  for (let i = 0; i < 20; i += 1) game.tick()
  assert.equal(bot.x, 180)
  for (const config of [{ tickRate: 0 }, { mapWidth: -1 }, { botSpeed: NaN }]) {
    assert.throws(() => new Game(config), RangeError)
  }
})

test('the fixed loop starts once, stops cleanly and can resume', t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const { game, bot } = setup()
  t.after(() => game.stop())
  bot.moveTo(1000, 100)
  game.start()
  game.start()
  t.mock.timers.tick(1000)
  assert.equal(game.tickCount, 10)
  assert.equal(bot.x, 180)
  game.stop()
  game.stop()
  t.mock.timers.tick(1000)
  assert.equal(game.tickCount, 10)
  game.start()
  t.mock.timers.tick(100)
  assert.equal(game.tickCount, 11)
  assert.equal(bot.x, 188)
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const Game = require('../game/Game')
const Resource = require('../game/Resource')

test('the bundled miner example delivers cargo without exhausting CPU in a crowded match', async () => {
  const { botExample } = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/client/src/programDefaults.js')).href)
  const game = new Game({ resourceCount: 0 })
  const player = game.addPlayer({ name: 'A', color: 'blue', x: 100, y: 100 })
  game.addPlayer({ name: 'B', color: 'red', x: 1000, y: 100 })
  player.resources = { metal: 1000, energy: 1000, silicon: 1000 }
  game.applyProgram(player, botExample)
  for (let index = 0; index < 19; index += 1) game.spawn(player)
  for (let index = 0; index < 10; index += 1) {
    game.resources.push(new Resource({ x: 110 + index * 8, y: 100, amount: 200 }))
  }
  const startingStock = { ...player.resources }
  game.beginMatch()

  for (let tick = 0; tick < 500; tick += 1) {
    game.tick()
    assert.equal(player.error, null, `example errored on tick ${tick}`)
    assert.equal(player.limited, false, `example exhausted its operation budget on tick ${tick}`)
    assert.ok(game.bots.every(bot => bot.cpu <= bot.cpuBudget))
  }

  assert.ok(Object.keys(startingStock).some(type => player.resources[type] > startingStock[type]), 'at least one delivery reaches the base')
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const Game = require('../game/Game')

function network(withRelay) {
  const game = new Game({ resourceCount: 0, scriptOperationLimit: 1000 })
  const player = game.addPlayer({ name: 'Network', color: 'blue', x: 100, y: 100 })
  const opponent = game.addPlayer({ name: 'Other', color: 'red', x: 1500, y: 800 })
  const scoutSource = `for object in scan():
    if object.type == "bot" and object.ownerId == "${opponent.id}":
        send("sighting", {"x": object.x, "y": object.y})`
  game.applyProgram(player, scoutSource, 'scout')
  game.applyProgram(player, withRelay ? `def on_message(message):
    if message.channel == "sighting":
        send("order", message.payload)` : '', 'relay')
  game.applyProgram(player, `def on_message(message):
    if message.channel == "order":
        memory["target"] = message.payload
def on_tick():
    if memory["target"]:
        moveTo(memory["target"])`, 'fighter')
  player.resources = { metal: 1000, energy: 1000, silicon: 1000 }
  const scout = game.bots[0]
  scout.programId = 'scout'
  const relay = game.spawn(player, 'relay')
  const fighter = game.spawn(player, 'fighter')
  relay.x = 220
  fighter.x = 340
  for (const bot of [scout, relay, fighter]) {
    bot.visionRange = 80
    bot.communicationRange = 125
    bot.cpuBudget = 1000
  }
  const enemy = game.bots.find(bot => bot.ownerId === opponent.id)
  enemy.x = 100
  enemy.y = 150
  game.beginMatch()
  return { game, player, scout, relay, fighter, enemy }
}

test('a player-written relay protocol turns a local scout observation into a remote order', () => {
  const silent = network(false)
  const cooperating = network(true)
  for (let tick = 0; tick < 6; tick += 1) {
    silent.game.tick()
    cooperating.game.tick()
  }
  assert.equal(silent.fighter.x, 340)
  assert.equal(silent.fighter.memory.target, undefined)
  assert.deepEqual({ ...cooperating.fighter.memory.target }, { x: 100, y: 150 })
  assert.ok(cooperating.fighter.x < 340)
  assert.ok(cooperating.game.players.every(player => !player.error))
  assert.equal(cooperating.relay.x, 220)
  assert.equal(cooperating.scout.x, 100)
})

test('a receiver outside radio range cannot learn a scout observation without user forwarding', () => {
  const { game, player, fighter, relay } = network(true)
  relay.x = 800
  for (let tick = 0; tick < 6; tick += 1) game.tick()
  assert.equal(fighter.x, 340)
  assert.equal(fighter.memory.target, undefined)
  assert.equal(player.error, null)
})

test('only explicit sensor-driven user attacks can defeat an idle opponent', () => {
  const game = new Game({ resourceCount: 0, botDamage: 1000 })
  const attacker = game.addPlayer({ name: 'Programmed', color: 'blue', x: 100, y: 100 })
  const defender = game.addPlayer({ name: 'Idle', color: 'red', x: 110, y: 100 })
  game.applyProgram(attacker, `for object in scan():
    if object.ownerId == "${defender.id}":
        attack(object)`)
  game.beginMatch()
  for (let tick = 0; tick < 20 && game.state === 'running'; tick += 1) game.tick()
  assert.equal(attacker.error, null)
  assert.equal(game.state, 'finished')
  assert.equal(game.winnerId, attacker.id)
  assert.equal(game.bots[0].hp, game.bots[0].maxHp)
})

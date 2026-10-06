const { test } = require('node:test')
const assert = require('node:assert/strict')
const { snapshotFor, resetVisibility } = require('./visibility')

function fixture() {
  const game = {
    tickCount: 0, config: {},
    players: [
      { id: 'a', name: 'A', color: 'blue', alive: true, resources: { metal: 7 } },
      { id: 'b', name: 'B', color: 'red', alive: true, resources: { metal: 99 } },
    ],
    bots: [
      { id: 'own', ownerId: 'a', x: 0, y: 0, hp: 10, maxHp: 10, visionRange: 50, tags: { squad: 'alpha' } },
      { id: 'enemy', ownerId: 'b', x: 50, y: 0, hp: 10, maxHp: 10, visionRange: 5, tags: { secret: true }, cargo: { metal: 3 } },
    ],
    bases: [{ id: 'base', ownerId: 'b', x: 500, y: 0, hp: 10, visionRange: 5 }],
    resources: [{ id: 'ore', x: 51, y: 0, resourceType: 'metal', amount: 20 }],
    snapshot() { return { tick: this.tickCount, gameState: 'running', winnerId: null, config: this.config, players: this.players, bots: this.bots, bases: this.bases, resources: this.resources } },
  }
  return game
}

test('visibility filters exact sensor boundary, enemy stocks and private metadata', () => {
  const game = fixture()
  const state = snapshotFor(game, 'a')
  assert.equal(state.bots.length, 2)
  assert.equal(state.bases.length, 0)
  assert.equal(state.resources.length, 0)
  assert.deepEqual(state.bots[0].tags, { squad: 'alpha' })
  assert.equal(state.bots[1].tags, undefined)
  assert.equal(state.bots[1].cargo, undefined)
  assert.equal(state.players[1].resources, undefined)
  assert.equal(snapshotFor(game, 'b').bots.length, 1)
  assert.throws(() => snapshotFor(game, 'outsider'), /Unknown viewer/)
})

test('lastSeen freezes observed positions and disappears when old position is checked', () => {
  const game = fixture()
  snapshotFor(game, 'a')
  game.tickCount = 10
  game.bots[0].x = -100
  game.bots[1].x = 900
  game.bots[1].hp = 1
  const state = snapshotFor(game, 'a')
  assert.equal(state.bots.length, 1)
  assert.deepEqual(state.lastSeen.map(({ x, hp, lastSeenTick }) => ({ x, hp, lastSeenTick })), [{ x: 50, hp: 10, lastSeenTick: 0 }])
  game.bots[0].x = 0
  assert.equal(snapshotFor(game, 'a').lastSeen.length, 0)
})

test('history is isolated, bounded and cleared at restart', () => {
  const game = fixture()
  game.config.maxLastSeenEntries = 1
  game.resources[0].x = 1
  snapshotFor(game, 'a')
  game.bots[0].x = -100
  assert.equal(snapshotFor(game, 'a').lastSeen.length, 1)
  assert.equal(snapshotFor(game, 'b').lastSeen.length, 0)
  resetVisibility(game)
  assert.equal(snapshotFor(game, 'a').lastSeen.length, 0)
})

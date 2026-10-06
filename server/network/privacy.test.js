const { test } = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const { io } = require('socket.io-client')
const { createServer } = require('../app')

test('initial, edit-triggered and periodic socket states contain only that player observations', { timeout: 10000 }, async t => {
  const server = createServer({ gameConfig: { resourceCount: 0 } })
  server.httpServer.listen(0, '127.0.0.1')
  await once(server.httpServer, 'listening')
  const url = `http://127.0.0.1:${server.httpServer.address().port}`
  const clients = []
  t.after(async () => { clients.forEach(client => client.disconnect()); await server.close() })
  async function connect() {
    const client = io(url, { transports: ['websocket'], reconnection: false })
    clients.push(client)
    await once(client, 'connect')
    return client
  }
  const request = (socket, event, data = {}) => new Promise((resolve, reject) => {
    socket.timeout(2000).emit(event, data, (error, result) => error ? reject(error) : resolve(result))
  })
  const host = await connect()
  const guest = await connect()
  const created = await request(host, 'createRoom', { name: 'Alpha' })
  const code = created.room.code
  await request(guest, 'joinRoom', { name: 'Beta', code })
  await request(host, 'setReady', { ready: true })
  await request(guest, 'setReady', { ready: true })
  const firstHost = once(host, 'state')
  const firstGuest = once(guest, 'state')
  assert.equal((await request(host, 'startMatch')).ok, true)
  const [a] = await firstHost
  const [b] = await firstGuest
  const game = server.rooms.get(code).game
  game.stop()
  const player = game.players.find(item => item.name === 'Alpha')
  const enemy = game.players.find(item => item.name === 'Beta')
  const enemyBot = game.bots.find(item => item.ownerId === enemy.id)
  const ownBot = game.bots.find(item => item.ownerId === player.id)
  function privateView(state, viewer) {
    assert.equal(state.viewerId, viewer.id)
    assert.ok(state.bots.every(bot => bot.ownerId === viewer.id))
    assert.ok(state.bases.every(base => base.ownerId === viewer.id))
    assert.equal(state.players.find(item => item.id !== viewer.id).resources, undefined)
    assert.ok(!JSON.stringify(state).includes('private-marker'))
  }
  privateView(a, player)
  privateView(b, enemy)
  enemyBot.memory.secret = 'private-marker'
  const edited = once(host, 'state')
  await request(host, 'applyProgram', { programId: 'default', source: '' })
  privateView((await edited)[0], player)
  privateView((await once(host, 'state'))[0], player)
  const oldPosition = { x: enemyBot.x, y: enemyBot.y }
  enemyBot.x = ownBot.x - 20
  enemyBot.y = ownBot.y
  const [seen] = await once(host, 'state')
  assert.equal(seen.bots.find(bot => bot.id === enemyBot.id).x, enemyBot.x)
  assert.equal(seen.bots.find(bot => bot.id === enemyBot.id).memory, undefined)
  // Move the observer away so the last observed spot is now in fog.
  const observation = { x: enemyBot.x, y: enemyBot.y }
  ownBot.x = 800
  game.bases.find(base => base.ownerId === player.id).x = 800
  Object.assign(enemyBot, oldPosition)
  const [hidden] = await once(host, 'state')
  assert.equal(hidden.bots.some(bot => bot.id === enemyBot.id), false)
  const stale = hidden.lastSeen.find(bot => bot.id === enemyBot.id)
  assert.deepEqual({ x: stale.x, y: stale.y }, observation)
  assert.notEqual(stale.x, enemyBot.x)
})

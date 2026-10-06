const { test } = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const { io } = require('socket.io-client')
const { createServer } = require('../app')

async function fixture(t, options) {
  const server = createServer(options)
  server.httpServer.listen(0, '127.0.0.1')
  await once(server.httpServer, 'listening')
  const url = `http://127.0.0.1:${server.httpServer.address().port}`
  const clients = []
  t.after(async () => {
    for (const client of clients) client.disconnect()
    await server.close()
  })
  async function connect() {
    const client = io(url, { transports: ['websocket'], reconnection: false })
    clients.push(client)
    await once(client, 'connect')
    return client
  }
  return { server, url, connect }
}

function request(socket, event, data = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(2000).emit(event, data, (error, result) => error ? reject(error) : resolve(result))
  })
}

test('room lifecycle: authorization, readiness, sync, code application and restart', { timeout: 10000 }, async t => {
  const { server, url, connect } = await fixture(t, { gameConfig: { botCost: 17 } })
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { ok: true })
  const configResponse = await fetch(`${url}/api/config`)
  assert.equal(configResponse.status, 200)
  const publicConfig = await configResponse.json()
  assert.equal(publicConfig.botCost, 17)
  const host = await connect()
  const guest = await connect()
  const outsider = await connect()
  assert.equal((await request(host, 'createRoom', { name: '' })).ok, false)
  const created = await request(host, 'createRoom', { name: 'Host' })
  assert.equal(created.ok, true)
  const code = created.room.code
  assert.match(code, /^[A-Z]{4}$/)
  assert.equal((await request(guest, 'joinRoom', { name: 'Guest', code: code.toLowerCase() })).ok, true)
  assert.equal((await request(host, 'startMatch')).ok, false)
  assert.equal((await request(guest, 'startMatch')).ok, false)
  assert.equal((await request(outsider, 'applyProgram', { source: 'collect()' })).ok, false)
  await request(host, 'setReady', { ready: true })
  await request(guest, 'setReady', { ready: true })
  const hostState = once(host, 'state')
  const guestState = once(guest, 'state')
  assert.equal((await request(host, 'startMatch')).ok, true)
  const [first] = await hostState
  const [second] = await guestState
  assert.deepEqual(first, second)
  assert.deepEqual(first.config, publicConfig)
  assert.equal(first.gameState, 'running')
  assert.equal(first.players.length, 2)
  assert.equal(first.bots.length, 2)
  assert.equal(first.resources.length, 40)
  assert.equal((await request(outsider, 'joinRoom', { name: 'Late', code })).ok, false)
  const room = server.rooms.get(code)
  const hostPlayer = room.game.players.find(player => player.name === 'Host')
  const guestPlayer = room.game.players.find(player => player.name === 'Guest')
  const result = await request(host, 'applyProgram', { source: 'moveTo(100, 100)', playerId: guestPlayer.id })
  assert.equal(result.ok, true)
  assert.equal(hostPlayer.control, 'script')
  assert.equal(guestPlayer.control, 'ai')
  assert.equal((await request(host, 'applyProgram', { source: 'eval(1)' })).ok, false)
  assert.equal(hostPlayer.source, 'moveTo(100, 100)')
  assert.equal((await request(guest, 'restartMatch')).ok, false)
  const oldBot = room.game.bots[0].id
  assert.equal((await request(host, 'restartMatch')).ok, true)
  assert.notEqual(room.game.bots[0].id, oldBot)
  assert.equal(hostPlayer.source, 'moveTo(100, 100)')
  assert.equal(room.game.bots[0].program, hostPlayer.program)
  assert.equal((await request(host, 'useAI')).ok, true)
  assert.equal(hostPlayer.control, 'ai')
})

test('rooms stay isolated, host transfers, disconnect forfeits and empty rooms clean up', { timeout: 10000 }, async t => {
  const { server, connect } = await fixture(t)
  const host = await connect()
  const guest = await connect()
  const outsider = await connect()
  const { room } = await request(host, 'createRoom', { name: 'Host' })
  await request(guest, 'joinRoom', { name: 'Guest', code: room.code })
  const other = await request(outsider, 'createRoom', { name: 'Other' })
  assert.notEqual(room.code, other.room.code)
  let foreignState = false
  outsider.on('state', () => { foreignState = true })
  await request(host, 'setReady', { ready: true })
  await request(guest, 'setReady', { ready: true })
  await request(host, 'startMatch')
  await request(host, 'leaveRoom')
  const remaining = server.rooms.get(room.code)
  assert.equal(remaining.hostId, guest.id)
  assert.equal(remaining.game.state, 'finished')
  assert.equal(remaining.game.winnerId, remaining.members.get(guest.id).playerId)
  assert.equal(remaining.game.timer, null)
  assert.equal(foreignState, false)
  const disconnected = once(server.io.sockets.sockets.get(guest.id), 'disconnect')
  guest.disconnect()
  await disconnected
  assert.equal(server.rooms.has(room.code), false)
  assert.equal(server.rooms.size, 1)
})

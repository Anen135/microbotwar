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
  const { server, url, connect } = await fixture(t, { gameConfig: { spawnCost: { metal: 17, energy: 5, silicon: 0 } } })
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { ok: true })
  const configResponse = await fetch(`${url}/api/config`)
  assert.equal(configResponse.status, 200)
  const publicConfig = await configResponse.json()
  assert.equal(publicConfig.spawnCost.metal, 17)
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
  assert.notEqual(first.viewerId, second.viewerId)
  assert.ok(first.bots.every(bot => bot.ownerId === first.viewerId))
  assert.ok(second.bots.every(bot => bot.ownerId === second.viewerId))
  assert.deepEqual(first.config, publicConfig)
  assert.equal(first.gameState, 'running')
  assert.equal(first.players.length, 2)
  assert.equal(first.bots.length, 1)
  assert.ok(first.resources.length <= first.config.resourceCount)
  assert.equal((await request(outsider, 'joinRoom', { name: 'Late', code })).ok, false)
  const room = server.rooms.get(code)
  const hostPlayer = room.game.players.find(player => player.name === 'Host')
  const guestPlayer = room.game.players.find(player => player.name === 'Guest')
  const result = await request(host, 'applyProgram', { source: 'moveTo(100, 100)', playerId: guestPlayer.id })
  assert.equal(result.ok, true)
  assert.equal(hostPlayer.control, 'script')
  assert.equal(guestPlayer.control, 'manual')
  assert.equal((await request(host, 'applyProgram', { source: 'eval(1)' })).ok, false)
  assert.equal(hostPlayer.source, 'moveTo(100, 100)')
  assert.equal((await request(guest, 'restartMatch')).ok, false)
  const oldBot = room.game.bots[0].id
  assert.equal((await request(host, 'restartMatch')).ok, true)
  assert.notEqual(room.game.bots[0].id, oldBot)
  assert.equal(hostPlayer.source, 'moveTo(100, 100)')
  assert.equal(room.game.bots[0].programId, 'default')
  assert.equal(hostPlayer.programs.get('default').source, hostPlayer.source)
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

test('lobby accepts independent programs and Base Controller atomically and preserves them at start/restart', { timeout: 10000 }, async t => {
  const { server, connect } = await fixture(t)
  const host = await connect()
  const guest = await connect()
  const { room } = await request(host, 'createRoom', { name: 'Host' })
  assert.equal((await request(host, 'applyProgram', { programId: 'hauler', source: 'pass', design: { cargo: 1 } })).ok, true)
  const baseSource = 'def on_tick():\n    if count("hauler") < 1:\n        spawn("hauler", {"role": "miner"})'
  assert.equal((await request(host, 'applyBaseProgram', { source: baseSource })).ok, true)
  assert.equal((await request(host, 'applyBaseProgram', { source: 'eval(1)' })).ok, false)
  assert.equal((await request(host, 'applyProgram', { programId: 'hauler', source: 'moveTo(0,0)', design: { cargo: 11 } })).ok, false)
  await request(guest, 'joinRoom', { name: 'Guest', code: room.code })
  await request(host, 'setReady', { ready: true })
  await request(guest, 'setReady', { ready: true })
  await request(host, 'startMatch')
  const game = server.rooms.get(room.code).game
  game.stop()
  const player = game.players.find(player => player.name === 'Host')
  assert.equal(player.baseSource, baseSource)
  assert.equal(player.programs.get('hauler').source, 'pass')
  assert.equal(player.programs.get('hauler').design.cargo, 1)
  game.tick()
  assert.equal(game.bots.filter(bot => bot.programId === 'hauler').length, 1)
  assert.equal(game.bots.find(bot => bot.programId === 'hauler').tags.role, 'miner')
  const snapshot = JSON.stringify(game.snapshot())
  assert.equal(snapshot.includes(baseSource), false)
  await request(host, 'restartMatch')
  game.stop()
  assert.equal(player.baseSource, baseSource)
  assert.equal(game.bots.filter(bot => bot.programId === 'hauler').length, 0)
})

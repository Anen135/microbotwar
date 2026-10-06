const { randomInt } = require('node:crypto')
const Game = require('../game/Game')
const { ProgramRegistry } = require('../scripting/ProgramRegistry')
const { compile } = require('../scripting/Interpreter')

const colors = ['#72b7ff', '#ffad70', '#da9bff', '#ffe17a', '#fb8ab2', '#80ddca', '#b7dc76', '#c2c9ff']

function attachRooms(io, { gameConfig = {} } = {}) {
  const config = new Game(gameConfig).config
  const rooms = new Map()
  function publicRoom(room) {
    return {
      code: room.code, hostId: room.hostId, status: room.game?.state ?? 'lobby',
      members: [...room.members.values()].map(({ id, name, ready, color, playerId }) => ({ id, name, ready, color, playerId })),
    }
  }
  function sendState(room) {
    for (const member of room.members.values()) {
      io.to(member.id).emit('state', room.game.snapshotFor(member.playerId))
    }
  }
  function broadcast(room) {
    io.to(room.code).emit('room', publicRoom(room))
    if (room.game) sendState(room)
  }
  function getRoom(socket) {
    const room = rooms.get(socket.data.roomCode)
    if (!room || !room.members.has(socket.id)) throw new Error('Сначала войдите в комнату')
    return room
  }
  function requireHost(socket, room) {
    if (room.hostId !== socket.id) throw new Error('Это действие доступно только хосту')
  }
  function nameFrom(data) {
    if (typeof data?.name !== 'string' || !data.name.trim() || data.name.trim().length > 24) throw new Error('Введите имя длиной от 1 до 24 символов')
    return data.name.trim()
  }
  function addMember(socket, room, name) {
    if (socket.data.roomCode) throw new Error('Вы уже в комнате')
    if (room.game) throw new Error('Матч уже начался')
    if (room.members.size >= config.maxPlayers) throw new Error('Комната заполнена')
    const color = colors.find(color => ![...room.members.values()].some(member => member.color === color))
    room.members.set(socket.id, {
      id: socket.id, name, ready: false, color, playerId: null,
      programs: new ProgramRegistry(config), baseSource: '', baseProgram: compile(''),
    })
    socket.data.roomCode = room.code
    socket.join(room.code)
    broadcast(room)
    return { room: publicRoom(room), source: '' }
  }
  function leave(socket) {
    const room = rooms.get(socket.data.roomCode)
    if (!room) return
    const member = room.members.get(socket.id)
    if (room.game && member?.playerId) room.game.eliminate(member.playerId)
    room.members.delete(socket.id)
    socket.leave(room.code)
    socket.data.roomCode = null
    if (!room.members.size) { room.game?.stop(); rooms.delete(room.code) }
    else {
      if (room.hostId === socket.id) room.hostId = room.members.keys().next().value
      broadcast(room)
    }
  }
  function start(socket, restart = false) {
    const room = getRoom(socket)
    requireHost(socket, room)
    if (room.members.size < 2) throw new Error('Нужны хотя бы два игрока')
    if (restart) {
      if (!room.game) throw new Error('Матч ещё не начался')
      room.game.players = room.game.players.filter(player => [...room.members.values()].some(member => member.playerId === player.id))
      room.game.restart()
    } else {
      if (room.game) throw new Error('Матч уже начался')
      if (![...room.members.values()].every(member => member.ready)) throw new Error('Все игроки должны подтвердить готовность')
      room.game = new Game(config)
      for (const member of room.members.values()) {
        const player = room.game.addPlayer({ name: member.name, color: member.color, x: 0, y: 0 })
        member.playerId = player.id
        player.programs = member.programs
        player.baseProgram = member.baseProgram
        player.baseSource = member.baseSource
        player.source = member.programs.get('default').source
        if (player.source || player.baseSource || player.programs.programs.size > 1) player.control = 'script'
      }
      room.game.restart()
    }
    room.game.start()
    broadcast(room)
    return { room: publicRoom(room) }
  }

  io.on('connection', socket => {
    let windowStart = Date.now()
    let events = 0
    function handle(event, action) {
      socket.on(event, (data, acknowledge) => {
        const reply = typeof acknowledge === 'function' ? acknowledge : () => {}
        try {
          if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); events = 0 }
          if (++events > 20) throw new Error('Слишком много команд; подождите секунду')
          reply({ ok: true, ...action(data) })
        } catch (error) { reply({ ok: false, error: error.message }) }
      })
    }
    handle('createRoom', data => {
      const name = nameFrom(data)
      if (socket.data.roomCode) throw new Error('Вы уже в комнате')
      if (rooms.size >= 100) throw new Error('Сервер заполнен')
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
      let code
      do { code = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('') } while (rooms.has(code))
      const room = { code, hostId: socket.id, members: new Map(), game: null }
      rooms.set(code, room)
      return addMember(socket, room, name)
    })
    handle('joinRoom', data => {
      const name = nameFrom(data)
      const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : ''
      const room = rooms.get(code)
      if (!room) throw new Error('Комната не найдена')
      return addMember(socket, room, name)
    })
    handle('leaveRoom', () => { leave(socket); return {} })
    handle('setReady', data => {
      const room = getRoom(socket)
      if (room.game) throw new Error('Матч уже начался')
      if (typeof data?.ready !== 'boolean') throw new Error('Некорректная готовность')
      room.members.get(socket.id).ready = data.ready
      broadcast(room)
      return {}
    })
    handle('startMatch', () => start(socket))
    handle('restartMatch', () => start(socket, true))
    handle('applyProgram', data => {
      const room = getRoom(socket)
      const member = room.members.get(socket.id)
      const player = room.game?.players.find(player => player.id === member.playerId)
      const entry = player
        ? room.game.applyProgram(player, data?.source, data?.programId ?? 'default', data?.design)
        : member.programs.apply(data?.programId ?? 'default', data?.source, data?.design)
      broadcast(room)
      return { programId: entry.programId, source: entry.source, design: entry.design }
    })
    handle('applyBaseProgram', data => {
      const room = getRoom(socket)
      const member = room.members.get(socket.id)
      const player = room.game?.players.find(player => player.id === member.playerId)
      const program = compile(data?.source)
      if (player) room.game.applyBaseProgram(player, data.source)
      member.baseProgram = program
      member.baseSource = data.source
      broadcast(room)
      return { source: data.source }
    })
    socket.on('disconnect', () => leave(socket))
  })
  const interval = setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.game) continue
      sendState(room)
      io.to(room.code).emit('room', publicRoom(room))
      for (const member of room.members.values()) {
        const player = room.game.players.find(player => player.id === member.playerId)
        if (player) io.to(member.id).emit('debug', player.debug ?? { programId: 'default', entityId: null, error: player.error, cpu: player.cpu, limited: player.limited ?? false })
      }
    }
  }, 100)
  return { rooms, config, close() {
    clearInterval(interval)
    for (const room of rooms.values()) room.game?.stop()
    rooms.clear()
  } }
}

module.exports = { attachRooms }

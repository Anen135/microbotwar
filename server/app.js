const path = require('node:path')
const http = require('node:http')
const express = require('express')
const { Server } = require('socket.io')
const { attachRooms } = require('./network/rooms')

function createServer(options = {}) {
  const app = express()
  const httpServer = http.createServer(app)
  const io = new Server(httpServer, { maxHttpBufferSize: 16384 })
  const manager = attachRooms(io, options)
  app.get('/health', (_request, response) => response.json({ ok: true }))
  app.use(express.static(path.join(__dirname, '../frontend/client/dist')))
  app.get('/', (_request, response) => response.status(503).send('Build the client first: cd frontend/client && npm run build'))
  return {
    httpServer,
    io,
    rooms: manager.rooms,
    close() {
      manager.close()
      return new Promise(resolve => io.close(resolve))
    },
  }
}

module.exports = { createServer }

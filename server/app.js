const path = require('node:path')
const http = require('node:http')
const express = require('express')
const { Server } = require('socket.io')
const { attachRooms } = require('./network/rooms')
const defaults = require('./game/config')

function createServer(options = {}) {
  const app = express()
  const httpServer = http.createServer(app)
  const io = new Server(httpServer, { maxHttpBufferSize: 16384 })
  const manager = attachRooms(io, options)
  app.get('/health', (_request, response) => response.json({ ok: true }))
  app.get('/api/config', (_request, response) => response.json({ ...defaults, ...options.gameConfig }))
  app.use(express.static(path.join(__dirname, '../frontend/client/dist')))
  app.get(['/', '/how-to-play', '/reference'], (_request, response) => {
    response.sendFile(path.join(__dirname, '../frontend/client/dist/index.html'), error => {
      if (error && !response.headersSent) response.status(503).send('Build the client first: cd frontend/client && npm run build')
    })
  })
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

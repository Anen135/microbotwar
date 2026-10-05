const { createServer } = require('./app')

const server = createServer()
const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '127.0.0.1'
server.httpServer.listen(port, host, () => {
  console.log(`Microbots Arena: http://${host}:${port}`)
})
server.httpServer.on('error', error => {
  console.error(error.message)
  server.close().finally(() => { process.exitCode = 1 })
})
process.once('SIGINT', () => server.close())
process.once('SIGTERM', () => server.close())

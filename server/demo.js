const Game = require('./game/Game')

// Stage 1 demo: run the simulation without a browser or network layer.
const game = new Game()
game.addPlayer({ name: 'Alpha', color: '#4488ff', x: 100, y: 100 })
game.addPlayer({ name: 'Beta', color: '#ff8844', x: 1500, y: 800 })
game.bots[0].moveTo(260, 100)
game.bots[1].moveTo(1340, 800)

function report() {
  const positions = game.bots.map(bot => `(${bot.x.toFixed(1)}, ${bot.y.toFixed(1)})`)
  console.log(`Tick ${game.tickCount}: ${positions.join(' | ')}`)
}

console.log('Core simulation: 10 ticks/sec, 80 units/sec; two bots move 160 units.')
report()
game.start()
const reporter = setInterval(() => {
  report()
  if (game.bots.every(bot => bot.target === null)) {
    shutdown()
    console.log('Checkpoint 1 complete: both bots reached their destinations.')
  }
}, 500)

function shutdown() {
  game.stop()
  clearInterval(reporter)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { compile, run } = require('./Interpreter')
const { definitions } = require('./Api')
const example = require('./example')
const Game = require('../game/Game')

test('expressions, assignments, nested conditions and comments select the right branch', () => {
  const movements = []
  const program = compile(`# comment
x = 2 + 3 * 4
if x == 14 and not false:
    if (x / 2) >= 7:
        moveTo(x, -3 + 5)
    else:
        moveTo(0, 0)
else:
    moveTo(1, 1)`)
  const result = run(program, { moveTo: (...args) => movements.push(args) })
  assert.equal(result.error, null)
  assert.deepEqual(movements, [[14, 2]])
})

test('and/or short circuit protects missing targets; variables reset every execution', () => {
  let called = false
  const result = run(compile('if false and distance(null) > 0:\n    collect()\nx = true or missing'), {
    distance: () => { called = true },
  })
  assert.equal(result.error, null)
  assert.equal(called, false)
  assert.match(run(compile('x = x + 1'), {}).error, /Unknown variable "x"/)
})

test('malformed code, arbitrary JS and host access are rejected', () => {
  for (const source of [
    'eval(1)', 'require(1)', 'process.exit()', 'x = globalThis.process', 'x = [1]',
    'while true:\n    collect()', 'if true:\ncollect()', 'else:\n    collect()',
    'collect(1)', 'moveTo()', 'if true:\n\tcollect()', 'x = (1', 'x = 1 @ 2',
    'x = ' + '('.repeat(40) + '1' + ')'.repeat(40), 'x'.repeat(8001),
    Array(202).fill('collect()').join('\n'), 'constructor()',
  ]) assert.throws(() => compile(source), undefined, source.slice(0, 60))
  assert.match(run(compile('x = process'), {}).error, /Unknown variable/)
  assert.match(run(compile('x = 1 / 0'), {}).error, /finite number/)
  assert.match(run(compile('x = 1 + null'), {}).error, /finite number/)
})

test('errors identify source lines and suggest known function names', () => {
  assert.throws(() => compile('# a comment\nattak(null)'), /Line 2.*Did you mean "attack"/)
  const result = run(compile('x = 1\ny = unknown'), {})
  assert.match(result.error, /Line 2/)
})

test('operation budget stops calls and starts fresh on the next run', () => {
  let calls = 0
  const program = compile(Array(100).fill('collect()').join('\n'))
  const functions = { collect: () => { calls += 1 } }
  const result = run(program, functions, 10)
  assert.equal(result.limited, true)
  assert.ok(result.cpu <= 10)
  assert.equal(calls, 3)
  run(program, functions, 10)
  assert.equal(calls, 6)
})

function gameWithPlayers() {
  const game = new Game({ resourceCount: 0 })
  game.addPlayer({ name: 'A', color: 'blue', x: 100, y: 100 })
  game.addPlayer({ name: 'B', color: 'red', x: 1000, y: 100 })
  game.beginMatch()
  return game
}

test('apply updates all bots and future spawns; invalid edits preserve the working program', () => {
  const game = gameWithPlayers()
  const player = game.players[0]
  game.applyProgram(player, 'moveTo(200, 100)')
  const program = player.program
  assert.throws(() => game.applyProgram(player, 'eval(1)'))
  assert.equal(player.program, program)
  game.tick()
  assert.equal(game.bots[0].x, 108)
  player.resources = 30
  assert.equal(game.spawn(player).program, program)
})

test('a runtime error cancels actions for that bot without stopping other players', () => {
  const game = gameWithPlayers()
  game.applyProgram(game.players[0], 'moveTo(500, 100)\nx = 1 / 0')
  game.applyProgram(game.players[1], 'moveTo(900, 100)')
  game.tick()
  assert.equal(game.bots[0].x, 100)
  assert.equal(game.bots[0].target, null)
  assert.equal(game.bots[1].x, 992)
  assert.match(game.players[0].error, /Line 2/)
  assert.equal(game.state, 'running')
  game.applyProgram(game.players[0], 'moveTo(200, 100)')
  game.tick()
  assert.equal(game.players[0].error, null)
  assert.equal(game.bots[0].x, 108)
})

test('default program compiles, runs within budget, and snapshots exclude source/AST', () => {
  const game = gameWithPlayers()
  game.applyProgram(game.players[0], example)
  game.tick()
  assert.equal(game.players[0].error, null)
  assert.equal(game.players[0].limited, false)
  assert.ok(game.players[0].cpu > 0)
  const snapshot = game.snapshot()
  assert.equal(snapshot.players[0].program, undefined)
  assert.equal(snapshot.players[0].source, undefined)
  assert.equal(snapshot.bots[0].program, undefined)
  assert.ok(Object.keys(definitions).length > 10)
})

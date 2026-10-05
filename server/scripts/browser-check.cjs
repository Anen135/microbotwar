const assert = require('node:assert/strict')
const { once } = require('node:events')
const { mkdirSync, existsSync } = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const { createServer } = require('../app')

async function main() {
  if (!existsSync(path.join(__dirname, '../../frontend/client/dist/index.html'))) {
    throw new Error('Build the frontend first: cd frontend/client && npm run build')
  }
  const artifacts = path.join(__dirname, '../../artifacts')
  mkdirSync(artifacts, { recursive: true })
  const server = createServer()
  server.httpServer.listen(0, '127.0.0.1')
  await once(server.httpServer, 'listening')
  const url = `http://127.0.0.1:${server.httpServer.address().port}`
  let browser
  try {
    // Uses an installed Edge by default. Set BROWSER_CHANNEL=chromium after
    // `npx playwright install chromium` on machines without Edge.
    const channel = process.env.BROWSER_CHANNEL || 'msedge'
    browser = await chromium.launch({ channel, headless: true })
    const host = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const guest = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    for (const page of [host, guest]) {
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.goto(url)
      await page.getByText('Сервер подключён', { exact: true }).waitFor()
    }
    await host.getByLabel('Имя', { exact: true }).fill('Alpha')
    await host.getByRole('button', { name: 'Создать комнату', exact: true }).click()
    await host.getByTestId('room-code').waitFor()
    const code = await host.getByTestId('room-code').innerText()
    await guest.getByLabel('Имя', { exact: true }).fill('Beta')
    await guest.getByLabel('Код комнаты', { exact: true }).fill(code)
    await guest.getByRole('button', { name: 'Войти', exact: true }).click()
    await guest.getByTestId('room-code').waitFor()
    assert.equal(await host.getByRole('button', { name: 'Начать матч', exact: true }).isDisabled(), true)
    await host.getByRole('button', { name: 'Готов', exact: true }).click()
    await guest.getByRole('button', { name: 'Готов', exact: true }).click()
    await host.getByRole('button', { name: 'Начать матч', exact: true }).click()
    await host.locator('canvas').waitFor()
    await guest.locator('canvas').waitFor()
    const room = server.rooms.get(code)
    const game = room.game
    await host.waitForFunction(() => Number(document.querySelector('[data-testid="tick"]').textContent.match(/\d+/)[0]) >= 3)
    const source = host.getByLabel('Код программы', { exact: true })
    await source.fill('attak(null)')
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByRole('alert').filter({ hasText: 'Unknown function' }).waitFor()
    await source.fill('moveTo(800, 450)')
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByText('Программа применена ко всем вашим ботам, включая новых.', { exact: true }).waitFor()
    const player = game.players.find(player => player.name === 'Alpha')
    assert.equal(player.source, 'moveTo(800, 450)')
    assert.equal(player.control, 'script')
    await source.fill('x = 1 / 0')
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByRole('alert').filter({ hasText: 'Expected a finite number' }).waitFor()
    assert.equal(game.state, 'running')
    await host.getByRole('button', { name: 'Включить AI', exact: true }).click()
    await host.getByText('Ботами управляет встроенный AI.', { exact: true }).waitFor()
    game.stop()
    for (const page of [host, guest]) {
      await page.waitForFunction(tick => document.querySelector('[data-testid="tick"]').textContent.startsWith(`Тик ${tick} ·`), game.tickCount)
    }
    assert.equal(await host.locator('canvas').evaluate(canvas => canvas.toDataURL()), await guest.locator('canvas').evaluate(canvas => canvas.toDataURL()))
    await host.screenshot({ path: path.join(artifacts, 'match.png'), fullPage: true })
    // Advance the real simulation faster than wall time; victory still comes from combat.
    for (let i = 0; i < 30000 && game.state === 'running'; i += 1) game.tick()
    assert.equal(game.state, 'finished')
    assert.ok(game.winnerId)
    for (const page of [host, guest]) await page.getByRole('heading', { name: /^Победитель:/ }).waitFor()
    await host.screenshot({ path: path.join(artifacts, 'victory.png'), fullPage: true })
    const oldBot = game.bots[0].id
    await host.getByRole('button', { name: 'Перезапустить матч', exact: true }).click()
    await host.getByRole('heading', { name: /^Победитель:/ }).waitFor({ state: 'hidden' })
    assert.equal(game.state, 'running')
    assert.notEqual(game.bots[0].id, oldBot)
    assert.equal(player.source, 'x = 1 / 0')
    assert.equal(game.bots[0].program, player.program)
    await guest.getByRole('button', { name: 'Выйти', exact: true }).click()
    await host.getByRole('heading', { name: 'Победитель: Alpha', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('Browser check passed: two isolated clients, lobby, synchronized canvas, Apply/errors, AI victory, restart and leave. No browser errors.')
    console.log(`Screenshots: ${artifacts}`)
  } finally {
    await browser?.close()
    await server.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })

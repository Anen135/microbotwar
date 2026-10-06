const assert = require('node:assert/strict')
const { once } = require('node:events')
const { mkdirSync, existsSync } = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const { createServer } = require('../app')

async function until(check, description) {
  const deadline = Date.now() + 5000
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`)
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

async function main() {
  assert.ok(existsSync(path.join(__dirname, '../../frontend/client/dist/index.html')), 'Build the frontend first')
  const artifacts = path.join(__dirname, '../../artifacts')
  mkdirSync(artifacts, { recursive: true })
  const server = createServer({ gameConfig: { resourceCount: 0 } })
  server.httpServer.listen(0, '127.0.0.1')
  await once(server.httpServer, 'listening')
  const url = `http://127.0.0.1:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true })
    const host = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const guest = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    for (const page of [host, guest]) {
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.goto(url)
      await page.locator('.connection.online').waitFor()
    }
    await host.locator('#player-name').fill('Alpha')
    await host.locator('.create-button').click()
    await host.getByTestId('room-code').waitFor()
    const code = await host.getByTestId('room-code').innerText()
    await guest.locator('#player-name').fill('Beta')
    await guest.locator('#room-input').fill(code)
    await guest.locator('.entry-form button[type="submit"]').click()
    await guest.getByTestId('room-code').waitFor()
    await host.locator('.room-actions button').nth(0).click()
    await guest.locator('.room-actions button').nth(0).click()
    await host.locator('.room-actions button').nth(1).click()
    for (const page of [host, guest]) await page.locator('canvas').waitFor()
    const game = server.rooms.get(code).game
    game.stop()
    const player = game.players.find(item => item.name === 'Alpha')
    const enemy = game.players.find(item => item.name === 'Beta')
    const initial = game.bots.find(bot => bot.ownerId === player.id)
    const position = [initial.x, initial.y]
    for (let i = 0; i < 20; i += 1) game.tick()
    assert.deepEqual([initial.x, initial.y], position)
    assert.equal(game.bots.length, 2)

    const source = host.locator('#bot-source')
    async function apply(text) {
      await source.fill(text)
      await host.locator('.apply-button').click()
      await host.locator('.apply-button').waitFor({ state: 'visible' })
    }
    await apply('attak(null)')
    await host.getByRole('alert').filter({ hasText: 'Unknown function' }).waitFor()
    assert.equal(player.programs.get('default').source, '')
    await apply('memory["ticks"] = (memory["ticks"] or 0) + 1')
    await until(() => player.programs.get('default').source.includes('ticks'), 'apply default')
    game.tick()
    game.tick()
    assert.equal(initial.memory.ticks, 2)
    assert.deepEqual([initial.x, initial.y], position)

    await host.locator('#program-name').fill('miner')
    await host.locator('.program-create button').click()
    await host.locator('#design-cargo').fill('3')
    await apply('memory["role"] = "miner"')
    await until(() => player.programs.get('miner')?.source.includes('miner'), 'register miner')
    assert.equal(player.programs.get('miner').design.cargo, 3)
    await host.locator('#program-name').fill('scout')
    await host.locator('.program-create button').click()
    await host.locator('#design-vision').fill('3')
    await apply('def on_tick():\n    moveTo(800, 450)')
    await until(() => player.programs.get('scout')?.source.includes('moveTo'), 'register scout')
    await host.locator('#program-select').selectOption('miner')
    assert.equal(await source.inputValue(), 'memory["role"] = "miner"')
    assert.equal(await host.locator('#design-cargo').inputValue(), '3')
    await source.fill('# unsaved miner draft')
    await host.locator('#program-select').selectOption('scout')
    assert.equal(await host.locator('#design-vision').inputValue(), '3')
    await host.locator('#program-select').selectOption('miner')
    assert.equal(await source.inputValue(), '# unsaved miner draft')

    player.resources = { metal: 1000, energy: 1000, silicon: 1000 }
    await host.locator('#program-select').selectOption('@base')
    await apply('if count("miner") < 2:\n    spawn("miner", {"squad": "supply"})\nelif count("scout") < 1:\n    spawn("scout")')
    await until(() => player.baseSource?.includes('supply'), 'apply base controller')
    for (let i = 0; i < 5; i += 1) game.tick()
    const miners = game.bots.filter(bot => bot.ownerId === player.id && bot.programId === 'miner')
    assert.equal(miners.length, 2)
    assert.ok(miners.every(bot => bot.tags.squad === 'supply' && bot.memory.role === 'miner'))
    assert.equal(game.bots.filter(bot => bot.ownerId === player.id && bot.programId === 'scout').length, 1)
    assert.equal(game.bots.filter(bot => bot.ownerId === enemy.id).length, 1)
    await host.waitForFunction(() => document.querySelectorAll('#inspect-bot option').length === 4)
    const mine = game.snapshotFor(player.id)
    const theirs = game.snapshotFor(enemy.id)
    assert.ok(mine.bots.every(bot => bot.ownerId === player.id))
    assert.ok(theirs.bots.every(bot => bot.ownerId === enemy.id))
    assert.equal(mine.players.find(item => item.id === enemy.id).resources, undefined)
    await host.waitForFunction(tick => Number(document.querySelector('[data-testid="tick"]').textContent.match(/\d+/)[0]) === tick, game.tickCount)
    await guest.waitForFunction(tick => Number(document.querySelector('[data-testid="tick"]').textContent.match(/\d+/)[0]) === tick, game.tickCount)
    const canvases = await Promise.all([host, guest].map(page => page.locator('canvas').evaluate(canvas => canvas.toDataURL())))
    assert.notEqual(canvases[0], canvases[1], 'Each client must render its own view')
    await host.screenshot({ path: path.join(artifacts, 'programmable-agents.png'), fullPage: true })
    await guest.screenshot({ path: path.join(artifacts, 'fog-opponent.png'), fullPage: true })

    for (const width of [1024, 1280, 1440]) {
      await host.setViewportSize({ width, height: 1000 })
      const layout = await host.evaluate(() => {
        const canvas = document.querySelector('canvas')
        const rect = canvas.getBoundingClientRect()
        return { overflow: document.documentElement.scrollWidth > innerWidth, ratio: Math.abs(rect.width / rect.height - canvas.width / canvas.height) }
      })
      assert.equal(layout.overflow, false, `overflow at ${width}`)
      assert.ok(layout.ratio < 0.01)
    }
    for (const route of ['/reference', '/how-to-play']) {
      await host.locator(`.top-nav a[href="${route}"]`).click()
      await host.locator('[data-page-title]').waitFor()
    }
    await host.locator('.top-nav a[href="/"]').click()
    await host.locator('#program-select').selectOption('miner')
    assert.equal(await source.inputValue(), '# unsaved miner draft')
    await host.locator('#program-select').selectOption('default')
    await apply('')
    await until(() => player.programs.get('default').source === '', 'empty program')
    game.tick()
    assert.deepEqual([initial.x, initial.y], position)
    assert.equal(game.bots.find(bot => bot.ownerId === enemy.id).memory && Object.keys(game.bots.find(bot => bot.ownerId === enemy.id).memory).length, 0)

    const oldId = initial.id
    await host.locator('.room-actions button').nth(0).click()
    await until(() => game.bots[0].id !== oldId, 'restart')
    game.stop()
    assert.equal(player.programs.get('miner').design.cargo, 3)
    assert.ok(player.baseSource.includes('supply'))
    await guest.locator('.room-actions button.quiet').click()
    await until(() => game.state === 'finished', 'leave ends match')
    assert.equal(game.winnerId, player.id)
    assert.deepEqual(errors, [])
    console.log('Browser PASS: idle empty programs, compilation, per-program drafts/designs, memory, base production, tags, private fog views, layout, help navigation, restart and leave; no browser errors.')
    console.log(`Screenshots: ${artifacts}`)
  } finally {
    await browser?.close()
    await server.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })

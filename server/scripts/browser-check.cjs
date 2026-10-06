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
      // Pixel polling can switch a canvas from GPU to CPU midway through a test.
      // Use the same backend in both contexts for exact image comparison.
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (kind, options) {
          return getContext.call(this, kind, kind === '2d' ? { ...options, willReadFrequently: true } : options)
        }
      })
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.goto(url)
      await page.getByText('Сервер подключён', { exact: true }).waitFor()
    }
    await host.screenshot({ path: path.join(artifacts, 'redesign-welcome.png'), fullPage: true })
    await host.setViewportSize({ width: 1024, height: 900 })
    assert.equal(await host.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await host.screenshot({ path: path.join(artifacts, 'redesign-welcome-1024.png'), fullPage: true })
    await host.setViewportSize({ width: 1440, height: 1000 })
    for (const [route, title] of [['/how-to-play', 'Как играть'], ['/reference', 'Справочник']]) {
      const response = await host.goto(url + route)
      assert.equal(response.status(), 200)
      await host.getByRole('heading', { name: title, exact: true }).waitFor()
      await host.reload()
      await host.getByRole('heading', { name: title, exact: true }).waitFor()
      if (route === '/reference') {
        await host.locator('.parameter-grid').waitFor()
        assert.equal(await host.locator('.parameter-grid dd').first().innerText(), '1600 × 900')
      }
      for (const width of [1024, 1440]) {
        await host.setViewportSize({ width, height: 1000 })
        assert.equal(await host.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
      await host.screenshot({ path: path.join(artifacts, route.slice(1) + '.png'), fullPage: true })
    }
    await host.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Арена', exact: true }).click()
    await host.getByText('Сервер подключён', { exact: true }).waitFor()
    await host.getByLabel('Имя', { exact: true }).fill('Alpha')
    await host.getByRole('button', { name: 'Создать комнату', exact: true }).click()
    await host.getByTestId('room-code').waitFor()
    const code = await host.getByTestId('room-code').innerText()
    await host.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await host.getByRole('button', { name: 'Скопировать код комнаты', exact: true }).click()
    assert.equal(await host.evaluate(() => navigator.clipboard.readText()), code)
    await guest.getByLabel('Имя', { exact: true }).fill('Beta')
    await guest.getByLabel('Код комнаты', { exact: true }).fill(code)
    await guest.getByRole('button', { name: 'Войти', exact: true }).click()
    await guest.getByTestId('room-code').waitFor()
    await host.screenshot({ path: path.join(artifacts, 'redesign-lobby.png'), fullPage: true })
    assert.equal(await host.getByRole('button', { name: 'Начать матч', exact: true }).isDisabled(), true)
    await host.getByRole('button', { name: 'Готов', exact: true }).click()
    await guest.getByRole('button', { name: 'Готов', exact: true }).click()
    await host.getByRole('button', { name: 'Начать матч', exact: true }).click()
    await host.locator('canvas').waitFor()
    await guest.locator('canvas').waitFor()
    const room = server.rooms.get(code)
    const game = room.game
    await host.waitForFunction(() => Number(document.querySelector('[data-testid="tick"]').textContent.match(/\d+/)[0]) >= 3)
    await host.screenshot({ path: path.join(artifacts, 'redesign-arena.png'), fullPage: true })
    const source = host.getByLabel('Код программы', { exact: true })
    await source.fill('attak(null)')
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByRole('alert').filter({ hasText: 'Unknown function' }).waitFor()
    await host.getByRole('button', { name: 'Перейти к строке', exact: true }).click()
    assert.equal(await source.evaluate(input => input.value.slice(input.selectionStart, input.selectionEnd)), 'attak(null)')
    await source.fill('moveTo(800, 450)')
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByText('Программа применена ко всем вашим ботам, включая новых.', { exact: true }).waitFor()
    const player = game.players.find(player => player.name === 'Alpha')
    assert.equal(player.source, 'moveTo(800, 450)')
    assert.equal(player.control, 'script')
    await source.fill('x = 1\ny = missing')
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByRole('alert').filter({ hasText: 'Unknown variable "missing"' }).waitFor()
    await host.getByText('Строка 2', { exact: true }).waitFor()
    await host.getByRole('button', { name: 'Перейти к строке', exact: true }).click()
    assert.equal(await source.evaluate(input => input.value.slice(input.selectionStart, input.selectionEnd)), 'y = missing')
    await source.fill('# changed draft\nx = 1\ny = missing')
    await host.getByText('Ошибка в применённой версии программы. Текст в редакторе уже изменён.', { exact: true }).waitFor()
    assert.equal(await host.getByRole('button', { name: 'Перейти к строке', exact: true }).count(), 0)
    const longVariable = `missing_${'x'.repeat(500)}`
    await source.fill(`x = ${longVariable}`)
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByRole('alert').filter({ hasText: longVariable }).waitFor()
    const memberIds = [...room.members.keys()]
    const nav = host.getByRole('navigation', { name: 'Основная навигация' })
    const crt = host.getByRole('button', { name: 'ЭЛТ', exact: true })
    assert.equal(await crt.getAttribute('aria-pressed'), 'true')
    await crt.click()
    assert.equal(await host.locator('.crt-screen').count(), 0)
    await nav.getByRole('link', { name: 'Как играть', exact: true }).click()
    await host.getByRole('heading', { name: 'Как играть', exact: true }).waitFor()
    assert.equal(new URL(host.url()).pathname, '/how-to-play')
    await nav.getByRole('link', { name: 'Справочник', exact: true }).click()
    await host.locator('.parameter-grid').waitFor()
    assert.equal(await host.locator('.parameter-grid > div').filter({ hasText: 'Стоимость бота' }).locator('dd').innerText(), String(game.config.botCost))
    await host.goBack()
    await host.getByRole('heading', { name: 'Как играть', exact: true }).waitFor()
    await host.goForward()
    await host.getByRole('heading', { name: 'Справочник', exact: true }).waitFor()
    await nav.getByRole('link', { name: 'Арена', exact: true }).click()
    assert.equal(await source.inputValue(), `x = ${longVariable}`)
    assert.deepEqual([...room.members.keys()], memberIds)
    assert.equal(await host.getByTestId('room-code').innerText(), code)
    assert.equal(await crt.getAttribute('aria-pressed'), 'false')
    await crt.click()
    assert.equal(await host.locator('.crt-screen').count(), 1)
    await host.getByRole('button', { name: 'Пример', exact: true }).hover()
    await host.getByRole('tooltip').filter({ hasText: 'Заменить текст' }).waitFor()
    await host.keyboard.press('Escape')
    await host.getByRole('tooltip').waitFor({ state: 'hidden' })
    await host.getByRole('button', { name: 'Применить', exact: true }).focus()
    await host.getByRole('tooltip').filter({ hasText: 'Применить код' }).waitFor()
    await host.keyboard.press('Escape')
    await host.getByRole('tooltip').waitFor({ state: 'hidden' })
    for (const width of [1024, 1280, 1440]) {
      await host.setViewportSize({ width, height: 1000 })
      await host.waitForFunction(() => {
        const input = document.querySelector('#bot-source')
        const highlight = document.querySelector('.code-highlight')
        return highlight.clientWidth === input.clientWidth && highlight.scrollLeft === input.scrollLeft
      })
      const layout = await host.evaluate(() => {
        const editor = document.querySelector('.editor').getBoundingClientRect()
        const arena = document.querySelector('.arena').getBoundingClientRect()
        const canvas = document.querySelector('canvas')
        const rect = canvas.getBoundingClientRect()
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          separated: editor.right <= arena.left,
          ratio: Math.abs(rect.width / rect.height - canvas.width / canvas.height),
          buttonsFit: [...document.querySelectorAll('.editor button')].every(button => {
            const box = button.getBoundingClientRect()
            return box.left >= editor.left && box.right <= editor.right
          }),
        }
      })
      assert.equal(layout.overflow, false, `horizontal overflow at ${width}`)
      assert.equal(layout.separated && layout.buttonsFit, true, `layout at ${width}`)
      assert.ok(layout.ratio < 0.01)
      await host.screenshot({ path: path.join(artifacts, `layout-${width}.png`), fullPage: true })
    }
    await source.fill('x = 1\ny = missing')
    await host.getByRole('button', { name: 'Применить', exact: true }).click()
    await host.getByRole('alert').filter({ hasText: 'Unknown variable "missing"' }).waitFor()
    assert.equal(game.state, 'running')
    await host.getByRole('button', { name: 'Включить AI', exact: true }).click()
    await host.getByText('Ботами управляет встроенный AI.', { exact: true }).waitFor()
    game.stop()
    for (const page of [host, guest]) {
      await page.waitForFunction(tick => document.querySelector('[data-testid="tick"]').textContent.startsWith(`Тик ${tick} ·`), game.tickCount)
    }
    // A real attack must produce a temporary contour, including with ticks stopped.
    const base = game.bases.find(base => base.ownerId === player.id)
    const attacker = game.bots.find(bot => bot.ownerId !== player.id)
    attacker.x = base.x - 30
    attacker.y = base.y
    const point = { x: Math.round(base.x + 27), y: Math.round(base.y) }
    const isWhite = ({ x, y }) => {
      const pixel = document.querySelector('canvas').getContext('2d').getImageData(x, y, 1, 1).data
      return pixel[0] > 240 && pixel[1] > 240 && pixel[2] > 240
    }
    const flash = host.waitForFunction(isWhite, point, { polling: 'raf', timeout: 3000 })
    assert.equal(game.attack(attacker, base), true)
    await flash
    for (const page of [host, guest]) {
      await page.waitForFunction(({ x, y }) => {
        const pixel = document.querySelector('canvas').getContext('2d').getImageData(x, y, 1, 1).data
        return !(pixel[0] > 240 && pixel[1] > 240 && pixel[2] > 240)
      }, point)
    }
    const hostCanvas = await host.locator('canvas').evaluate(canvas => canvas.toDataURL())
    const guestCanvas = await guest.locator('canvas').evaluate(canvas => canvas.toDataURL())
    if (hostCanvas !== guestCanvas) {
      await host.locator('canvas').screenshot({ path: path.join(artifacts, 'host-canvas.png') })
      await guest.locator('canvas').screenshot({ path: path.join(artifacts, 'guest-canvas.png') })
    }
    assert.ok(hostCanvas === guestCanvas, 'Canvas differs between clients after hit feedback expires')
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
    assert.equal(player.source, 'x = 1\ny = missing')
    assert.equal(game.bots[0].program, player.program)
    await guest.getByRole('button', { name: 'Выйти', exact: true }).click()
    await host.getByRole('heading', { name: 'Победитель: Alpha', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('Browser check passed: two clients, lobby, synchronized canvas, Apply/error navigation, separate help pages and history, preserved session/draft, CRT toggle, accessible hover tips, layouts 1024/1280/1440, hit flash, AI victory, restart and leave. No browser errors.')
    console.log(`Screenshots: ${artifacts}`)
  } finally {
    await browser?.close()
    await server.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })

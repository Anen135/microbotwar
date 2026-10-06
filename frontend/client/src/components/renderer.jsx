import { useEffect, useRef } from 'react'

export default function Renderer({ state }) {
  const ref = useRef(null)
  const history = useRef(new Map())
  const previousTick = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    if (!state || !ctx) return
    if (previousTick.current !== null && state.tick < previousTick.current) history.current.clear()
    previousTick.current = state.tick
    const now = performance.now()
    const entities = [...state.bases, ...state.bots]
    const nextHistory = new Map()
    for (const entity of entities) {
      const previous = history.current.get(entity.id)
      nextHistory.set(entity.id, {
        hp: entity.hp,
        flashUntil: previous && entity.hp < previous.hp ? now + 200 : (previous?.flashUntil ?? 0),
      })
    }
    // Replacing the map also discards entities removed by death or restart.
    history.current = nextHistory
    const { mapWidth, mapHeight } = state.config
    if (canvas.width !== mapWidth) canvas.width = mapWidth
    if (canvas.height !== mapHeight) canvas.height = mapHeight
    const players = new Map(state.players.map(player => [player.id, player]))
    const baseIds = new Set(state.bases.map(base => base.id))
    let frame

    function draw() {
      const time = performance.now()
      let flashing = false
      ctx.fillStyle = '#12190f'
      ctx.fillRect(0, 0, mapWidth, mapHeight)
      ctx.strokeStyle = '#26321f'
      ctx.lineWidth = 1
      for (let x = 0; x < mapWidth; x += 80) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mapHeight); ctx.stroke()
      }
      for (let y = 0; y < mapHeight; y += 80) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mapWidth, y); ctx.stroke()
      }
      for (const resource of state.resources) {
        ctx.fillStyle = '#d8b974'
        ctx.beginPath()
        ctx.moveTo(resource.x, resource.y - 7)
        ctx.lineTo(resource.x + 6, resource.y)
        ctx.lineTo(resource.x, resource.y + 7)
        ctx.lineTo(resource.x - 6, resource.y)
        ctx.closePath(); ctx.fill()
      }
      for (const entity of entities) {
        const base = baseIds.has(entity.id)
        const radius = base ? 23 : 8
        const player = players.get(entity.ownerId)
        const color = player?.color ?? '#ffffff'
        if (base) {
          ctx.globalAlpha = 0.08
          ctx.fillStyle = color
          ctx.beginPath(); ctx.arc(entity.x, entity.y, 47, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 0.28
          ctx.strokeStyle = color
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(entity.x, entity.y, 47, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = 1
          ctx.fillStyle = color
          ctx.beginPath()
          for (let side = 0; side < 6; side += 1) {
            const angle = Math.PI / 3 * side - Math.PI / 2
            const x = entity.x + Math.cos(angle) * radius
            const y = entity.y + Math.sin(angle) * radius
            if (side === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath(); ctx.fill()
          ctx.fillStyle = '#162012'
          ctx.fillRect(entity.x - 7, entity.y - 7, 14, 14)
          ctx.fillStyle = color
          ctx.fillRect(entity.x - 3, entity.y - 3, 6, 6)
        } else {
          ctx.fillStyle = color
          ctx.beginPath(); ctx.roundRect(entity.x - radius, entity.y - radius, radius * 2, radius * 2, 3); ctx.fill()
          ctx.fillStyle = '#162012'
          ctx.fillRect(entity.x - 5, entity.y - 3, 10, 4)
        }
        if (nextHistory.get(entity.id).flashUntil > time) {
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 3
          ctx.beginPath(); ctx.arc(entity.x, entity.y, radius + 4, 0, Math.PI * 2); ctx.stroke()
          flashing = true
        }
        const barWidth = base ? 56 : 20
        ctx.fillStyle = '#35432b'
        ctx.fillRect(entity.x - barWidth / 2, entity.y - radius - 10, barWidth, 4)
        ctx.fillStyle = '#c4daa7'
        ctx.fillRect(entity.x - barWidth / 2, entity.y - radius - 10, barWidth * entity.hp / entity.maxHp, 4)
        if (base) {
          ctx.textAlign = 'center'
          ctx.font = '17px system-ui'
          ctx.fillStyle = '#d1dec1'
          ctx.fillText(`${player?.name ?? ''} · ${entity.hp} HP`, entity.x, entity.y + 69)
        }
      }
      // Continue only until the last flash expires, even when simulation ticks stop.
      if (flashing) frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [state])
  return <canvas ref={ref} aria-label="Игровая карта: базы, боты и ресурсы" />
}

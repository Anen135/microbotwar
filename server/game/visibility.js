// Observation history is private to each match and player, never a global view.
const histories = new WeakMap()

function resetVisibility(game) {
  histories.delete(game)
}

function snapshotFor(game, playerId) {
  if (!game.players.some(player => player.id === playerId)) throw new Error('Unknown viewer')
  const full = game.snapshot()
  const sensors = [...game.bots, ...game.bases]
    .filter(entity => entity.ownerId === playerId && entity.hp > 0)
    .map(entity => ({ x: entity.x, y: entity.y, radius: entity.visionRange ?? 0 }))
  const inSight = entity => sensors.some(sensor => Math.hypot(sensor.x - entity.x, sensor.y - entity.y) <= sensor.radius)
  const visible = entity => entity.ownerId === playerId || inSight(entity)
  let matchHistory = histories.get(game)
  if (!matchHistory || matchHistory.tick > game.tickCount) {
    matchHistory = { tick: game.tickCount, players: new Map() }
    histories.set(game, matchHistory)
  }
  matchHistory.tick = game.tickCount
  if (!matchHistory.players.has(playerId)) matchHistory.players.set(playerId, new Map())
  const history = matchHistory.players.get(playerId)
  // Explicit public fields prevent private designs, tags, cargo or budgets leaking.
  const publicEntity = (entity, type) => {
    const result = { id: entity.id, type, x: entity.x, y: entity.y }
    if (type === 'resource') Object.assign(result, { resourceType: entity.resourceType, amount: entity.amount })
    else Object.assign(result, { ownerId: entity.ownerId, hp: entity.hp, maxHp: entity.maxHp })
    return result
  }
  const activeIds = new Set()
  const select = (entities, type) => entities.filter(visible).map(entity => {
    activeIds.add(entity.id)
    const publicData = publicEntity(entity, type)
    if (entity.ownerId !== playerId) {
      history.delete(entity.id)
      history.set(entity.id, { ...publicData, lastSeenTick: game.tickCount })
    }
    return entity.ownerId === playerId ? { ...entity, type } : publicData
  })
  const bots = select(full.bots, 'bot')
  const bases = select(full.bases, 'base')
  const resources = select(full.resources, 'resource')
  // Observing an empty old position invalidates that observation; hidden current
  // positions are never read to update the player's remembered coordinates.
  for (const [id, observation] of history) {
    if (!activeIds.has(id) && inSight(observation)) history.delete(id)
  }
  const maxEntries = game.config.maxLastSeenEntries ?? 1000
  while (history.size > maxEntries) history.delete(history.keys().next().value)
  return {
    tick: full.tick,
    gameState: full.gameState,
    winnerId: full.winnerId,
    config: full.config,
    viewerId: playerId,
    players: full.players.map(player => player.id === playerId ? player : {
      id: player.id, name: player.name, color: player.color, alive: player.alive,
    }),
    bots, bases, resources,
    vision: sensors,
    lastSeen: [...history.values()].filter(entity => !activeIds.has(entity.id)).map(entity => ({ ...entity })),
  }
}

module.exports = { snapshotFor, resetVisibility }

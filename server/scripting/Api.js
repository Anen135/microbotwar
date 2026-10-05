// The DSL only sees values returned here, never server objects or JavaScript APIs.
const definitions = Object.freeze({
  nearestEnemy: { args: [0], cost: 5 },
  nearestResource: { args: [0], cost: 5 },
  nearestFriendly: { args: [0], cost: 5 },
  moveTo: { args: [1, 2], cost: 1 },
  attack: { args: [1], cost: 2 },
  collect: { args: [0], cost: 1 },
  canSpawn: { args: [0], cost: 1 },
  spawn: { args: [0], cost: 2 },
  distance: { args: [1], cost: 1 },
  random: { args: [0], cost: 1 },
  getPosition: { args: [0], cost: 1 },
  getBase: { args: [0], cost: 1 },
  getHealth: { args: [0], cost: 1 },
  getResources: { args: [0], cost: 1 },
})

function createApi(game, bot, player) {
  const commands = []
  const reference = entity => entity ? Object.freeze({ id: entity.id, x: entity.x, y: entity.y }) : null
  const position = target => {
    if (!target || typeof target !== 'object' || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
      throw new Error('Expected a target; check that it exists with if')
    }
    return target
  }
  const functions = {
    nearestEnemy: () => reference(game.nearest(bot, 'enemy')),
    nearestResource: () => reference(game.nearest(bot, 'resource')),
    nearestFriendly: () => reference(game.nearest(bot, 'friendly')),
    moveTo: (...args) => {
      const target = args.length === 1 ? position(args[0]) : { x: args[0], y: args[1] }
      position(target)
      commands.push(() => bot.moveTo(target.x, target.y))
      return null
    },
    attack: target => {
      position(target)
      const entity = [...game.bots, ...game.bases].find(item => item.id === target.id)
      commands.push(() => game.attack(bot, entity))
      return null
    },
    collect: () => { commands.push(() => game.collect(bot)); return null },
    canSpawn: () => game.canSpawn(player),
    spawn: () => { commands.push(() => game.spawn(player)); return null },
    distance: target => game.distance(bot, position(target)),
    random: () => game.random(),
    getPosition: () => reference(bot),
    getBase: () => reference(game.bases.find(base => base.ownerId === player.id && base.hp > 0)),
    getHealth: () => bot.hp,
    getResources: () => player.resources,
  }
  return { functions, commit: () => { for (const command of commands) command() } }
}

module.exports = { definitions, createApi }

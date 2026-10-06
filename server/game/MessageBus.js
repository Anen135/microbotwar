const { cloneData } = require('../scripting/data')

class MessageBus {
  constructor(game) { this.game = game; this.pending = [] }

  prepare(sender, channel, payload) {
    const { game } = this
    if (typeof channel !== 'string' || !channel.length || channel.length > 32) throw new Error('Channel must contain 1-32 characters')
    const data = cloneData(payload, game.config.messageMaxBytes)
    return cloneData({ sender: sender.id, channel, payload: data, tick: game.tickCount })
  }

  send(sender, channel, payload) {
    const { game } = this
    const message = this.prepare(sender, channel, payload)
    if (sender.hp <= 0) return false
    if (sender.lastSendTick !== game.tickCount) { sender.lastSendTick = game.tickCount; sender.sentMessages = 0 }
    if (sender.sentMessages >= game.config.maxMessagesPerTick) return false
    const recipients = [...game.bots, ...game.bases].filter(entity => entity !== sender && entity.hp > 0
      && entity.ownerId === sender.ownerId && game.distance(sender, entity) <= sender.communicationRange)
    if (this.pending.length + recipients.length > game.config.maxQueuedMessages) return false
    for (const recipient of recipients) this.pending.push({ recipientId: recipient.id, ownerId: sender.ownerId, deliveryTick: game.tickCount + 1, message })
    sender.sentMessages += 1
    return true
  }

  deliver() {
    const { game } = this
    const recipients = new Map([...game.bots, ...game.bases].filter(entity => entity.hp > 0).map(entity => [entity.id, entity]))
    for (const entity of recipients.values()) entity.inbox = []
    const later = []
    for (const packet of this.pending) {
      if (packet.deliveryTick > game.tickCount) { later.push(packet); continue }
      const recipient = recipients.get(packet.recipientId)
      if (recipient?.ownerId === packet.ownerId && recipient.inbox.length < game.config.maxInboxMessages) {
        recipient.inbox.push(cloneData(packet.message))
      }
    }
    this.pending = later
  }

  clear() { this.pending = [] }
}

module.exports = MessageBus

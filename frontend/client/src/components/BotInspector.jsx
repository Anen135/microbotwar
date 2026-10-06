import { useState } from 'react'

export default function BotInspector({ bots }) {
  const [selected, setSelected] = useState('')
  const bot = bots.find(item => item.id === selected) || bots[0]
  if (!bot) return <div className="bot-inspector">Своих ботов нет.</div>
  return <div className="bot-inspector">
    <label htmlFor="inspect-bot">Свой бот<select id="inspect-bot" value={bot.id} onChange={event => setSelected(event.target.value)}>{bots.map(item => <option key={item.id} value={item.id}>{item.id} · {item.programId}</option>)}</select></label>
    <dl><div><dt>Программа</dt><dd>{bot.programId}</dd></div><div><dt>Энергия</dt><dd>{Math.round(bot.energy ?? 0)} / {bot.maxEnergy ?? '?'}</dd></div><div><dt>CPU / тик</dt><dd>{bot.cpu ?? 0} / {bot.cpuBudget ?? '?'}</dd></div><div><dt>Груз</dt><dd>{Object.entries(bot.cargo || {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'Пусто'} / {bot.cargoCapacity ?? '?'}</dd></div></dl>
    <details><summary>Память и теги</summary><pre>{JSON.stringify({ memory: bot.memory || {}, tags: bot.tags || {} }, null, 2)}</pre></details>
  </div>
}

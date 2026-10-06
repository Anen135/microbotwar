import { useState } from 'react'
import { designFields } from '../programDefaults'

export default function ProgramControls({ programs, selected, onSelect, onCreate, design, onDesign, budget, disabled }) {
  const [name, setName] = useState('')
  const spent = Object.values(design).reduce((total, value) => total + value, 0)
  const valid = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(name) && !Object.hasOwn(programs, name)
  return <div className="program-controls">
    <label htmlFor="program-select">Программа<select id="program-select" value={selected} onChange={event => onSelect(event.target.value)} disabled={disabled}><option value="@base">Base Controller</option>{Object.keys(programs).map(id => <option key={id} value={id}>{id}</option>)}</select></label>
    <form className="program-create" onSubmit={event => { event.preventDefault(); if (valid) { onCreate(name); setName('') } }}><label className="sr-only" htmlFor="program-name">Имя новой программы</label><input id="program-name" value={name} onChange={event => setName(event.target.value)} maxLength={32} placeholder="miner, scout…" /><button className="secondary" disabled={disabled || !valid}>Добавить</button></form>
    {selected !== '@base' && <fieldset className="design-controls" disabled={disabled}><legend>Конструкция · {spent} / {budget} очков</legend>{designFields.map(([key, label]) => <label key={key} htmlFor={`design-${key}`}>{label}<input id={`design-${key}`} type="number" min={0} max={Math.max(0, budget - spent + design[key])} step={1} value={design[key]} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && spent - design[key] + value <= budget) onDesign({ ...design, [key]: value }) }} /></label>)}<p>Характеристики назначаются новым ботам. Поведение определяет код.</p></fieldset>}
  </div>
}

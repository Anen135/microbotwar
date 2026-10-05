import { useRef } from 'react'
import { countLabel } from '../format'

export default function Editor({ source, onChange, onApply, onExample, onAI, disabled, applied, appliedSource, compileError, control, debug, config }) {
  const textarea = useRef(null)
  const compilerMessage = compileError?.source === source ? compileError.message : null
  const error = compilerMessage || (control === 'script' ? debug.error : null)
  const match = error?.match(/^Line (\d+):\s*([\s\S]*)$/)
  const line = match ? Number(match[1]) : null
  const sameSource = Boolean(compilerMessage) || appliedSource === source
  const canLocate = sameSource && line > 0 && line <= source.split('\n').length

  function goToLine() {
    if (!canLocate) return
    const lines = source.split('\n')
    const start = lines.slice(0, line - 1).reduce((offset, text) => offset + text.length + 1, 0)
    const input = textarea.current
    input.focus()
    input.setSelectionRange(start, start + lines[line - 1].length)
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight)
    input.scrollTop = Math.max(0, (line - 1) * lineHeight - input.clientHeight / 2)
  }

  return (
    <section className="panel editor">
      <div className="arena-header"><h2>Программа ботов</h2><span>{control === 'script' ? 'Ваш код' : 'Встроенный AI'}</span></div>
      <label className="sr-only" htmlFor="bot-source">Код программы</label>
      <textarea ref={textarea} id="bot-source" value={source} onChange={event => onChange(event.target.value)} spellCheck={false} maxLength={8000} aria-describedby={error ? 'code-help code-error' : 'code-help'} aria-invalid={Boolean(error && sameSource)} />
      <div className="actions"><button onClick={onApply} disabled={disabled || !source.trim()}>Применить</button><button className="secondary" onClick={onExample} disabled={disabled}>Пример</button><button className="secondary" onClick={onAI} disabled={disabled || control === 'ai'}>Включить AI</button></div>
      <p className="muted">{applied ? 'Применено' : 'Изменения применяются кнопкой'} · CPU: {debug.cpu} / {config.scriptOperationLimit} (максимум среди ваших ботов)</p>
      {error && <div id="code-error" className="notice error" role="alert">
        {line && <strong className="error-line">Строка {line}</strong>}
        <p>{match ? match[2] : error}</p>
        {!sameSource && <p>Ошибка в применённой версии программы. Текст в редакторе уже изменён.</p>}
        {canLocate && <button className="secondary" type="button" onClick={goToLine}>Перейти к строке</button>}
      </div>}
      {control === 'script' && debug.limited && <p className="notice">Бюджет операций исчерпан. Выполнение продолжится с начала программы на следующем тике.</p>}
      <details id="code-help"><summary>Как программировать ботов</summary><p>Это небольшой язык с переменными, отступами, if/else и выражениями. Программа запускается заново каждый тик; переменные не сохраняются. Циклов и доступа к JavaScript нет.</p><p><code>nearestEnemy()</code>, <code>nearestResource()</code>, <code>nearestFriendly()</code> возвращают видимую цель или null. Проверяйте её через <code>if target:</code>.</p><p><code>moveTo(target)</code> или <code>moveTo(x, y)</code>, <code>attack(target)</code>, <code>collect()</code>, <code>canSpawn()</code>, <code>spawn()</code>, <code>distance(target)</code>, <code>random()</code>.</p><p>Доступны <code>getHealth()</code>, <code>getResources()</code>, <code>getPosition()</code>, <code>getBase()</code>. Карта: {config.mapWidth} × {config.mapHeight}. Скорость: {config.botSpeed}/с. Атака: {config.botAttackRange}. Сбор: {config.collectRange}. Обзор: {config.visionRange}. Новый бот: {countLabel(config.botCost, 'ресурс', 'ресурса', 'ресурсов')}. Лимит: {countLabel(config.maxBotsPerPlayer, 'бот', 'бота', 'ботов')} на игрока.</p></details>
    </section>
  )
}

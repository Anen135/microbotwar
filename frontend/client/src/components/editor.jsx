import { useLayoutEffect, useRef } from 'react'
import { countLabel } from '../format'
import Icon from './Icon'

function highlightedCode(source) {
  return source.split(/(#[^\n]*|\b(?:if|else|and|or|not|true|false|null)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\())/g).map((part, index) => {
    const kind = part.startsWith('#') ? 'comment' : /^(if|else|and|or|not|true|false|null)$/.test(part) ? 'keyword' : /^\d/.test(part) ? 'number' : /^[A-Za-z_]\w*$/.test(part) ? 'function' : ''
    return kind ? <span key={index} className={`token-${kind}`}>{part}</span> : part
  })
}

export default function Editor({ source, onChange, onApply, onExample, onAI, disabled, applied, appliedSource, compileError, control, debug, config }) {
  const textarea = useRef(null)
  const highlight = useRef(null)
  const gutter = useRef(null)
  const lines = source.split('\n')
  const compilerMessage = compileError?.source === source ? compileError.message : null
  const error = compilerMessage || (control === 'script' ? debug.error : null)
  const match = error?.match(/^Line (\d+):\s*([\s\S]*)$/)
  const line = match ? Number(match[1]) : null
  const sameSource = Boolean(compilerMessage) || appliedSource === source
  const canLocate = sameSource && line > 0 && line <= source.split('\n').length

  function syncScroll() {
    highlight.current.style.width = `${textarea.current.clientWidth}px`
    highlight.current.style.height = `${textarea.current.clientHeight}px`
    highlight.current.scrollTop = textarea.current.scrollTop
    highlight.current.scrollLeft = textarea.current.scrollLeft
    gutter.current.style.transform = `translateY(-${textarea.current.scrollTop}px)`
  }

  useLayoutEffect(() => {
    const observer = new ResizeObserver(syncScroll)
    observer.observe(textarea.current)
    syncScroll()
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(syncScroll, [source])

  function goToLine() {
    if (!canLocate) return
    const lines = source.split('\n')
    const start = lines.slice(0, line - 1).reduce((offset, text) => offset + text.length + 1, 0)
    const input = textarea.current
    input.focus()
    input.setSelectionRange(start, start + lines[line - 1].length)
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight)
    input.scrollTop = Math.max(0, (line - 1) * lineHeight - input.clientHeight / 2)
    input.scrollLeft = 0
    syncScroll()
  }

  return (
    <section className="panel editor">
      <div className="arena-header"><div className="arena-title"><Icon name="code" size={19} /><h2>Программа ботов</h2></div><span className="editor-mode">{control === 'script' ? 'ВАШ КОД' : 'AI'}</span></div>
      <div className="file-tab"><span><Icon name="code" size={14} />strategy.bot <i className={applied ? 'saved-dot' : 'draft-dot'} /></span><small>BOT SCRIPT</small></div>
      <label className="sr-only" htmlFor="bot-source">Код программы</label>
      <div className="code-workspace"><div className="line-gutter" aria-hidden="true"><div ref={gutter}>{lines.map((_, index) => <span key={index} className={sameSource && line === index + 1 ? 'line-error' : ''}>{index + 1}</span>)}</div></div><div className="code-layers"><pre ref={highlight} className="code-highlight" aria-hidden="true">{highlightedCode(source)}{'\n'}</pre><textarea ref={textarea} id="bot-source" value={source} onChange={event => onChange(event.target.value)} onScroll={syncScroll} wrap="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" maxLength={8000} aria-describedby={error ? 'code-help code-error' : 'code-help'} aria-invalid={Boolean(error && sameSource)} /></div></div>
      <div className="editor-meta"><span>{applied ? <><i className="status-dot" />Применено</> : 'Изменения применяются кнопкой'}</span><span>{countLabel(lines.length, 'строка', 'строки', 'строк')}</span></div>
      <div className="editor-controls"><button className="apply-button" onClick={onApply} disabled={disabled || !source.trim()}><Icon name="play" size={16} />Применить<Icon className="apply-arrow" name="arrow" size={17} /></button><div className="actions"><button className="secondary" onClick={onExample} disabled={disabled}><Icon name="code" size={15} />Пример</button><button className="secondary" onClick={onAI} disabled={disabled || control === 'ai'}><Icon name="bot" size={15} />Включить AI</button></div></div>
      <div className="cpu-status"><div><span><Icon name="bolt" size={13} />Бюджет операций</span><strong>{debug.cpu}<span> / {config.scriptOperationLimit}</span></strong></div><progress value={debug.cpu} max={config.scriptOperationLimit} aria-label="Бюджет операций" /><p>Максимум среди ваших ботов за тик</p></div>
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

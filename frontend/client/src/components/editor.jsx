export default function Editor({ source, onChange, onApply, onExample, onAI, disabled, applied, control, debug, limit }) {
  return (
    <section className="panel editor">
      <div className="arena-header"><h2>Программа ботов</h2><span>{control === 'script' ? 'Ваш код' : 'Встроенный AI'}</span></div>
      <label className="sr-only" htmlFor="bot-source">Код программы</label>
      <textarea id="bot-source" value={source} onChange={event => onChange(event.target.value)} spellCheck={false} maxLength={8000} aria-describedby="code-help" />
      <div className="actions"><button onClick={onApply} disabled={disabled || !source.trim()}>Применить</button><button className="secondary" onClick={onExample} disabled={disabled}>Пример</button><button className="secondary" onClick={onAI} disabled={disabled || control === 'ai'}>Включить AI</button></div>
      <p className="muted">{applied ? 'Применено' : 'Изменения применяются кнопкой'} · CPU: {debug.cpu} / {limit} (максимум среди ваших ботов)</p>
      {debug.error && <p className="notice error" role="alert">{debug.error}</p>}
      {debug.limited && <p className="notice">Бюджет операций исчерпан. Выполнение продолжится с начала программы на следующем тике.</p>}
      <details id="code-help"><summary>Как программировать ботов</summary><p>Это небольшой язык с переменными, отступами, if/else и выражениями. Программа запускается заново каждый тик; переменные не сохраняются. Циклов и доступа к JavaScript нет.</p><p><code>nearestEnemy()</code>, <code>nearestResource()</code>, <code>nearestFriendly()</code> возвращают видимую цель или null. Проверяйте её через <code>if target:</code>.</p><p><code>moveTo(target)</code> или <code>moveTo(x, y)</code>, <code>attack(target)</code>, <code>collect()</code>, <code>canSpawn()</code>, <code>spawn()</code>, <code>distance(target)</code>, <code>random()</code>.</p><p>Доступны <code>getHealth()</code>, <code>getResources()</code>, <code>getPosition()</code>, <code>getBase()</code>. Карта: 1600 × 900. Скорость: 80/с. Атака: 35. Сбор: 25. Обзор: 250. Новый бот: 30 ресурсов. Лимит: 40 ботов на игрока.</p></details>
    </section>
  )
}

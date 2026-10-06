import { useEffect, useState } from 'react'
import { socket } from './socket'
import Renderer from './components/renderer'
import Editor from './components/editor'
import Icon from './components/Icon'
import ArenaPreview from './components/ArenaPreview'
import { countLabel } from './format'
import './App.css'

function App() {
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState(null)
  const [state, setState] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [source, setSource] = useState('')
  const [example, setExample] = useState('')
  const [applied, setApplied] = useState('')
  const [error, setError] = useState('')
  const [compileError, setCompileError] = useState(null)
  const [message, setMessage] = useState('')
  const [debug, setDebug] = useState({ cpu: 0, error: null })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onConnect = () => { setConnected(true); setError('') }
    const onDisconnect = () => {
      setConnected(false)
      setRoom(null)
      setState(null)
      setDebug({ cpu: 0, error: null })
      setCompileError(null)
      setMessage('Соединение потеряно. После восстановления войдите в новую комнату. Выход из матча считается поражением.')
    }
    const onError = () => setError('Не удалось подключиться к серверу. Проверьте, что он запущен.')
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onError)
    socket.on('room', setRoom)
    socket.on('state', setState)
    socket.on('debug', setDebug)
    socket.connect()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onError)
      socket.off('room', setRoom)
      socket.off('state', setState)
      socket.off('debug', setDebug)
      socket.disconnect()
    }
  }, [])

  async function request(event, data = {}) {
    setBusy(true)
    setError('')
    if (event === 'applyProgram') setCompileError(null)
    try {
      const response = await new Promise((resolve, reject) => {
        socket.timeout(5000).emit(event, data, (timeout, result) => {
          if (timeout) reject(new Error('Сервер не ответил. Проверьте соединение.'))
          else if (!result.ok) reject(new Error(result.error))
          else resolve(result)
        })
      })
      if (event === 'startMatch' || event === 'restartMatch') setMessage('')
      return response
    } catch (failure) {
      if (event === 'applyProgram') setCompileError({ source: data.source, message: failure.message })
      else setError(failure.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function enter(event) {
    const response = await request(event, { name, code })
    if (response) {
      setRoom(response.room)
      setSource(response.source)
      setExample(response.source)
      setApplied('')
      setCompileError(null)
      setMessage('')
    }
  }
  async function leave() {
    if (await request('leaveRoom')) {
      setRoom(null)
      setState(null)
      setDebug({ cpu: 0, error: null })
      setMessage('Вы вышли из комнаты.')
    }
  }
  async function apply() {
    const submitted = source
    if (await request('applyProgram', { source: submitted })) {
      setApplied(submitted)
      setDebug({ cpu: 0, error: null })
      setMessage('Программа применена ко всем вашим ботам, включая новых.')
    }
  }
  const me = room?.members.find(member => member.id === socket.id)
  const player = state?.players.find(player => player.id === me?.playerId)
  const host = room?.hostId === socket.id
  const disabled = busy || !connected
  const winner = state?.players.find(player => player.id === state.winnerId)
  const playing = Boolean(room && room.status !== 'lobby' && state)
  const elapsed = state ? Math.floor(state.tick / state.config.tickRate) : 0
  const matchTime = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`

  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(room.code)
      setMessage(`Код комнаты ${room.code} скопирован.`)
    } catch {
      setError('Не удалось скопировать код. Выделите его и скопируйте вручную.')
    }
  }

  return (
    <main className={playing ? 'app-shell in-match' : 'app-shell'}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="bot" size={25} /></span><div><h1>microbots<span>arena</span></h1><span className="brand-caption">CODE IS YOUR SUPERPOWER</span></div></div>
        <nav className="top-nav" aria-label="Основная навигация"><span className="nav-active"><Icon name="target" size={16} />Арена</span><a href={playing ? '#code-help' : '#quick-guide'} onClick={() => document.querySelector('#code-help')?.setAttribute('open', '')}><Icon name="book" size={16} />Как играть</a></nav>
        <span className={`connection ${connected ? 'online' : ''}`}><i className="status-dot" />{connected ? 'Сервер подключён' : 'Подключение…'}</span>
      </header>
      <div className="page-content">
        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice system-message" role="status"><Icon name="check" size={16} />{message}</p>}
        {!room ? (
          <>
            <section className="landing">
              <div className="hero-copy">
                <p className="eyebrow"><span className="label-line" />МУЛЬТИПЛЕЕРНАЯ АРЕНА АЛГОРИТМОВ</p>
                <h2>Твой код.<br />Твоя <span>армия.</span></h2>
                <p className="hero-description">Запрограммируй микроботов. Собери ресурсы.<br className="desktop-break" /> Победи противника — силой своего алгоритма.</p>
                <div className="hero-tags"><span><Icon name="code" size={15} />Простой язык</span><span><Icon name="users" size={15} />До 8 игроков</span><span><Icon name="bolt" size={15} />В реальном времени</span></div>
                <form className="entry-form panel" onSubmit={event => { event.preventDefault(); enter('joinRoom') }}>
                  <div className="entry-title"><span className="step-number">01</span><h3>Займи место на арене</h3><Icon name="target" size={18} /></div>
                  <label htmlFor="player-name">Имя<input id="player-name" value={name} onChange={event => setName(event.target.value)} maxLength={24} autoComplete="nickname" placeholder="Как тебя зовут?" required /></label>
                  <button className="create-button" type="button" disabled={disabled || !name.trim()} onClick={() => enter('createRoom')}>Создать комнату<Icon name="arrow" /></button>
                  <div className="form-divider"><span>или присоединись к друзьям</span></div>
                  <div className="join-row"><label className="sr-only" htmlFor="room-input">Код комнаты</label><input id="room-input" value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={4} placeholder="КОД КОМНАТЫ" autoComplete="off" /><button className="secondary" type="submit" disabled={disabled || !name.trim() || code.length !== 4}>Войти<Icon name="arrow" size={16} /></button></div>
                  <p className="form-footnote"><span className="tiny-dot" />Без регистрации. Всё начинается с идеи.</p>
                </form>
              </div>
              <div className="hero-visual"><ArenaPreview /><div className="visual-note"><span>01—</span><p>Не управляй каждым движением.<br /><strong>Научи ботов принимать решения.</strong></p></div></div>
            </section>
            <section className="quick-guide" id="quick-guide" aria-label="Как играть">
              <div className="guide-intro"><p className="eyebrow">ОТ ИДЕИ К ПОБЕДЕ</p><h3>Три шага.<br />Бесконечно много стратегий.</h3></div>
              <article><span className="guide-icon"><Icon name="users" /></span><span className="guide-number">01</span><h3>Собери команду соперников</h3><p>Создай комнату и поделись кодом. Когда все готовы — запускай матч.</p></article>
              <article><span className="guide-icon"><Icon name="code" /></span><span className="guide-number">02</span><h3>Дай ботам план</h3><p>Измени пример программы и примени его ко всей армии одним нажатием.</p></article>
              <article><span className="guide-icon"><Icon name="trophy" /></span><span className="guide-number">03</span><h3>Останься последним</h3><p>Развивай армию, защищай базу и уничтожь всех ботов противника.</p></article>
            </section>
          </>
        ) : (
          <>
            <div className="page-heading"><div><p className="eyebrow">{playing ? 'КОМАНДНЫЙ ЦЕНТР' : 'ПЕРЕД ВЫХОДОМ НА АРЕНУ'}</p><h2>{playing ? 'Поле боя' : 'Твоя следующая победа начинается здесь.'}</h2><p>{playing ? 'Каждое решение имеет значение. Сделай следующее лучше.' : 'Пригласи соперников, проверь готовность — и пусть решает код.'}</p></div>{playing && <span className="match-clock"><Icon name="clock" size={18} />{matchTime}<small>ВРЕМЯ МАТЧА</small></span>}</div>
            <section className="room-bar panel">
              <div className="room-identity"><span className="room-label">КОМНАТА</span><strong data-testid="room-code" className="room-code">{room.code}</strong><button className="icon-button" aria-label="Скопировать код комнаты" title="Скопировать код комнаты" onClick={copyRoom}><Icon name="copy" size={16} /></button><span className="room-members"><Icon name="users" size={16} />{room.members.length} / {state?.config.maxPlayers ?? 8}</span></div>
              <div className="actions room-actions">
                {room.status === 'lobby' && <button className={me?.ready ? 'secondary ready-button' : ''} disabled={disabled} onClick={() => request('setReady', { ready: !me?.ready })}><Icon name="check" size={16} />{me?.ready ? 'Не готов' : 'Готов'}</button>}
                {host && room.status === 'lobby' && <button disabled={disabled || room.members.length < 2 || !room.members.every(member => member.ready)} onClick={() => request('startMatch')}><Icon name="play" size={16} />Начать матч</button>}
                {host && room.status !== 'lobby' && <button className="secondary" disabled={disabled || room.members.length < 2} onClick={() => request('restartMatch')}><Icon name="refresh" size={15} />Перезапустить матч</button>}
                <button className="quiet" disabled={disabled} onClick={leave}><Icon name="exit" size={16} />Выйти</button>
              </div>
            </section>
            {room.status === 'lobby' ? (
              <div className="lobby-layout">
                <section className="panel lobby"><div className="section-heading"><div><p className="eyebrow">СОСТАВ КОМНАТЫ</p><h2>Подготовка к матчу</h2></div><span className="subtle-pill">{room.members.filter(member => member.ready).length} готовы</span></div>
                  <ul>{room.members.map((member, index) => <li key={member.id}><span className="player-avatar" style={{ '--player-color': member.color }}>{member.name.slice(0, 1).toUpperCase()}</span><div className="member-name"><strong>{member.name}{member.id === socket.id && <small>ВЫ</small>}</strong><span>Игрок {String(index + 1).padStart(2, '0')}{member.id === room.hostId ? ' · Хост комнаты' : ' · Противник'}</span></div><span className={`ready ${member.ready ? 'is-ready' : ''}`}><Icon name={member.ready ? 'check' : 'clock'} size={14} />{member.ready ? 'Готов' : 'Ожидает'}</span></li>)}</ul>
                  {room.members.length < 2 && <div className="empty-slot"><span className="empty-avatar"><Icon name="users" /></span><div><strong>Здесь будет твой соперник</strong><p>Отправь другу код {room.code} или открой вторую вкладку.</p></div></div>}
                  <div className="lobby-bottom"><i className="status-dot" />{room.members.every(member => member.ready) && room.members.length > 1 ? 'Все готовы. Хост может запускать матч.' : 'Матч начнётся, когда все подтвердят готовность.'}</div>
                </section>
                <aside className="lobby-guide panel" id="quick-guide"><span className="guide-icon"><Icon name="target" size={26} /></span><p className="eyebrow">МИССИЯ: ВЫЖИТЬ</p><h3>Одна база.<br />Армия возможностей.</h3><p>Каждый начинает с базы и одного микробота. Собирай ресурсы, расширяй армию и продумывай следующий ход.</p><div className="rule-row"><Icon name="bot" /><p><strong>Боты уже знают основы</strong><span>До применения твоей программы ими управляет встроенный AI.</span></p></div><div className="rule-row"><Icon name="trophy" /><p><strong>Победит последний</strong><span>Игрок выбывает, когда теряет базу и всех ботов.</span></p></div></aside>
              </div>
            ) : state && (
              <>
                {state.gameState === 'finished' && <section className="result panel" role="status"><span className="result-icon"><Icon name="trophy" size={30} /></span><div><p className="eyebrow">МАТЧ ЗАВЕРШЁН</p><h2>{winner ? `Победитель: ${winner.name}` : 'Матч завершён: ничья'}</h2><p>Симуляция остановлена. Хост может перезапустить матч с сохранением программ.</p></div><span className="result-decoration" aria-hidden="true">GG.</span></section>}
                <section className="scoreboard" aria-label="Армии игроков">{state.players.map(item => {
                  const bots = state.bots.filter(bot => bot.ownerId === item.id).length
                  const base = state.bases.find(base => base.ownerId === item.id)
                  return <div className={`panel score ${!item.alive ? 'defeated' : ''}`} key={item.id} style={{ '--player-color': item.color }}><div className="player-line"><span className="player-avatar">{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong><span className="player-tag">{item.id === player?.id ? 'ВЫ' : 'СОПЕРНИК'}</span>{!item.alive && <span className="eliminated-label">Поражение</span>}</div><div className="score-metrics"><span><Icon name="gem" size={17} /><b>{item.resources}</b><small>{countLabel(item.resources, 'ресурс', 'ресурса', 'ресурсов').split(' ').slice(1).join(' ')}</small></span><span><Icon name="bot" size={17} /><b>{bots}</b><small>{countLabel(bots, 'бот', 'бота', 'ботов').split(' ').slice(1).join(' ')}</small></span><div className="base-status"><span>БАЗА</span><span>{base ? `${Math.round(base.hp / base.maxHp * 100)}%` : '0%'}</span><div className="base-health"><i style={{ width: `${base ? base.hp / base.maxHp * 100 : 0}%` }} /></div></div></div></div>
                })}</section>
                <div className="game-layout">
                  <Editor source={source} onChange={setSource} onApply={apply} onExample={() => setSource(example)} onAI={async () => { if (await request('useAI')) setMessage('Ботами управляет встроенный AI.') }} disabled={disabled} applied={source === applied && player?.control === 'script'} appliedSource={applied} compileError={compileError} control={player?.control} debug={debug} config={state.config} />
                  <section className="panel arena"><div className="arena-header"><div className="arena-title"><Icon name="target" size={19} /><h2>Арена</h2><span className={`live-badge ${state.gameState === 'finished' ? 'finished' : ''}`}><i className="status-dot" />{state.gameState === 'finished' ? 'ФИНИШ' : 'LIVE'}</span></div><span data-testid="tick">Тик {state.tick} · {state.config.tickRate} тиков/с</span></div><div className="battlefield"><Renderer state={state} /><span className="map-coordinates" aria-hidden="true">SECTOR 01 / {state.config.mapWidth} × {state.config.mapHeight}</span></div><div className="arena-footer"><div className="legend"><span><i className="legend-base" />База</span><span><i className="legend-bot" />Бот</span><span><i className="legend-resource" />Ресурс</span></div><span><Icon name="users" size={14} />{countLabel(state.players.filter(item => item.alive).length, 'игрок в игре', 'игрока в игре', 'игроков в игре')}</span></div><div className="arena-objective"><Icon name="trophy" size={18} /><div><strong>Побеждает последний выживший</strong><p>Уничтожь базу и всех ботов противника. Меняй программу, пока идёт бой.</p></div></div></section>
                </div>
              </>
            )}
          </>
        )}
        <footer><span><span className="footer-mark">m.</span>Маленькие боты. Большие идеи.</span><span>MICROBOTS ARENA <i /> CODE · LEARN · COMPETE</span></footer>
      </div>
    </main>
  )
}

export default App

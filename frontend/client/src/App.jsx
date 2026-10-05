import { useEffect, useState } from 'react'
import { socket } from './socket'
import Renderer from './components/renderer'
import Editor from './components/editor'
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
  const [message, setMessage] = useState('')
  const [debug, setDebug] = useState({ cpu: 0, error: null })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => {
      setConnected(false)
      setRoom(null)
      setState(null)
      setDebug({ cpu: 0, error: null })
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
    try {
      const response = await new Promise((resolve, reject) => {
        socket.timeout(5000).emit(event, data, (timeout, result) => {
          if (timeout) reject(new Error('Сервер не ответил. Проверьте соединение.'))
          else if (!result.ok) reject(new Error(result.error))
          else resolve(result)
        })
      })
      return response
    } catch (failure) {
      setError(failure.message)
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
      setMessage('Перед началом матча каждый игрок должен подтвердить готовность.')
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
    if (await request('applyProgram', { source })) {
      setApplied(source)
      setMessage('Программа применена ко всем вашим ботам, включая новых.')
    }
  }
  const me = room?.members.find(member => member.id === socket.id)
  const player = state?.players.find(player => player.id === me?.playerId)
  const host = room?.hostId === socket.id
  const disabled = busy || !connected
  const winner = state?.players.find(player => player.id === state.winnerId)

  return (
    <main>
      <header className="topbar">
        <div><p className="eyebrow">ПРОГРАММИРУЙ · СОБИРАЙ · ПОБЕЖДАЙ</p><h1>Microbots Arena</h1></div>
        <span className={`connection ${connected ? 'online' : ''}`}>{connected ? 'Сервер подключён' : 'Подключение…'}</span>
      </header>
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {!room ? (
        <section className="welcome panel">
          <div><p className="eyebrow">АРЕНА ДЛЯ ВАШИХ АЛГОРИТМОВ</p><h2>У каждой армии — своя программа</h2><p>Собирайте ресурсы, создавайте микроботов и меняйте их поведение прямо во время матча.</p><p className="muted">Создайте комнату и передайте её код другому игроку. Для проверки можно открыть вторую вкладку.</p></div>
          <form onSubmit={event => { event.preventDefault(); enter('joinRoom') }}>
            <label>Имя<input value={name} onChange={event => setName(event.target.value)} maxLength={24} autoComplete="nickname" required /></label>
            <button type="button" disabled={disabled || !name.trim()} onClick={() => enter('createRoom')}>Создать комнату</button>
            <label>Код комнаты<input value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={4} placeholder="ABCD" autoComplete="off" /></label>
            <button className="secondary" type="submit" disabled={disabled || !name.trim() || code.length !== 4}>Войти</button>
          </form>
        </section>
      ) : (
        <>
          <section className="room-bar panel">
            <div><span className="muted">КОМНАТА </span><strong data-testid="room-code" className="room-code">{room.code}</strong></div>
            <span>{room.members.length} / 8 игроков</span>
            <div className="actions">
              {room.status === 'lobby' && <button disabled={disabled} onClick={() => request('setReady', { ready: !me?.ready })}>{me?.ready ? 'Не готов' : 'Готов'}</button>}
              {host && room.status === 'lobby' && <button disabled={disabled || room.members.length < 2 || !room.members.every(member => member.ready)} onClick={() => request('startMatch')}>Начать матч</button>}
              {host && room.status !== 'lobby' && <button disabled={disabled || room.members.length < 2} onClick={() => request('restartMatch')}>Перезапустить матч</button>}
              <button className="secondary" disabled={disabled} onClick={leave}>Выйти</button>
            </div>
          </section>
          {room.status === 'lobby' ? (
            <section className="panel lobby"><h2>Подготовка к матчу</h2><p className="muted">Все подтвердили готовность — хост запускает игру. До применения программы ботами управляет встроенный AI.</p>
              <ul>{room.members.map(member => <li key={member.id}><span style={{ color: member.color }}>●</span> {member.name} {member.id === room.hostId && <small>ХОСТ</small>}<span className="ready">{member.ready ? 'Готов' : 'Ожидает'}</span></li>)}</ul>
            </section>
          ) : state && (
            <>
              {state.gameState === 'finished' && <section className="result panel" role="status"><h2>{winner ? `Победитель: ${winner.name}` : 'Матч завершён: ничья'}</h2><p>Симуляция остановлена. Хост может перезапустить матч с сохранением программ.</p></section>}
              <section className="scoreboard">{state.players.map(item => <div className="panel score" key={item.id}><strong style={{ color: item.color }}>{item.name}{item.id === player?.id ? ' · вы' : ''}</strong><span>{item.alive ? `${item.resources} ресурсов · ${state.bots.filter(bot => bot.ownerId === item.id).length} ботов` : 'Поражение'}</span></div>)}</section>
              <div className="game-layout">
                <Editor source={source} onChange={setSource} onApply={apply} onExample={() => setSource(example)} onAI={async () => { if (await request('useAI')) setMessage('Ботами управляет встроенный AI.') }} disabled={disabled} applied={source === applied && player?.control === 'script'} control={player?.control} debug={debug} limit={state.config.scriptOperationLimit} />
                <section className="panel arena"><div className="arena-header"><h2>Арена</h2><span data-testid="tick">Тик {state.tick} · {state.config.tickRate} тиков/с</span></div><Renderer state={state} /><p className="muted legend">● База и боты — цвет игрока · ◆ Ресурсы · Полоска — здоровье</p></section>
              </div>
            </>
          )}
        </>
      )}
      <footer>Microbots Arena · MVP · Все игровые действия рассчитываются сервером.</footer>
    </main>
  )
}

export default App

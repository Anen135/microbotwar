import { cloneElement, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Tip({ text, children }) {
  const id = useId()
  const anchor = useRef(null)
  const closeTimer = useRef(null)
  const [position, setPosition] = useState(null)
  const keepOpen = () => clearTimeout(closeTimer.current)
  const closeSoon = () => { closeTimer.current = setTimeout(() => setPosition(null), 120) }
  function show() {
    keepOpen()
    const rect = anchor.current.getBoundingClientRect()
    const left = Math.max(12, Math.min(window.innerWidth - 284, rect.left + rect.width / 2 - 136))
    setPosition(rect.bottom + 110 < window.innerHeight
      ? { left, top: rect.bottom + 9 }
      : { left, bottom: window.innerHeight - rect.top + 9 })
  }
  useEffect(() => {
    return () => clearTimeout(closeTimer.current)
  }, [])
  useEffect(() => {
    if (!position) return
    const close = () => setPosition(null)
    const onKey = event => { if (event.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [position])
  const nativeControl = ['button', 'a', 'input'].includes(children.type) || children.props.href
  return <span className="tip-anchor" ref={anchor} onMouseEnter={show} onMouseLeave={closeSoon} onFocus={show} onBlur={() => setPosition(null)} tabIndex={children.props.disabled ? 0 : undefined} aria-describedby={children.props.disabled && position ? id : undefined}>
    {cloneElement(children, {
      'aria-describedby': position ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'],
      tabIndex: nativeControl ? children.props.tabIndex : 0,
    })}
    {position && createPortal(<span className="hover-tip" id={id} role="tooltip" style={position} onMouseEnter={keepOpen} onMouseLeave={closeSoon}>{text}</span>, document.body)}
  </span>
}

import Icon from './Icon'

export default function ArenaPreview() {
  return (
    <div className="arena-preview" aria-label="Иллюстрация: микроботы собирают ресурсы на арене">
      <div className="preview-toolbar"><span><i className="status-dot" /> ПОЛИГОН АЛГОРИТМОВ</span><span>01 / 08</span></div>
      <svg viewBox="0 0 560 390" role="img" aria-label="Пример игровой карты с двумя армиями">
        <defs>
          <pattern id="preview-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="#30352b" strokeWidth=".65" /></pattern>
          <radialGradient id="preview-glow"><stop stopColor="#c3f568" stopOpacity=".12" /><stop offset="1" stopColor="#c3f568" stopOpacity="0" /></radialGradient>
          <g id="preview-bot"><rect x="-10" y="-9" width="20" height="18" rx="5" fill="currentColor" /><rect x="-6" y="-4" width="12" height="6" rx="2" fill="#151b13" /><path d="M-3 5h6M-7-12v3M7-12v3" stroke="currentColor" strokeWidth="2" /></g>
        </defs>
        <rect width="560" height="390" fill="url(#preview-grid)" />
        <ellipse cx="180" cy="230" rx="205" ry="180" fill="url(#preview-glow)" />
        <path d="M118 272 190 230 255 230 316 166 403 116" fill="none" stroke="#c3f568" strokeWidth="1.5" strokeDasharray="5 7" opacity=".55" className="preview-route" />
        <circle cx="122" cy="271" r="82" fill="none" stroke="#c3f568" strokeDasharray="3 8" opacity=".2" />
        <circle cx="122" cy="271" r="49" fill="#1a2518" stroke="#89ad47" strokeOpacity=".4" />
        <path d="m122 234 32 18v37l-32 18-32-18v-37Z" fill="#263421" stroke="#b9ed64" strokeWidth="2" />
        <path d="m122 245 22 13v26l-22 13-22-13v-26Z" fill="#c3f568" /><path d="m112 267 10-6 10 6v12l-10 6-10-6Z" fill="#213019" />
        <text x="122" y="342" fill="#ccd4bc" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="2">ВАША БАЗА</text>
        <circle cx="438" cy="92" r="44" fill="#292233" stroke="#aa92d9" strokeOpacity=".35" />
        <path d="m438 62 26 15v30l-26 15-26-15V77Z" fill="#baa1ec" /><path d="m438 79 11 6v14l-11 6-11-6V85Z" fill="#3b2b54" />
        <g color="#c3f568"><use href="#preview-bot" x="208" y="236" /><use href="#preview-bot" x="269" y="191" /><use href="#preview-bot" x="194" y="301" /></g>
        <g color="#baa1ec"><use href="#preview-bot" x="397" y="151" /><use href="#preview-bot" x="467" y="165" /></g>
        <g fill="#d3ab65" stroke="#f3d596" strokeWidth="1">
          {[[80, 92], [166, 142], [305, 94], [342, 280], [447, 293], [283, 325]].map(([x, y]) => <path key={x} d={`m${x} ${y - 7} 5 7-5 7-5-7Z`} />)}
        </g>
        <g stroke="#aab59a" strokeWidth="1" opacity=".5"><path d="M18 34V18h16m492 0h16v16M18 356v16h16m492 0h16v-16" /></g>
        <text x="23" y="53" fill="#707869" fontSize="9" fontFamily="monospace">X: 1600 / Y: 900</text>
      </svg>
      <div className="preview-command"><span className="command-icon"><Icon name="code" /></span><div><span>ИЗ КОДА — В ДЕЙСТВИЕ</span><code><b>moveTo</b>(resource)</code></div><span className="command-check"><Icon name="check" size={16} /></span></div>
      <div className="preview-caption"><span>Иллюстрация игрового поля</span><span>СОБИРАЙ. СОЗДАВАЙ. ПОБЕЖДАЙ.</span></div>
    </div>
  )
}

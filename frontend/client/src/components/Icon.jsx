const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  play: 'm8 5 11 7-11 7V5Z',
  code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  target: 'M22 12h-4M6 12H2M12 2v4m0 12v4m7-10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  gem: 'm12 3 8 9-8 9-8-9 8-9Zm-8 9h16M12 3l3 9-3 9-3-9 3-9Z',
  bot: 'M8 7V4m8 3V4M5 9h14v10H5V9Zm3 4h1m6 0h1m-7 3h6M2 12v4m20-4v4',
  copy: 'M9 9h11v11H9V9ZM5 15H3V3h12v2',
  check: 'm5 12 4 4L19 6',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.1 6a7 7 0 0 1 11.5-1L20 8M4 16l2.4 3A7 7 0 0 0 18 18',
  exit: 'M9 4H4v16h5m5-13 5 5-5 5m-5-5h10',
  book: 'M12 5v16m0-16C8 2 3 3 3 3v15s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l3 2',
  trophy: 'M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-7-3h6',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7Z',
}

export default function Icon({ name, size = 18, className = '' }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.bot} /></svg>
}

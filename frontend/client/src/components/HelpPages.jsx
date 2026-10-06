import Icon from './Icon'
import PageLink from './PageLink'

const example = `enemy = nearestEnemy()
resource = nearestResource()

if enemy:
    moveTo(enemy)
    attack(enemy)
else:
    if resource:
        moveTo(resource)
        collect()
    else:
        if random() < 0.05:
            moveTo(random() * 1600, random() * 900)

if canSpawn():
    spawn()`

const api = [
  ['nearestEnemy()', 'Ближайший видимый вражеский бот или база. Если никого нет — null.'],
  ['nearestResource()', 'Ближайший ресурс в радиусе зрения или null.'],
  ['nearestFriendly()', 'Ближайший видимый союзный бот или своя база. Сам бот не учитывается.'],
  ['moveTo(target) / moveTo(x, y)', 'Задать цель движения. Координаты изменяются на тиках; цель за пределами карты ограничивается её границами.'],
  ['attack(target)', 'Атаковать противника в пределах дальности и видимости. Учитывается перезарядка.'],
  ['collect()', 'Собрать ближайший ресурс, если он достаточно близко. Не более одного сбора за тик.'],
  ['canSpawn()', 'Вернуть true, если есть живая база, достаточно ресурсов и не достигнут лимит ботов.'],
  ['spawn()', 'Создать бота у базы, списать стоимость. Новому боту назначается текущая программа игрока.'],
  ['distance(target)', 'Расстояние от бота до переданной цели.'],
  ['random()', 'Случайное число от 0 включительно до 1 исключительно.'],
  ['getHealth()', 'Текущее здоровье этого бота.'],
  ['getResources()', 'Общий запас ресурсов игрока.'],
  ['getPosition()', 'Текущая позиция бота: её можно передать в moveTo или distance.'],
  ['getBase()', 'Своя живая база или null, если она уничтожена.'],
]

export function HowToPlay({ navigate }) {
  return <article className="docs-page">
    <header className="docs-heading"><p className="eyebrow">РУКОВОДСТВО / 01</p><h2 tabIndex={-1} data-page-title>Как играть</h2><p>От первой комнаты до первого работающего алгоритма.</p></header>
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="Разделы руководства"><a href="#join">01 / Подключение</a><a href="#rules">02 / Правила матча</a><a href="#program">03 / Программа ботов</a><a href="#finish">04 / Завершение</a><PageLink href="/reference" navigate={navigate}>Справочник API<Icon name="arrow" size={15} /></PageLink></nav>
      <div className="docs-body">
        <section className="doc-section panel" id="join"><span className="doc-number">01</span><h3>Создай комнату</h3><ol><li>На странице арены введи имя и нажми «Создать комнату».</li><li>Скопируй четырёхбуквенный код и отправь сопернику. Он вводит имя и код, затем нажимает «Войти».</li><li>Каждый участник нажимает «Готов». Когда готовы все, хост может начать матч.</li></ol><p>Для локальной проверки открой вторую вкладку. В начавшийся матч новые игроки уже не входят.</p></section>
        <section className="doc-section panel" id="rules"><span className="doc-number">02</span><h3>Развивай свою армию</h3><p>Каждый игрок получает одну базу и одного микробота. Кристаллы на карте — общий источник ресурсов. Боты собирают их, а запас принадлежит всему игроку.</p><p>Новых ботов можно создавать возле живой базы за ресурсы. В бою учитываются радиус зрения, дальность атаки и время перезарядки.</p><div className="doc-callout"><Icon name="trophy" /><p>Игрок выбывает, когда уничтожены и его база, и все боты. Побеждает последний выживший.</p></div></section>
        <section className="doc-section panel" id="program"><span className="doc-number">03</span><h3>Передай управление коду</h3><p>В начале матча работает встроенный AI. Измени программу в редакторе и нажми «Применить»: код назначается всем твоим текущим и будущим ботам.</p><pre className="reference-code"><code>{example}</code></pre><p>Программа запускается заново каждый тик. В примере бот ищет противника или ресурс, действует и создаёт подкрепление. Размеры карты в примере — стандартные; текущие значения указаны в справочнике.</p><p>«Пример» заполняет редактор, но не применяет текст. «Включить AI» возвращает встроенное управление. Синтаксис, ограничения и все функции описаны в <PageLink href="/reference" navigate={navigate}>справочнике</PageLink>.</p></section>
        <section className="doc-section panel" id="finish"><span className="doc-number">04</span><h3>После матча</h3><p>После победы симуляция останавливается. Хост может перезапустить матч: программы и режим управления сохраняются, базы и боты создаются заново, ресурсы восстанавливаются.</p><p>Выход из комнаты, закрытие вкладки или потеря соединения считается поражением. Возвращение в начавшийся матч не поддерживается. При выходе хоста его права получает следующий участник.</p><p>Переходы между ареной, руководством и справочником через навигацию сайта сохраняют подключение и текст в редакторе. Матч во время чтения продолжается. Перезагрузка страницы разрывает текущую сессию.</p></section>
      </div>
    </div>
  </article>
}

export function Reference({ navigate, config, configError }) {
  const parameters = config ? [
    ['Карта', `${config.mapWidth} × ${config.mapHeight}`], ['Тики', `${config.tickRate} / с`],
    ['Здоровье базы', config.baseHp], ['Здоровье бота', config.botHp],
    ['Скорость бота', `${config.botSpeed} / с`], ['Радиус зрения', config.visionRange],
    ['Дальность атаки', config.botAttackRange], ['Урон', config.botDamage],
    ['Перезарядка', `${config.botAttackCooldown} мс`], ['Радиус сбора', config.collectRange],
    ['Сбор за тик', config.collectAmount], ['Стоимость бота', config.botCost],
    ['Ботов на игрока', config.maxBotsPerPlayer], ['Игроков в комнате', config.maxPlayers],
    ['Ресурсов на карте', config.resourceCount], ['Запас в кристалле', config.resourceAmount],
    ['Восстановление ресурсов', `${config.resourceRespawnInterval / 1000} с`],
    ['Бюджет операций', `${config.scriptOperationLimit} / тик / бот`],
  ] : []
  return <article className="docs-page">
    <header className="docs-heading"><p className="eyebrow">СПРАВОЧНЫЙ ТЕРМИНАЛ / 02</p><h2 tabIndex={-1} data-page-title>Справочник</h2><p>Язык ботов, доступные команды и параметры текущей симуляции.</p></header>
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="Разделы справочника"><a href="#syntax">Синтаксис</a><a href="#api">Bot API</a><a href="#limits">Бюджет и ошибки</a><a href="#parameters">Параметры игры</a><a href="#controls">Интерфейс</a><PageLink href="/how-to-play" navigate={navigate}>Как играть<Icon name="arrow" size={15} /></PageLink></nav>
      <div className="docs-body">
        <section className="doc-section panel" id="syntax"><h3>Синтаксис</h3><p>Это небольшой язык с числовыми переменными, отступами из пробелов, условиями <code>if/else</code> и вызовами Bot API. Комментарии начинаются с <code>#</code>. Переменные создаются заново на каждом тике.</p><pre className="reference-code"><code>{`resource = nearestResource()\nif resource:\n    moveTo(resource)\n    collect()`}</code></pre><p>Выражения: <code>+ - * / %</code>, сравнения <code>== != &lt; &lt;= &gt; &gt;=</code>, логические <code>and / or / not</code>, значения <code>true / false / null</code>. Скобки меняют порядок вычислений.</p><p>Циклов, строк, массивов, доступа к свойствам объектов и произвольного JavaScript нет. Проверяй, что цель существует, прежде чем передавать её функции: <code>if enemy:</code>.</p></section>
        <section className="doc-section panel" id="api"><h3>Bot API</h3><p>Команды действий возвращают <code>null</code>. Запросы возвращают число, логическое значение или цель, которую можно передать другой функции.</p><div className="table-scroll"><table><thead><tr><th>Функция</th><th>Описание</th></tr></thead><tbody>{api.map(([name, description]) => <tr key={name}><td><code>{name}</code></td><td>{description}</td></tr>)}</tbody></table></div></section>
        <section className="doc-section panel" id="limits"><h3>Бюджет и ошибки</h3><p>Программа ограничена 8000 символами, 200 строками и 24 уровнями вложенности. У каждого бота есть бюджет операций на тик. Поиск целей расходует больше операций, чем простые команды.</p><p>Если бюджет исчерпан, уже подготовленные действия выполняются. Остаток программы пропускается, а на следующем тике выполнение начинается с первой строки. Индикатор редактора показывает максимальный расход среди твоих ботов.</p><p>Ошибка компиляции сохраняет предыдущую работающую программу. Ошибка исполнения отменяет действия конкретного бота за текущий тик и прекращает его движение; остальные боты продолжают играть. Номер строки и переход к ней находятся рядом с редактором. Если черновик уже изменён, ошибка помечается как относящаяся к применённой версии.</p></section>
        <section className="doc-section panel" id="parameters"><h3>Параметры игры</h3>{config ? <dl className="parameter-grid">{parameters.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p role="status">{configError || 'Загрузка параметров с сервера…'}</p>}</section>
        <section className="doc-section panel" id="controls"><h3>Интерфейс</h3><p>Короткие подсказки появляются при наведении на элементы и при переходе к ним клавишей Tab. Escape закрывает подсказку.</p><p>ЭЛТ-фильтр арены добавляет строки развёртки, цветовую маску и затемнение краёв. Кнопка «ЭЛТ» включает и выключает эффект. Фильтр не меняет игровое состояние, координаты или скорость симуляции.</p><p>Цвет сущностей соответствует игроку. Крупная шестиугольная фигура — база, маленький корпус — бот, золотой кристалл — ресурс. Короткий белый контур обозначает полученный урон.</p></section>
      </div>
    </div>
  </article>
}

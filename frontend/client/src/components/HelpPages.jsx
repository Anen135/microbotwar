import Icon from './Icon'
import PageLink from './PageLink'
import { botExample as example, controllerExample as baseExample } from '../programDefaults'

const api = [
  ['scan()', 'Объекты только в собственном радиусе обзора: id, type, position, x/y, distance, ownerId; у ресурса — resourceType. Скрытые объекты недоступны.'],
  ['moveTo(target) / moveTo(x, y)', 'Явная команда движения за текущий тик. Чтобы продолжать движение, повторяй её в программе.'],
  ['attack(target)', 'Атаковать видимого противника в дальности оружия, с учётом перезарядки и энергии.'],
  ['mine(target)', 'Добыть видимый ресурс в пределах дальности в груз бота. Запас игрока при этом не увеличивается.'],
  ['unload(base)', 'Разгрузить груз возле своей базы в запасы игрока. Возврат к базе нужно запрограммировать.'],
  ['send(channel, payload)', 'Отправить союзникам и базе в радиусе связи сообщение: sender, channel, payload, tick. Автоматической ретрансляции нет.'],
  ['receive()', 'Получить сообщения, доставленные этому агенту. Для событийной обработки используй on_message(message).'],
  ['getPosition() / getBase() / getHealth()', 'Своя позиция, своя живая база или null и своё здоровье.'],
  ['getCargo() / getEnergy() / getTags()', 'Свой груз по типам ресурсов, текущая энергия и пользовательские теги.'],
  ['setTag(key, value)', 'Назначить собственный пользовательский тег, например group или state.'],
  ['distance(target) / random() / len(value)', 'Расстояние от агента, случайное число от 0 до 1 и длина списка или строки.'],
]
const baseApi = [
  ['getResources()', 'Собственные запасы metal, energy, silicon.'],
  ['getBots() / count(programId)', 'Список своих ботов или число ботов выбранной программы.'],
  ['canSpawn(programId)', 'Проверить ресурсы, лимит ботов и наличие зарегистрированной программы.'],
  ['spawn(programId, tags)', 'Создать возле базы бота выбранной программы и конструкции. Теги необязательны. Решение о производстве принимает только код базы.'],
]

export function HowToPlay({ navigate }) {
  return <article className="docs-page">
    <header className="docs-heading"><p className="eyebrow">РУКОВОДСТВО / 01</p><h2 tabIndex={-1} data-page-title>Как играть</h2><p>Создавай взаимодействующие программы, которым принадлежит каждое решение.</p></header>
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="Разделы руководства"><a href="#join">01 / Подключение</a><a href="#rules">02 / Правила матча</a><a href="#program">03 / Программы</a><a href="#finish">04 / Завершение</a><PageLink href="/reference" navigate={navigate}>Справочник API<Icon name="arrow" size={15} /></PageLink></nav>
      <div className="docs-body">
        <section className="doc-section panel" id="join"><span className="doc-number">01</span><h3>Создай комнату</h3><ol><li>На странице арены введи имя и нажми «Создать комнату».</li><li>Скопируй четырёхбуквенный код и отправь сопернику. Он вводит имя и код, затем нажимает «Войти».</li><li>Подготовь программы. Каждый участник нажимает «Готов», затем хост начинает матч.</li></ol><p>Для локальной проверки открой вторую вкладку. В начавшийся матч новые игроки уже не входят.</p></section>
        <section className="doc-section panel" id="rules"><span className="doc-number">02</span><h3>Спроектируй армию</h3><p>Игрок начинает с базы и одного бота программы default. Без программы бот стоит на месте. Движение, добыча, разгрузка, атака, сообщения и производство требуют явных команд.</p><p>Metal, energy и silicon сначала попадают в груз добывающего бота. Запасы базы растут только после разгрузки. Конструкция определяет скорость, броню, атаку, обзор, груз, связь, CPU и энергию; распределяй ограниченные очки по задачам программы.</p><p>На карте видны только объекты в обзоре твоих ботов и базы. Тусклая отметка «Видели … с назад» показывает старую позицию, а не текущее положение объекта. Сообщения доходят только в радиусе связи; протоколы разведки и ретрансляции пиши самостоятельно.</p><div className="doc-callout"><Icon name="trophy" /><p>Игрок выбывает, когда уничтожены его база и все боты. Побеждает последний выживший.</p></div></section>
        <section className="doc-section panel" id="program"><span className="doc-number">03</span><h3>Раздели обязанности программ</h3><p>Выбери default или добавь программу с собственным именем: miner, scout, fighter. Имя начинается с латинской буквы и содержит до 32 букв, цифр, подчёркиваний или дефисов. Для каждой программы хранятся отдельный код и конструкция. Нажми «Применить», чтобы сохранить выбранную программу. Распределение очков влияет на новых ботов.</p><pre className="reference-code"><code>{example}</code></pre><p>Этот пример явно добывает и доставляет ресурс. Он не ищет цели за пределами scan(). Для разведки можно запоминать точки в memory и отправлять сообщения другим ботам.</p><p>В списке программ выбери Base Controller и задай производство:</p><pre className="reference-code"><code>{baseExample}</code></pre><p>«Пример» только заполняет текущий редактор. Пустую программу тоже можно применить. Все команды описаны в <PageLink href="/reference" navigate={navigate}>справочнике</PageLink>.</p></section>
        <section className="doc-section panel" id="finish"><span className="doc-number">04</span><h3>После матча</h3><p>После победы симуляция останавливается. Хост может перезапустить матч: программы и конструкции сохраняются, память ботов и состояние матча создаются заново.</p><p>Выход, закрытие вкладки или потеря соединения считается поражением. Возвращение в начавшийся матч не поддерживается. При выходе хоста его права получает следующий участник.</p><p>Навигация по сайту сохраняет подключение и черновики. Во время чтения матч продолжается. Перезагрузка страницы разрывает сессию.</p></section>
      </div>
    </div>
  </article>
}

export function Reference({ navigate, config, configError }) {
  const parameters = config ? [
    ['Карта', `${config.mapWidth} × ${config.mapHeight}`], ['Тики', `${config.tickRate} / с`],
    ['Здоровье базы', config.baseHp], ['Очки конструкции', config.designPoints],
    ['Ботов на игрока', config.maxBotsPerPlayer], ['Игроков в комнате', config.maxPlayers],
    ['Ресурсов на карте', config.resourceCount], ['Запас в месторождении', config.resourceAmount],
    ['Восстановление ресурсов', `${config.resourceRespawnInterval / 1000} с`],
    ['Базовый бюджет CPU', `${config.scriptOperationLimit} / тик`],
  ].filter(([, value]) => value !== undefined) : []
  return <article className="docs-page">
    <header className="docs-heading"><p className="eyebrow">СПРАВОЧНЫЙ ТЕРМИНАЛ / 02</p><h2 tabIndex={-1} data-page-title>Справочник</h2><p>Язык агентов, локальные данные и явные команды.</p></header>
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="Разделы справочника"><a href="#syntax">Синтаксис</a><a href="#api">Bot API</a><a href="#base-api">Base API</a><a href="#limits">Бюджеты и ошибки</a><a href="#parameters">Параметры игры</a><a href="#controls">Интерфейс</a><PageLink href="/how-to-play" navigate={navigate}>Как играть<Icon name="arrow" size={15} /></PageLink></nav>
      <div className="docs-body">
        <section className="doc-section panel" id="syntax"><h3>Синтаксис и события</h3><p>Язык поддерживает числа, строки, списки, словари, доступ к полям и индексам, условия <code>if/elif/else</code>, цикл <code>for item in list:</code> и комментарии <code>#</code>. Отступы задаются пробелами. Выражения: <code>+ - * / %</code>, сравнения, <code>and / or / not</code>, значения <code>true / false / null</code>.</p><p>Код верхнего уровня и <code>on_tick()</code> выполняются каждый тик. Можно определить <code>on_spawn()</code>, <code>on_message(message)</code> и <code>on_damage(attacker)</code>. Обычные переменные создаются заново; <code>memory</code> сохраняется у конкретного агента и очищается при его уничтожении.</p><pre className="reference-code"><code>{`def on_message(message):
    if message.channel == "enemy_found":
        memory["target"] = message.payload

def on_tick():
    if memory["target"]:
        moveTo(memory["target"].x, memory["target"].y)`}</code></pre><p>Проверяй существование цели перед действием. Программа не имеет доступа к JavaScript, серверу или глобальному состоянию матча.</p></section>
        <section className="doc-section panel" id="api"><h3>Bot API</h3><p>Каждый бот получает только свой обзор, память, теги и сообщения. Не существует глобального поиска противников или ресурсов.</p><div className="table-scroll"><table><thead><tr><th>Функция</th><th>Описание</th></tr></thead><tbody>{api.map(([name, description]) => <tr key={name}><td><code>{name}</code></td><td>{description}</td></tr>)}</tbody></table></div></section>
        <section className="doc-section panel" id="base-api"><h3>Base Controller API</h3><p>База имеет собственную программу, обзор, память и радиус связи. Доступны scan(), send(), receive() и свои сведения. Она не видит скрытых противников. Производство доступно только контроллеру базы.</p><div className="table-scroll"><table><thead><tr><th>Функция</th><th>Описание</th></tr></thead><tbody>{baseApi.map(([name, description]) => <tr key={name}><td><code>{name}</code></td><td>{description}</td></tr>)}</tbody></table></div></section>
        <section className="doc-section panel" id="limits"><h3>CPU, энергия и ошибки</h3><p>CPU ограничивает количество операций за тик. Стоимость есть у выражений, условий, итераций и вызовов API; scan() стоит дороже простой команды. При исчерпании CPU выполнение этого агента прекращается до следующего тика, подготовленные команды сохраняются.</p><p>Энергия отдельно ограничивает физические действия: движение, обзор, атаку, добычу и связь. Она восстанавливается постепенно. Недостаток энергии не запускает запасное поведение. Конструкция позволяет увеличить CPU и энергию за очки.</p><p>Ошибка компиляции сохраняет предыдущую программу. Индикатор редактора показывает расход операций; номер строки помогает найти ошибку. Черновики программ и базы сохраняются отдельно.</p></section>
        <section className="doc-section panel" id="parameters"><h3>Параметры игры</h3>{config ? <dl className="parameter-grid">{parameters.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p role="status">{configError || 'Загрузка параметров с сервера…'}</p>}</section>
        <section className="doc-section panel" id="controls"><h3>Интерфейс</h3><p>Редактор переключается между независимыми программами и Base Controller. Инспектор под ареной показывает энергию, груз, CPU, память и теги своих ботов. Запасы и полное число ботов соперника скрыты.</p><p>Подсказки появляются при наведении и фокусе клавишей Tab; Escape их закрывает. «ЭЛТ» переключает только визуальный фильтр карты.</p><p>Цвет базы и бота соответствует владельцу. Ресурсы: metal — золотой, energy — зелёный, silicon — фиолетовый. Белый контур показывает полученный урон.</p></section>
      </div>
    </div>
  </article>
}

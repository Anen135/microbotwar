const { definitions } = require('./Api')
const { safeKey, cloneData, readKey, writeKey } = require('./data')

const MAX_SOURCE = 8000
const MAX_LINES = 200
const MAX_DEPTH = 24
const precedence = { or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 }
const literals = { true: true, false: false, null: null, True: true, False: false, None: null }
const fail = (line, message) => { throw new Error(`Line ${line}: ${message}`) }
const reserved = name => Object.hasOwn(definitions, name) || Object.hasOwn(literals, name)
  || ['if', 'elif', 'else', 'for', 'in', 'def', 'and', 'or', 'not', 'memory', 'tags'].includes(name)

function parseExpression(source, line) {
  const tokens = []
  let remaining = source.trim()
  while (remaining) {
    const token = remaining.match(/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|[.\[\]{}:()+\-*/%,<>])/)
    if (!token) fail(line, `Unexpected character "${remaining[0]}"`)
    tokens.push(token[0])
    remaining = remaining.slice(token[0].length).trimStart()
  }
  let index = 0
  function expect(token) { if (tokens[index++] !== token) fail(line, `Expected "${token}"`) }
  function expression(min = 0, depth = 0) {
    if (depth > MAX_DEPTH) fail(line, 'Expression nesting is too deep')
    const token = tokens[index++]
    let node
    if (token === '-' || token === '+' || token === 'not') {
      node = { type: 'unary', op: token, value: expression(token === 'not' ? 3 : 7, depth + 1), line }
    } else if (token === '(') { node = expression(0, depth + 1); expect(')') }
    else if (token === '[') {
      const items = []
      while (tokens[index] !== ']') {
        items.push(expression(0, depth + 1))
        if (tokens[index] !== ',') break
        index += 1
      }
      expect(']')
      node = { type: 'list', items, line }
    } else if (token === '{') {
      const items = []
      while (tokens[index] !== '}') {
        const key = expression(0, depth + 1)
        expect(':')
        items.push({ key, value: expression(0, depth + 1) })
        if (tokens[index] !== ',') break
        index += 1
      }
      expect('}')
      node = { type: 'dict', items, line }
    } else if (token && /^["']/.test(token)) {
      const value = token.slice(1, -1).replace(/\\([\\"'nrt])/g, (_, char) => ({ n: '\n', r: '\r', t: '\t' })[char] ?? char)
      if (value.length > 1024) fail(line, 'String is too long')
      node = { type: 'literal', value, line }
    } else if (token && /^\d/.test(token)) {
      const value = Number(token)
      if (!Number.isFinite(value)) fail(line, 'Number is too large')
      node = { type: 'literal', value, line }
    } else if (Object.hasOwn(literals, token)) node = { type: 'literal', value: literals[token], line }
    else if (token && /^[A-Za-z_]\w*$/.test(token)) {
      safeKey(token)
      if (tokens[index] === '(') {
        if (!Object.hasOwn(definitions, token)) {
          const suggestion = Object.keys(definitions).find(name => name.slice(0, 3) === token.slice(0, 3))
          fail(line, `Unknown function "${token}"${suggestion ? `. Did you mean "${suggestion}"?` : ''}`)
        }
        index += 1
        const args = []
        while (tokens[index] !== ')') {
          args.push(expression(0, depth + 1))
          if (tokens[index] !== ',') break
          index += 1
        }
        expect(')')
        if (!definitions[token].args.includes(args.length)) fail(line, `Wrong argument count for ${token}`)
        node = { type: 'call', name: token, args, line }
      } else node = { type: 'variable', name: token, line }
    } else fail(line, 'Expected an expression')
    let accesses = 0
    while (tokens[index] === '.' || tokens[index] === '[') {
      if (++accesses + depth > MAX_DEPTH) fail(line, 'Expression nesting is too deep')
      const access = tokens[index++]
      let key
      if (access === '.') {
        const name = tokens[index++]
        if (!name || !/^[A-Za-z_]\w*$/.test(name)) fail(line, 'Expected a field name')
        safeKey(name)
        key = { type: 'literal', value: name, line }
      } else { key = expression(0, depth + 1); expect(']') }
      node = { type: 'access', object: node, key, line }
    }
    while (Object.hasOwn(precedence, tokens[index]) && precedence[tokens[index]] >= min) {
      const op = tokens[index++]
      node = { type: 'binary', op, left: node, right: expression(precedence[op] + 1, depth + 1), line }
    }
    return node
  }
  const result = expression()
  if (index !== tokens.length) fail(line, `Unexpected token "${tokens[index]}"`)
  return result
}

function uncomment(raw) {
  let quote = null
  for (let i = 0; i < raw.length; i += 1) {
    if (quote && raw[i] === '\\') { i += 1; continue }
    if (raw[i] === quote) quote = null
    else if (!quote && (raw[i] === '"' || raw[i] === "'")) quote = raw[i]
    else if (!quote && raw[i] === '#') return raw.slice(0, i)
  }
  return raw
}

function assignmentSplit(text) {
  let quote = null
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quote && char === '\\') { i += 1; continue }
    if (char === quote) quote = null
    else if (!quote && (char === '"' || char === "'")) quote = char
    else if (!quote && char === '=' && !'!=<>'.includes(text[i - 1]) && text[i + 1] !== '=') {
      return [text.slice(0, i).trim(), text.slice(i + 1).trim()]
    }
  }
  return null
}

function compile(source) {
  if (typeof source !== 'string' || source.length > MAX_SOURCE) throw new Error(`Program must contain at most ${MAX_SOURCE} characters`)
  const rawLines = source.split(/\r?\n/)
  if (rawLines.length > MAX_LINES) throw new Error(`Program must contain at most ${MAX_LINES} lines`)
  const lines = rawLines.map((raw, index) => {
    const text = uncomment(raw).trimEnd()
    if (text.includes('\t')) fail(index + 1, 'Use spaces instead of tabs')
    return { text: text.trimStart(), indent: text.length - text.trimStart().length, line: index + 1 }
  }).filter(item => item.text)
  if (!lines.length) return { tick: [], events: Object.create(null) }
  if (lines[0].indent !== 0) fail(lines[0].line, 'Unexpected indentation')
  let cursor = 0
  const events = Object.create(null)
  function child(indent, depth, line) {
    if (!lines[cursor] || lines[cursor].indent <= indent) fail(line, 'Expected an indented block')
    return block(lines[cursor].indent, depth + 1)
  }
  function conditional(text, line, indent, depth) {
    if (depth > MAX_DEPTH) fail(line, 'Too many nested blocks')
    const test = parseExpression(text, line)
    const yes = child(indent, depth, line)
    let no = []
    if (lines[cursor]?.indent === indent) {
      const next = lines[cursor]
      const elif = next.text.match(/^elif\s+(.+):$/)
      if (elif) { cursor += 1; no = [conditional(elif[1], next.line, indent, depth + 1)] }
      else if (next.text === 'else:') { cursor += 1; no = child(indent, depth, next.line) }
    }
    return { type: 'if', test, yes, no, line }
  }
  function block(indent, depth = 0) {
    if (depth > MAX_DEPTH) fail(lines[cursor]?.line ?? 1, 'Too many nested blocks')
    const statements = []
    while (cursor < lines.length && lines[cursor].indent >= indent) {
      const { text, line, indent: current } = lines[cursor]
      if (current !== indent) fail(line, 'Unexpected indentation')
      if (text === 'else:' || text.startsWith('elif ')) break
      cursor += 1
      const condition = text.match(/^if\s+(.+):$/)
      const loop = text.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.+):$/)
      const handler = text.match(/^def\s+(on_spawn|on_tick|on_message|on_damage)\(([^)]*)\):$/)
      if (handler) {
        if (indent !== 0) fail(line, 'Event handlers must be defined at top level')
        const name = handler[1]
        const parameter = { on_spawn: '', on_tick: '', on_message: 'message', on_damage: 'attacker' }[name]
        if (handler[2].trim() !== parameter) fail(line, `Expected ${name}(${parameter})`)
        if (Object.hasOwn(events, name)) fail(line, `Duplicate handler ${name}`)
        events[name] = { parameter, body: child(indent, depth, line) }
      } else if (condition) statements.push(conditional(condition[1], line, indent, depth))
      else if (loop) {
        if (reserved(loop[1])) fail(line, 'Reserved loop variable')
        safeKey(loop[1])
        statements.push({ type: 'for', name: loop[1], value: parseExpression(loop[2], line), body: child(indent, depth, line), line })
      } else if (text === 'pass') statements.push({ type: 'pass', line })
      else {
        const assignment = assignmentSplit(text)
        if (assignment) {
          const target = parseExpression(assignment[0], line)
          if (!['variable', 'access'].includes(target.type)) fail(line, 'Expected an assignment target')
          if (target.type === 'variable' && reserved(target.name)) fail(line, `Reserved name "${target.name}"`)
          statements.push({ type: 'assign', target, value: parseExpression(assignment[1], line), line })
        } else {
          const value = parseExpression(text, line)
          if (value.type !== 'call') fail(line, 'Expected assignment or API call')
          statements.push({ type: 'expression', value, line })
        }
      }
    }
    return statements
  }
  const program = block(0)
  if (cursor !== lines.length) fail(lines[cursor].line, 'Unexpected else or indentation')
  const pending = [...program, ...Object.values(events).flatMap(event => event.body)].map(node => [node, 0])
  while (pending.length) {
    const [node, depth] = pending.pop()
    if (depth > MAX_DEPTH) fail(node.line ?? 1, 'AST nesting is too deep')
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item === 'object') pending.push([item, depth + 1])
      } else if (value && typeof value === 'object') pending.push([value, depth + 1])
    }
  }
  return { tick: [...program, ...(events.on_tick?.body ?? [])], events }
}

function run(program, functions, limit = 100, context = {}) {
  const variables = Object.assign(Object.create(null), context.variables ?? {})
  const budget = context.budget ?? { used: 0, limit }
  let activeLine = 1
  const exhausted = Symbol('budget')
  function spend(cost = context.operationCost ?? 1) {
    if (budget.used + cost > budget.limit) throw exhausted
    budget.used += cost
  }
  function number(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expected a finite number')
    return value
  }
  function evaluate(node) {
    activeLine = node.line
    spend()
    switch (node.type) {
      case 'literal': return node.value
      case 'variable':
        if (!Object.hasOwn(variables, node.name)) throw new Error(`Unknown variable "${node.name}"`)
        return variables[node.name]
      case 'access': return readKey(evaluate(node.object), evaluate(node.key))
      case 'list': return cloneData(node.items.map(evaluate))
      case 'dict': {
        const result = Object.create(null)
        for (const item of node.items) writeKey(result, evaluate(item.key), evaluate(item.value))
        return cloneData(result)
      }
      case 'call': {
        const args = node.args.map(evaluate)
        spend(context.costs?.[node.name] ?? definitions[node.name].cost)
        if (typeof functions[node.name] !== 'function') throw new Error(`${node.name} is unavailable for this controller`)
        return functions[node.name](...args)
      }
      case 'unary': {
        const value = evaluate(node.value)
        return node.op === 'not' ? !value : number(node.op === '-' ? -number(value) : number(value))
      }
      case 'binary': {
        const left = evaluate(node.left)
        if (node.op === 'and') return left ? evaluate(node.right) : left
        if (node.op === 'or') return left || evaluate(node.right)
        const right = evaluate(node.right)
        if (node.op === '==') return left === right
        if (node.op === '!=') return left !== right
        if (node.op === '+' && typeof left === 'string' && typeof right === 'string') {
          if (left.length + right.length > 1024) throw new Error('String is too long')
          return left + right
        }
        const a = number(left)
        const b = number(right)
        switch (node.op) {
          case '+': return number(a + b)
          case '-': return number(a - b)
          case '*': return number(a * b)
          case '/': return number(a / b)
          case '%': return number(a % b)
          case '<': return a < b
          case '<=': return a <= b
          case '>': return a > b
          case '>=': return a >= b
        }
      }
    }
    throw new Error('Invalid expression')
  }
  function execute(statements) {
    for (const statement of statements) {
      activeLine = statement.line
      spend()
      if (statement.type === 'if') execute(evaluate(statement.test) ? statement.yes : statement.no)
      else if (statement.type === 'for') {
        const value = evaluate(statement.value)
        if (!Array.isArray(value)) throw new Error('for requires a list')
        for (const item of [...value]) { spend(); variables[statement.name] = item; execute(statement.body) }
      } else if (statement.type === 'assign') {
        const value = evaluate(statement.value)
        if (statement.target.type === 'variable') variables[statement.target.name] = value
        else writeKey(evaluate(statement.target.object), evaluate(statement.target.key), value)
      } else if (statement.type !== 'pass') evaluate(statement.value)
    }
  }
  try {
    execute(Array.isArray(program) ? program : context.event ? program.events[context.event]?.body ?? [] : program.tick)
    return { cpu: budget.used, error: null, limited: false }
  } catch (error) {
    if (error === exhausted) return { cpu: budget.used, error: null, limited: true }
    return { cpu: budget.used, error: `Line ${activeLine}: ${error.message}`, limited: false }
  }
}

module.exports = { compile, run, MAX_SOURCE }

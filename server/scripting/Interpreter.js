const { definitions } = require('./Api')

const MAX_SOURCE = 8000
const MAX_LINES = 200
const MAX_DEPTH = 24
const precedence = { or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 }
const literals = { true: true, false: false, null: null, True: true, False: false, None: null }
const fail = (line, message) => { throw new Error(`Line ${line}: ${message}`) }

function parseExpression(source, line) {
  const tokens = []
  let remaining = source.trim()
  while (remaining) {
    const token = remaining.match(/^(?:\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|[()+\-*/%,<>])/)
    if (!token) fail(line, `Unexpected character "${remaining[0]}"`)
    tokens.push(token[0])
    remaining = remaining.slice(token[0].length).trimStart()
  }
  let index = 0
  function expression(min = 0, depth = 0) {
    if (depth > MAX_DEPTH) fail(line, 'Expression nesting is too deep')
    const token = tokens[index++]
    let node
    if (token === '-' || token === '+' || token === 'not') {
      node = { type: 'unary', op: token, value: expression(token === 'not' ? 3 : 7, depth + 1), line }
    } else if (token === '(') {
      node = expression(0, depth + 1)
      if (tokens[index++] !== ')') fail(line, 'Expected closing parenthesis')
    } else if (token && /^\d/.test(token)) {
      const value = Number(token)
      if (!Number.isFinite(value)) fail(line, 'Number is too large')
      node = { type: 'literal', value, line }
    } else if (Object.hasOwn(literals, token)) {
      node = { type: 'literal', value: literals[token], line }
    } else if (token && /^[A-Za-z_]\w*$/.test(token)) {
      if (tokens[index] === '(') {
        if (!Object.hasOwn(definitions, token)) {
          const suggestion = Object.keys(definitions).find(name => name.slice(0, 3) === token.slice(0, 3))
          fail(line, `Unknown function "${token}"${suggestion ? `. Did you mean "${suggestion}"?` : ''}`)
        }
        index += 1
        const args = []
        if (tokens[index] !== ')') {
          do {
            args.push(expression(0, depth + 1))
            if (tokens[index] !== ',') break
            index += 1
          } while (true)
        }
        if (tokens[index++] !== ')') fail(line, 'Expected closing parenthesis')
        if (!definitions[token].args.includes(args.length)) fail(line, `Wrong argument count for ${token}`)
        node = { type: 'call', name: token, args, line }
      } else node = { type: 'variable', name: token, line }
    } else fail(line, 'Expected an expression')

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

function compile(source) {
  if (typeof source !== 'string' || source.length > MAX_SOURCE) throw new Error(`Program must contain at most ${MAX_SOURCE} characters`)
  const rawLines = source.split(/\r?\n/)
  if (rawLines.length > MAX_LINES) throw new Error(`Program must contain at most ${MAX_LINES} lines`)
  const lines = rawLines.map((raw, index) => {
    const text = raw.split('#')[0].trimEnd()
    if (text.includes('\t')) fail(index + 1, 'Use spaces instead of tabs')
    return { text: text.trimStart(), indent: text.length - text.trimStart().length, line: index + 1 }
  }).filter(item => item.text)
  if (!lines.length) throw new Error('Program is empty')
  if (lines[0].indent !== 0) fail(lines[0].line, 'Unexpected indentation')
  let cursor = 0
  function block(indent, depth = 0) {
    if (depth > MAX_DEPTH) fail(lines[cursor].line, 'Too many nested blocks')
    const statements = []
    while (cursor < lines.length && lines[cursor].indent >= indent) {
      const { text, line, indent: current } = lines[cursor]
      if (current !== indent) fail(line, 'Unexpected indentation')
      if (text === 'else:') break
      cursor += 1
      const condition = text.match(/^if\s+(.+):$/)
      if (condition) {
        const test = parseExpression(condition[1], line)
        if (!lines[cursor] || lines[cursor].indent <= indent) fail(line, 'Expected an indented block')
        const yes = block(lines[cursor].indent, depth + 1)
        let no = []
        if (lines[cursor]?.indent === indent && lines[cursor].text === 'else:') {
          cursor += 1
          if (!lines[cursor] || lines[cursor].indent <= indent) fail(line, 'Expected a block after else')
          no = block(lines[cursor].indent, depth + 1)
        }
        statements.push({ type: 'if', test, yes, no, line })
      } else {
        const assignment = text.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/)
        if (assignment) {
          const name = assignment[1]
          if (Object.hasOwn(definitions, name) || Object.hasOwn(literals, name)
            || ['if', 'else', 'and', 'or', 'not'].includes(name)) fail(line, `Reserved name "${name}"`)
          statements.push({ type: 'assign', name, value: parseExpression(assignment[2], line), line })
        } else {
          const value = parseExpression(text, line)
          if (value.type !== 'call') fail(line, 'Expected assignment or Bot API call')
          statements.push({ type: 'expression', value, line })
        }
      }
    }
    return statements
  }
  const program = block(0)
  if (cursor !== lines.length) fail(lines[cursor].line, 'Unexpected else or indentation')
  return program
}

function run(program, functions, limit = 100) {
  const variables = Object.create(null)
  let used = 0
  let activeLine = 1
  const exhausted = Symbol('budget')
  function spend(cost = 1) {
    if (used + cost > limit) throw exhausted
    used += cost
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
      case 'call': {
        const args = node.args.map(evaluate)
        spend(definitions[node.name].cost)
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
      else if (statement.type === 'assign') variables[statement.name] = evaluate(statement.value)
      else evaluate(statement.value)
    }
  }
  try {
    execute(program)
    return { cpu: used, error: null, limited: false }
  } catch (error) {
    if (error === exhausted) return { cpu: used, error: null, limited: true }
    return { cpu: used, error: `Line ${activeLine}: ${error.message}`, limited: false }
  }
}

module.exports = { compile, run, MAX_SOURCE }

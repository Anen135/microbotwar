const forbidden = new Set(['__proto__', 'prototype', 'constructor'])

function validateProgramId(programId) {
  if (typeof programId !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(programId)) throw new Error('Program ID must be 1-32 letters, digits, underscores or hyphens')
  return programId
}

function safeKey(key) {
  if ((typeof key !== 'string' && typeof key !== 'number') || forbidden.has(String(key))) throw new Error('Invalid or forbidden data key')
  return String(key)
}

function cloneData(value, maxBytes = 8192) {
  let nodes = 0
  const ancestors = new Set()
  function copy(item, depth) {
    if (++nodes > 512 || depth > 8) throw new Error('Data is too large or deeply nested')
    if (item === null || typeof item === 'boolean') return item
    if (typeof item === 'number' && Number.isFinite(item)) return item
    if (typeof item === 'string' && item.length <= 1024) return item
    if (!item || typeof item !== 'object' || ancestors.has(item)) throw new Error('Expected finite, acyclic public data')
    const proto = Object.getPrototypeOf(item)
    if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) throw new Error('Expected plain data')
    ancestors.add(item)
    const result = Array.isArray(item) ? [] : Object.create(null)
    if (Array.isArray(item) && item.length > 256) throw new Error('List is too large')
    for (const key of Object.keys(item)) { safeKey(key); result[key] = copy(item[key], depth + 1) }
    ancestors.delete(item)
    return result
  }
  const result = copy(value, 0)
  if (Buffer.byteLength(JSON.stringify(result)) > maxBytes) throw new Error('Data exceeds its size limit')
  return result
}

function readKey(value, key) {
  const name = safeKey(key)
  if (!value || typeof value !== 'object') throw new Error('Expected a list or dictionary')
  return Object.hasOwn(value, name) ? value[name] : null
}

function writeKey(value, key, item) {
  const name = safeKey(key)
  if (!value || typeof value !== 'object') throw new Error('Expected a list or dictionary')
  if (Array.isArray(value) && (!/^\d+$/.test(name) || Number(name) > value.length || Number(name) >= 256)) throw new Error('Invalid list index')
  if (!Object.hasOwn(value, name) && Object.keys(value).length >= 256) throw new Error('Dictionary is too large')
  value[name] = item
}

module.exports = { safeKey, cloneData, readKey, writeKey, validateProgramId }

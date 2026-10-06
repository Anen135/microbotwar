const { compile } = require('./Interpreter')
const defaults = require('../game/config')
const { validateDesign } = require('../game/design')

const { validateProgramId } = require('./data')

class ProgramRegistry {
  constructor(config = defaults) {
    this.config = config
    this.programs = new Map()
    this.apply('default', '')
  }

  apply(programId, source, design) {
    validateProgramId(programId)
    if (!this.programs.has(programId) && this.programs.size >= this.config.maxPrograms) throw new Error(`At most ${this.config.maxPrograms} programs are allowed`)
    const validatedDesign = validateDesign(design === undefined ? this.programs.get(programId)?.design ?? {} : design, this.config)
    const program = compile(source)
    const entry = Object.freeze({ programId, source, program, design: validatedDesign })
    this.programs.set(programId, entry)
    return entry
  }

  get(programId) { return this.programs.get(programId) }
}

module.exports = { ProgramRegistry, validateProgramId }

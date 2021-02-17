import parseCommand from './parseCommand'
import getExports from './getExports'
import readCLI from './readCLI'
import stripProperties from './stripProperties'

class CommandFunctions {
  constructor(commandFunctions, options = {}) {
    const commandsConfig = (this.commandsConfig = {})
    const commandMap = {}
    let defaultCommand = null
    Object.entries(commandFunctions).forEach(([commandName, commandConfig]) => {
      const commandOptions = parseCommand(commandConfig, { defaultName: commandName })
      commandMap[commandOptions.name] = commandOptions
      if (commandOptions.defaultCommand === true) {
        if (defaultCommand !== null) throw new Error('Found multiple default commands')
        defaultCommand = commandOptions.name
      }
    })
    commandsConfig.commandMap = commandMap
    commandsConfig.defaultCommand = defaultCommand
    this.options = options
    this.commandsOptions = stripProperties(this.options, ['defaultCommand'], true)
    this.getExports = this.getExports.bind(this)
    this.runCLI = this.runCLI.bind(this)
    this.exports = null
  }
  getExports() {
    if (this.exports !== null) return this.exports
    let newExports = getExports(this.commandsConfig, this.commandsOptions)
    if (typeof this.options.exports == 'object' && this.options.exports !== null) {
      newExports = { ...this.options.exports, ...newExports }
    }
    return (this.exports = newExports)
  }
  async runCLI(...minimistOptions) {
    const cliArgs = await readCLI(this.commandsConfig, this.commandsOptions, minimistOptions)
    const exports = await this.getExports()
    const { commandName, options } = cliArgs
    if (!exports.hasOwnProperty(commandName))
      throw new Error('Missing the export for the command ' + commandName)
    let output
    if (typeof options == 'object' && options !== null) {
      output = await exports[commandName](...cliArgs.primaryArgs, options)
    } else {
      output = await exports[commandName](...cliArgs.primaryArgs)
    }
    return output
  }
}

export default CommandFunctions

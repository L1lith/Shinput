import parseCommand from './parseCommand'
import readCLI from './readCLI'
import stripProperties from './stripProperties'
import { sanitize } from 'sandhands'
import { inspect } from 'util'
import onlyUnique from './onlyUnique'
import stripString from './stripString'
import createCommandHandler from './createCommandHandler'
import Options from './Options'
import autoBind from 'auto-bind'

const proxyHandlers = {}
proxyHandlers.set =
  proxyHandlers.deleteProperty =
  proxyHandlers.defineProperty =
    () => {
      throw new Error('Cannot overwrite the library object')
    }

class CommandFunctions {
  constructor(commandFunctions, options = {}) {
    autoBind(this)
    const commandsConfig = (this.commandsConfig = {})
    const commandMap = {}
    // TODO: REMOVE THIS ITS SLOW
    Object.entries(commandFunctions).forEach(([commandName, commandConfig]) => {
      const commandOptions = parseCommand(commandConfig, { defaultName: commandName })
      commandMap[commandOptions.name] = commandOptions
    })
    this.options = options
    commandsConfig.commands = commandMap
    commandsConfig.defaultCommand = options.defaultCommand || null
    if (typeof options?.exports == 'object' && options?.exports !== null) {
      this.staticExports = options.exports
    } else {
      this.staticExports = {}
    }
    this.propertyList = Object.keys(this.commandsConfig.commands)
      .concat(Object.keys(this.staticExports))
      .filter(onlyUnique)
    this.options = options
    this.commandsOptions = stripProperties(this.options, ['defaultCommand'], true)
    this.getExports = this.getExports.bind(this)
    this.runCLI = this.runCLI.bind(this)
    this.autoRun = this.autoRun.bind(this)
    this.exports = {}
  }
  async runCLI(...minimistOptions) {
    const cliArgs = await readCLI(this.commandsConfig, this.commandsOptions, minimistOptions)
    const { commandName, options, primaryArgs = [], format } = cliArgs
    if (cliArgs.hasOwnProperty('format')) {
      sanitize({ ...options, _: primaryArgs }, format)
    }

    let output = this.getExport(commandName)
    //console.log('m', primaryArgs, options)
    if (typeof output == 'function') {
      output = output(...primaryArgs, new Options(options))
    }
    output = await output
    if (output !== undefined) console.log(inspect(output, { colors: true })) // TODO: Make Colors Toggleable
    return output
  }
  autoRun(doExit = true) {
    const isParentShell = require.main === module.parent
    if (isParentShell) {
      this.runCLI()
        .then(() => {
          if (doExit === true) {
            process.exit(0)
          }
        })
        .catch(error => {
          console.error(error)
          if (doExit === true) {
            process.exit(1)
          }
        })
      return null
    } else {
      return this.getExports()
    }
  }
  getExports() {
    const proxyProtocol = {
      ownKeys: this.getKeys,
      enumerate: this.getKeys,
      get: (target, prop) => {
        this.getExport(prop)
        return Reflect.get(target, prop)
      },
      has: (target, prop) => {
        const { type, match } = this.findProp(prop)
        return match !== null
      },
      getOwnPropertyDescriptor: (target, prop) => {
        if (this.findProp(prop).match !== null) {
          // called for every property
          return {
            value: this.getExport(prop),
            enumerable: true,
            configurable: false,
            writable: false
            /* ...other flags, probable "value:..." */
          }
        } else {
          //return { enumerable: false, configurable: false }
        }
      },
      ...proxyHandlers
    }
    return new Proxy(this.exports, proxyProtocol)
  }
  getKeys() {
    //console.log('x', this.propertyList)
    return this.propertyList
  }
  findProp(name = null) {
    if (name === null && this.defaultCommand) name = this.defaultCommand
    if (typeof name != 'string') throw new Error('Invalid Command Name')

    const searchName = stripString(name)
    //if (this.exports.hasOwnProperty(searchName)) return this.exports[searchName]
    const commandMatch = Object.keys(this.commandsConfig.commands).find(
      commandName => stripString(commandName) === searchName
    )
    const exportMatch = Object.keys(this.staticExports).find(
      exportName => stripString(exportName) === searchName
    )
    if (commandMatch && exportMatch) throw new Error('Found duplicate exports for ' + name)
    return {
      type: commandMatch ? 'command' : exportMatch ? 'export' : 'none',
      match: commandMatch || exportMatch || null
    }
  }
  getExport(name) {
    const { match, type } = this.findProp(name)
    let output
    if (type === 'command') {
      const commandConfig = this.commandsConfig.commands[match]
      output = createCommandHandler(commandConfig)
    } else if (type === 'export') {
      output = this.staticExports[match]
    } else {
      throw new Error(`Missing the export "${name}", try the help command`)
    }
    if (this.exports.hasOwnProperty(match)) return this.exports[match]
    Object.defineProperty(this.exports, match, {
      value: output,
      enumerable: true,
      configurable: false,
      writable: false
      /* ...other flags, probable "value:..." */
    })

    return output
  }
}

export default CommandFunctions

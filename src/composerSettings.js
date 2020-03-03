const vscode = require('vscode');
const fs = require('fs');
const strings = require('./composerStrings');
const { ComposerOutput } = require('./composerOutput');

class ComposerSettings extends vscode.Disposable {

  static DEFAULT_EXECUTABLE = 'composer'
  static SECTION = 'composerCompanion'
  static SECTION_ENABLED = 'enabled'
  static SECTION_EXECUTABLE_PATH = 'executablePath'
  static SECTION_EXPLORER_SCRIPTS = 'showScriptsInExplorer'
  static SECTION_ACTIVE = 'active'

  /** @type {ComposerSettings} */
  static instance
  /** @type {vscode.Disposable} */
  changeEventDisp
  /** @type Map<string, function> */
  listeners = new Map()
  /** @type {ComposerOutput} */
  output

  /** @returns {ComposerSettings} */
  static getInstance() {
    if (!ComposerSettings.instance) {
      ComposerSettings.instance = new ComposerSettings()
    }
    return ComposerSettings.instance
  }

  constructor() {
    super(() => {
      this.listeners.clear()

      this.changeEventDisp.dispose()
    })

    this.output = ComposerOutput.getInstance()
    this.changeEventDisp = vscode.workspace.onDidChangeConfiguration(this.onChange, this)
  }

  /**
   * @param {vscode.ConfigurationChangeEvent} event
   */
  onChange(event) {
    /**
     * @param {vscode.Uri} resource
     * @param {string} name
     */
    const affects = (name = undefined, resource = undefined) => {
      const affected = event.affectsConfiguration(`${ComposerSettings.SECTION}${name ? `.${name}` : ''}`, resource)
      if (affected) {
        this.output.debugAppendLine(`${strings.SETTINGS} (${name}): ${strings.CHANGE_AFFECTED} "${resource ? resource : 'workspace'}"`)
      }
      return affected
    }

    for (const listener of this.listeners.values()) {
      listener(affects)
    }
  }

  /**
   * @param {string} id
   * @param {function} listener
   */
  addOnChangeListener(id, listener) {
    this.listeners.set(id, listener)
  }

  /**
   * @param {string} id
   */
  removeOnChangeListener(id) {
    this.listeners.delete(id)
  }

  /**
   * @param {string} filePath
   * @returns {string}
   */
  quoteFilePath(filePath) {
    if (filePath.indexOf(' ') > -1) {
      return `"${filePath}"`
    }
    return filePath
  }

  /**
   * @param {string} name
   * @param {any} defaultValue
   * @param {vscode.Uri | undefined} resource
   * @returns {any}
   */
  get(name, defaultValue, resource = undefined) {
    let value = vscode.workspace.getConfiguration(ComposerSettings.SECTION, resource).get(name)
    if (value === undefined) {
      value = defaultValue
    }
    return value
  }

  /**
   * @param {vscode.Uri | undefined} resource
   * @returns {boolean}
   */
  getEnabled(resource = undefined) {
    return this.get(ComposerSettings.SECTION_ENABLED, true, resource)
  }

  /**
   * @param {vscode.Uri | undefined} resource
   * @param {boolean} quoting
   * @returns {string}
   */
  getExecutablePath(resource = undefined, quoting = false) {
    let exe = this.get(ComposerSettings.SECTION_EXECUTABLE_PATH, null, resource)
    if (typeof exe !== 'string') {
      exe = ComposerSettings.DEFAULT_EXECUTABLE
    }

    if (process.platform === 'win32' && exe.endsWith('.phar')) {

      const batExe = exe.replace(/\.phar$/, '.bat')
      if (batExe.indexOf('\\') > -1 && fs.existsSync(batExe)) {
        exe = batExe
      } else {
        let phpExe = vscode.workspace.getConfiguration('php', resource).get('validate.executablePath')
        phpExe = this.quoteFilePath(phpExe ? phpExe : 'php.exe')
        exe = this.quoteFilePath(exe)
        return `${phpExe} ${exe}`
      }

    }

    if (quoting) {
      exe = this.quoteFilePath(exe)
    }
    return exe
  }

  /**
   * @param {vscode.Uri | undefined} resource
   * @returns {boolean}
   */
  getShowScriptsInExplorer(resource = undefined) {
    return this.get(ComposerSettings.SECTION_EXPLORER_SCRIPTS, true, resource)
  }
}

module.exports = {
  ComposerSettings
}

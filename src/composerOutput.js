const vscode = require('vscode');
const strings = require('./composerStrings')

class ComposerOutput extends vscode.Disposable {

  /** @type {ComposerOutput} */
  static instance
  /** @type {vscode.OutputChannel} */
  channel
  /** @type {boolean} */
  debugEnabled = process.env.COMPOSER_EXT_DEBUG === 'true'

  /**
   * @returns {ComposerOutput}
   */
  static getInstance() {
    if (!ComposerOutput.instance) {
      ComposerOutput.instance = new ComposerOutput()
    }
    return ComposerOutput.instance
  }

  constructor() {
    super(() => {
      this.channel.dispose()
    })

    this.channel = vscode.window.createOutputChannel(strings.CHANNEL_NAME)
  }

  /**
   * @param {string} value
   */
  append(value) {
    this.channel.append(value)
  }

  /**
   * @param {string} value
   */
  appendLine(value) {
    this.channel.appendLine(value)
  }

  /**
   * @param {string} value
   */
  debugAppend(value) {
    if (this.debugEnabled) {
      this.append(value)
    }
  }

  /**
   * @param {string} value
   */
  debugAppendLine(value) {
    if (this.debugEnabled) {
      this.appendLine(value)
    }
  }

}

module.exports = {
  ComposerOutput
}

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const strings = require('./composerStrings');
const { ComposerSettings } = require('./composerSettings')
const { ComposerOutput } = require('./composerOutput');

class ComposerWorkspaceFolderData extends vscode.Disposable {

  static COMPOSER_FILE = 'composer.json'

  /** @type {ComposerOutput} */
	output
  /** @type {ComposerSettings} */
  settings
  /** @type {vscode.WorkspaceFolder} */
  wsFolder
  /** @type {vscode.FileSystemWatcher} */
  composerFileWatcher
  /** @type {string} */
  composerFilePath
  /** @type {vscode.Uri} */
  composerFileUri
  /** @type {boolean} */
  composerFileExists = false
  /** @type {Set<string>} */
  scriptSet = new Set()
  /** @type {Set<vscode.QuickPickItem>} */
  requireSet = new Set()
  /** @type {boolean} */
  enabled = false
  /** @type {boolean} */
  _stale = false
  /** @type {(sender: ComposerWorkspaceFolderData) => any} */
  onLoaded

  /**
   * @param {vscode.Uri} wsFolder
   * @param {(sender: ComposerWorkspaceFolderData) => any} onLoaded
   */
  constructor(wsFolder, onLoaded) {
    super(() => {
      if (this.composerFileWatcher) {
        this.onLoaded = undefined
        this.composerFileWatcher.dispose()
      }
    })

    this.output = ComposerOutput.getInstance()
    this.wsFolder = wsFolder

    this.composerFileUri = this.wsFolder.uri.with({
      path: path.join(this.wsFolder.uri.fsPath, ComposerWorkspaceFolderData.COMPOSER_FILE)
    })
    this.composerFilePath = this.composerFileUri.fsPath
    this.composerFileWatcher = vscode.workspace.createFileSystemWatcher(this.composerFilePath)

    this.composerFileWatcher.onDidCreate((e) => {
      this.stale = true
      this.output.debugAppendLine(`${strings.WS_FOLDERS}: [${strings.CREATED}] "${e.fsPath}"`)
    }, this)

    this.composerFileWatcher.onDidChange((e) => {
      this.stale = true
      this.output.debugAppendLine(`${strings.WS_FOLDERS}: [${strings.MODIFIED}] "${e.fsPath}"`)
    }, this)

    this.composerFileWatcher.onDidDelete((e) => {
      this.stale = true
      this.output.debugAppendLine(`${strings.WS_FOLDERS}: [${strings.DELETED}] "${e.fsPath}"`)
    }, this)

    this.settings = ComposerSettings.getInstance()

    this.settings.addOnChangeListener(`wsScripts:${wsFolder.uri.fsPath}`, (affects) => {
      if (affects(ComposerSettings.SECTION_ENABLED, this.wsFolder.uri)) {
        this.stale = true
      }
    })

    this.onLoaded = onLoaded
    this.stale = true
  }

  /** @returns {vscode.Uri} */
  get folderUri() {
    return this.wsFolder.uri
  }

  /**
   * @returns {boolean}
   */
  get stale() {
    return this._stale
  }

  /**
   * @param {boolean} value
   */
  set stale(value) {
    this._stale = value
    if (this._stale) {
      this.loadScripts()
    }
  }

  /** @returns {string[]} */
  get scripts() {
    return Array.from(this.scriptSet.values())
  }

  /** @returns {vscode.QuickPickItem[]} */
  get requires() {
    return Array.from(this.requireSet.values())
  }

  /**
   * @returns {Promise<void>}
   */
  async loadScripts() {
    if (!this.stale) {
      return
    }

    this.scriptSet.clear()
    this.requireSet.clear()

    this.enabled = this.settings.getEnabled(this.folderUri)
    if (!this.enabled) {
      this.output.appendLine(`${strings.WS_FOLDERS}: [${strings.FOLDER_DISABLED}] "${this.composerFilePath}"`)
      return
    }

    if (!fs.existsSync(this.composerFilePath)) {
      this.output.appendLine(`${strings.WS_FOLDERS}: [${strings.FOLDER_NO_COMPOSER}] "${this.composerFilePath}"`)
      return
    }
    this.composerFileExists = true

    try {
      const fileContents = await vscode.workspace.fs.readFile(this.composerFileUri)
      const jsonStr = (new TextDecoder('UTF-8')).decode(fileContents)
      const jsonObj = JSON.parse(jsonStr)

      if (typeof jsonObj.scripts === 'object') {
        for (const script in jsonObj.scripts) {
          if (jsonObj.scripts.hasOwnProperty(script)) {
            this.scriptSet.add(script)
          }
        }
      }

      if (typeof jsonObj.require === 'object') {
        for (const req in jsonObj.require) {
          if (jsonObj.require.hasOwnProperty(req)) {
            this.requireSet.add({
              label: req,
              description: jsonObj.require[req],
              detail: 'require',
              dev: false
            })
          }
        }
      }

      if (typeof jsonObj['require-dev'] === 'object') {
        for (const req in jsonObj['require-dev']) {
          if (jsonObj['require-dev'].hasOwnProperty(req)) {
            this.requireSet.add({
              label: req,
              description: jsonObj['require-dev'][req],
              detail: 'require-dev',
              dev: true
            })
          }
        }
      }

      this.output.appendLine(
        `${strings.WS_FOLDERS}: [`+
        `${this.scriptSet.size} ${strings.FOLDER_SCRIPTS}, ` +
        `${this.requireSet.size} ${strings.FOLDER_REQUIRES}` +
        `] "${this.composerFilePath}"`
      )
    } catch (error) {
      this.output.appendLine(`${strings.WS_FOLDERS}: [${strings.FAIL}] "${this.composerFilePath}"`)
    }

    if (this.onLoaded) {
      this.onLoaded(this)
    }
  }

}

class ComposerWorkspaceFolders extends vscode.Disposable {

  /** @type {ComposerWorkspaceFolders} */
  static instance
  /** @type {ComposerOutput} */
	output
  /** @type {Map<vscode.WorkspaceFolder, ComposerWorkspaceFolderData>} */
  wsFolderMap = new Map()
  /** @type Set<function> */
  listeners = new Set()

  /** @returns {ComposerWorkspaceFolders} */
  static getInstance() {
    if (!ComposerWorkspaceFolders.instance) {
      ComposerWorkspaceFolders.instance = new ComposerWorkspaceFolders()
    }
    return ComposerWorkspaceFolders.instance
  }

  constructor() {
    super(() => {
      this.folderLoadedEventEmitter.dispose()
      this.folderLoadedEventEmitter = undefined

      for (const elm of this.wsFolderMap) {
        this.removeFolder(elm[0])
      }
    })

    this.output = ComposerOutput.getInstance()
    this.folderLoadedEventEmitter = new vscode.EventEmitter()

    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const wsFolder of event.removed) {
        this.removeFolder(wsFolder)
      }
      for (const wsFolder of event.added) {
        this.addFolder(wsFolder)
      }
    })

    this.loadFolders()
  }

  /** @returns {ComposerWorkspaceFolderData[]} */
  get folders() {
    return Array.from(this.wsFolderMap.values())
  }

  /** @returns {boolean} */
  get stale() {
    for (const folder of this.wsFolderMap.values()) {
      if (folder.stale) {
        return true
      }
    }
    return false
  }

  /**
   * @param {boolean} value
   */
  set stale(value) {
    for (const folder of this.wsFolderMap.values()) {
      folder.stale = value
    }
  }

  loadFolders() {
    const wsFolders = vscode.workspace.workspaceFolders
    if (wsFolders) {
      for (const wsFolder of wsFolders) {
        this.addFolder(wsFolder)
      }
    }
  }

  /**
   * @param {ComposerWorkspaceFolderData} sender
   */
  onFolderLoaded(sender) {
    for (const listener of this.listeners) {
      listener(sender)
    }
  }

  /**
   * @param {(sender: ComposerWorkspaceFolderData) => any} listener
   */
  addOnFolderLoadedListener(listener) {
    this.listeners.add(listener)
  }

  /**
   * @param {vscode.WorkspaceFolder} wsFolder
   */
  addFolder(wsFolder) {
    if (!this.wsFolderMap.has(wsFolder)) {
      const folder = new ComposerWorkspaceFolderData(wsFolder, (sender) => this.onFolderLoaded(sender))
      this.wsFolderMap.set(wsFolder, folder)

      this.output.appendLine(`${strings.WS_FOLDERS}: [${strings.FOLDER_ADDED}] "${wsFolder.uri.fsPath}"`)
    }
  }

  /**
   * @param {vscode.WorkspaceFolder} wsFolder
   */
  removeFolder(wsFolder) {
    if (this.wsFolderMap.has(wsFolder)) {
      this.wsFolderMap.get(wsFolder).dispose()
      this.wsFolderMap.delete(wsFolder)

      this.onFolderLoaded(null)

      this.output.appendLine(`${strings.WS_FOLDERS}: [${strings.FOLDER_REMOVED}] "${wsFolder.uri.fsPath}"`)
    }
  }

}

module.exports = {
  ComposerWorkspaceFolders,
  ComposerWorkspaceFolderData
}

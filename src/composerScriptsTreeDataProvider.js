const vscode = require('vscode')
const path = require('path')
const strings = require('./composerStrings');
const { ComposerSettings } = require('./composerSettings');
const { ComposerOutput } = require('./composerOutput');
const { ComposerWorkspaceFolders, ComposerWorkspaceFolderScripts } = require('./composerWorkspaceFolders');

class ComposerScriptsTreeItem extends vscode.TreeItem {

  /** @type {number} */
  static nextId = 0
  /** @type {string | boolean} */
  description = false
  /** @type {ComposerScriptsTreeItem | null} */
  parent = null

  /**
   * @param {string | false} label
   * @param {vscode.TreeItemCollapsibleState} collapsibleState
   */
  constructor(label, collapsibleState) {
    super(label, collapsibleState)

    this.contextValue = this.constructor.name
    this.id = `${this.contextValue}_${ComposerScriptsTreeItem.nextId++}`
  }

}

/**
 * @implements {vscode.Command}
 */
class ComposerScriptsTreeScriptCommand {

  /** @type {string} */
  title = strings.OPEN_COMPOSER_FILE
  /** @type {string} */
  tooltip = strings.OPEN_COMPOSER_FILE
  /** @type {string} */
  command = 'composerCompanion.open'
  /** @type {ComposerWorkspaceFolderScripts} */
  ownerFolder

  /**
   * @param {ComposerWorkspaceFolderScripts} ownerFolder
   */
  constructor(ownerFolder) {
    this.ownerFolder = ownerFolder
  }

  /** @returns {any[]} */
  get arguments() {
    return [this.ownerFolder.composerFileUri]
  }
}

class ComposerScriptsTreeScript extends ComposerScriptsTreeItem {

  /** @type {string} */
  script
  /** @type {ComposerScriptsTreeScriptCommand} command */
  command
  /** @type {string} */
  tooltip = strings.OPEN_COMPOSER_FILE
  /** @type { {light: string | vscode.Uri, dark: string | vscode.Uri} } */
  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'script.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'script.svg')
  }

  /**
   * @param {string} script
   * @param {ComposerScriptsTreeScriptCommand} command
   */
  constructor(script, command) {
    super(script, vscode.TreeItemCollapsibleState.None)

    this.script = script
    this.command = command
  }

}

class ComposerScriptsTreeFolder extends ComposerScriptsTreeItem {

  /** @type {ComposerWorkspaceFolderScripts} */
  folder
  /** @type {vscode.ThemeIcon} */
  iconPath = vscode.ThemeIcon.Folder

  /**
   * @param {ComposerWorkspaceFolderScripts} folder
   */
  constructor(folder) {
    super(false, vscode.TreeItemCollapsibleState.Expanded)

    this.folder = folder
  }

  /** @returns {vscode.Uri} */
  get resourceUri() {
    return this.folder.folderUri
  }

}

/**
 * @implements {vscode.TreeDataProvider<ComposerScriptsTreeItem>}
 */
class ComposerScriptsTreeDataProvider extends vscode.Disposable {

  static VIEW_ID = 'composerScriptsView'
  /** @type {ComposerScriptsTreeDataProvider} */
  static instance

  /** @type {ComposerOutput} */
  output
  /** @type {ComposerSettings} */
  settings
  /** @type {ComposerWorkspaceFolders} */
  workspaceFolders
  /** @type {Map<ComposerWorkspaceFolderScripts, ComposerScriptsTreeFolder>} */
  rootChildren = new Map()
  /** @type {vscode.Disposable} */
  registerDisp
  /** @type {vscode.Event<any>} */
  updateEmitter

  /** @returns {ComposerScriptsTreeDataProvider} */
  static getInstance() {
    if (!ComposerScriptsTreeDataProvider.instance) {
      ComposerScriptsTreeDataProvider.instance = new ComposerScriptsTreeDataProvider()
    }
    return ComposerScriptsTreeDataProvider.instance
  }

  constructor() {
    super(() => {
      this.registerDisp.dispose()

      this.output.appendLine(`${strings.TREE_PROVIDER}: ${strings.DISPOSED}`)
    })

    this.output = ComposerOutput.getInstance()
    this.settings = ComposerSettings.getInstance()
    this.workspaceFolders = ComposerWorkspaceFolders.getInstance()

    this.updateContext()
    this.registerDisp = vscode.window.createTreeView(ComposerScriptsTreeDataProvider.VIEW_ID, {
      treeDataProvider: this,
      showCollapseAll: true,
      canSelectMany: false
    })

    this.settings.addOnChangeListener('treeDataProvider', (affects) => {
      if (affects(ComposerSettings.SECTION_EXPLORER_SCRIPTS)) {
        this.updateContext()
      }
      if (affects(ComposerSettings.SECTION_ENABLED)) {
        this.updateTreeView(null)
      }
    })

    this.workspaceFolders.addOnFolderLoadedListener((sender) => {
      if (this.rootChildren.has(sender)) {
        this.updateTreeView(this.rootChildren.get(sender))
      } else {
        this.updateTreeView(null)
      }
    })

    this.output.appendLine(`${strings.TREE_PROVIDER}: ${strings.REGISTERED}`)
  }

  /**
   *
   * @param {vscode.Event<any> | function} event
   */
  onDidChangeTreeData(event) {
    this.updateEmitter = event
  }

  /**
   * @param {ComposerScriptsTreeItem | null} item
   */
  updateTreeView(item) {
    if (this.updateEmitter) {
      this.updateEmitter(item)

      this.output.debugAppendLine(
        `${strings.TREE_PROVIDER}: [${strings.UPDATE}] ` +
        `"${item ? item.label ? item.label : item.folder ? path.basename(item.folder.folderUri.fsPath) : 'root' : 'all'}"`
      )
    }
  }

  updateContext() {
    const value = this.settings.getShowScriptsInExplorer()
    const key = `${ComposerSettings.SECTION}.${ComposerSettings.SECTION_EXPLORER_SCRIPTS}`
    vscode.commands.executeCommand('setContext', key, value);

    this.output.appendLine(`${strings.TREE_PROVIDER}: [${strings.ENABLED}] "${value ? strings.YES : strings.NO}"`)
  }

  /**
   * @param {ComposerScriptsTreeItem} element
   * @returns {ComposerScriptsTreeItem}
   */
  getTreeItem(element) {
    return element
  }

  /**
   * @param {ComposerScriptsTreeItem | undefined} element
   * @returns {Promise<ComposerScriptsTreeItem[]>}
   */
  async getChildren(element) {
    if (!this.settings.getShowScriptsInExplorer()) {
      return []
    }

    if (element && (element instanceof ComposerScriptsTreeFolder)) {

      let items = []
      for (const script of element.folder.scripts) {
        const command = new ComposerScriptsTreeScriptCommand(element.folder)
        const item = new ComposerScriptsTreeScript(script, command)
        item.parent = element
        items.push(item)
      }
      return items

    } else { //root

      for (const folder of this.workspaceFolders.folders) {
        if (!folder.composerFileExists) { continue }

        if (!this.rootChildren.has(folder)) {
          const item = new ComposerScriptsTreeFolder(folder)
          this.rootChildren.set(folder, item)
        }
      }

      if (this.rootChildren.size > 0) {
        const wsFolders = new Set(this.workspaceFolders.folders)
        let delFolders = []

        for (const elm of this.rootChildren) {
          const folder = elm[0]
          if (!wsFolders.has(folder)) {
            delFolders.push(folder)
          }
        }

        for (const del of delFolders) {
          this.rootChildren.delete(del)
        }
      }

      return Array.from(this.rootChildren.values())

    }
  }

  /**
   * @param {ComposerScriptsTreeItem} element
   * @returns {Promise<ComposerScriptsTreeItem | null>}
   */
  async getParent(element) {
    return element.parent
  }

}

module.exports = {
  ComposerScriptsTreeDataProvider,
  ComposerScriptsTreeScriptCommand,
  ComposerScriptsTreeItem,
  ComposerScriptsTreeScript,
  ComposerScriptsTreeFolder
}

const vscode = require('vscode');
const path = require('path');
const cp = require('child_process');
const strings = require('./composerStrings');
const { ComposerOutput } = require('./composerOutput');
const { ComposerSettings } = require('./composerSettings');
const { ComposerTaskProvider, ComposerTaskDefinition, ComposerBaseTask } = require('./composerTaskProvider');
const { ComposerScriptsTreeScript } = require('./composerScriptsTreeDataProvider');
const { ComposerWorkspaceFolders, ComposerWorkspaceFolderData } = require('./composerWorkspaceFolders');

class ComposerCommandTask extends ComposerBaseTask {

  /**
   * @param {string} command
   * @param {vscode.WorkspaceFolder | vscode.TaskScope} scope
   * @param {string[]} args
   * @param {boolean} focus
   */
  constructor(command, scope, args, focus = false) {
    let shellExec

    if (typeof scope === 'object') {
      shellExec = new vscode.ShellExecution(
        {
          value: ComposerSettings.getInstance().getExecutablePath(scope.uri),
          quoting: vscode.ShellQuoting.Weak
        },
        [
          command,
          ...args,
          '-d',
          {value: scope.uri.fsPath, quoting: vscode.ShellQuoting.Strong}
        ],
        ComposerBaseTask.getShellOptions(scope.uri.fsPath)
      )
    } else {
      shellExec = new vscode.ShellExecution(
        {
          value: ComposerSettings.getInstance().getExecutablePath(),
          quoting: vscode.ShellQuoting.Weak
        },
        [
          command,
          ...args
        ],
        ComposerBaseTask.getShellOptions()
      )
    }

    super({type: ComposerTaskDefinition.TASK_TYPE}, scope, command, ComposerTaskDefinition.TASK_SOURCE, shellExec)

    this.presentationOptions = {
      focus
    }
  }

  execute() {
    const scopeName = (typeof this.scope === 'object') ? this.scope.name : 'workspace'
    ComposerOutput.getInstance().appendLine(`${strings.COMMANDS}: [${this.name}] "${scopeName}"`)
    return vscode.tasks.executeTask(this)
  }

  /**
   * @param {string} title
   * @param {(e: vscode.TaskEndEvent) => any | undefined} onEnd
   * @returns {vscode.Thenable<TaskExecution>}
   */
  executeWithProgress(title, onEnd = undefined) {
    let resolveTask
    const taskDisp = vscode.tasks.onDidEndTask((event) => {
      if (
        event.execution.task.name === this.name &&
        event.execution.task.definition.type === this.definition.type
      ) {
        taskDisp.dispose()
        resolveTask()
        if (typeof onEnd === 'function') {
          onEnd(event)
        }
      }
    })

    return vscode.window.withProgress(
      {location: vscode.ProgressLocation.Window, title},
      () => {
        return new Promise((resolve) => {
          const tExec = this.execute()
          resolveTask = () => resolve(tExec)
        })
      }
    )
  }

  /**
   * @param {string} command
   * @param {vscode.WorkspaceFolder | vscode.TaskScope} scope
   * @param {string[]} args
   * @param {boolean} focus
   */
  static execute(command, scope, args = [], focus = false) {
    return (new ComposerCommandTask(command, scope, args, focus)).execute()
  }

}

class ComposerCommands extends vscode.Disposable {

  /** @type {ComposerCommands} */
  static instance
  /** @type {ComposerOutput} */
  output
  /** @type {Set<vscode.Disposable>} */
  commandDisposables = new Set()

  /**
   * @returns {ComposerCommands}
   */
  static getInstance() {
    if (!ComposerCommands.instance) {
      ComposerCommands.instance = new ComposerCommands()
    }
    return ComposerCommands.instance
  }

  constructor() {
    super(() => {
      this.unregister()

      this.output.appendLine(`${strings.COMMANDS}: ${strings.DISPOSED}`)
    })

    this.output = ComposerOutput.getInstance()
    this.register()

    this.output.appendLine(`${strings.COMMANDS}: ${strings.REGISTERED}`)
  }

  register() {
    const add = (command) => this.commandDisposables.add(command)

    add(vscode.commands.registerCommand('composerCompanion.run', this.commandRun, this))
    add(vscode.commands.registerCommand('composerCompanion.open', this.commandOpen, this))
    add(vscode.commands.registerCommand('composerCompanion.install', this.commandInstall, this))
    add(vscode.commands.registerCommand('composerCompanion.update', this.commandUpdate, this))
    add(vscode.commands.registerCommand('composerCompanion.remove', this.commandRemove, this))
    add(vscode.commands.registerCommand('composerCompanion.require', this.commandRequire, this))
    add(vscode.commands.registerCommand('composerCompanion.init', this.commandInit, this))
    add(vscode.commands.registerCommand('composerCompanion.search', this.commandSearch, this))
    add(vscode.commands.registerCommand('composerCompanion.outdated', this.commandOutdated, this))
    add(vscode.commands.registerCommand('composerCompanion.show', this.commandShow, this))
    add(vscode.commands.registerCommand('composerCompanion.status', this.commandStatus, this))
    add(vscode.commands.registerCommand('composerCompanion.validate', this.commandValidate, this))
    add(vscode.commands.registerCommand('composerCompanion.selfupdate', this.commandSelfUpdate, this))
    add(vscode.commands.registerCommand('composerCompanion.clearcache', this.commandClearCache, this))
    add(vscode.commands.registerCommand('composerCompanion.dumpautoload', this.commandDumpAutoload, this))
    add(vscode.commands.registerCommand('composerCompanion.diagnose', this.commandDiagnose, this))
    add(vscode.commands.registerCommand('composerCompanion.exec', this.commandExec, this))
    add(vscode.commands.registerCommand('composerCompanion.checkplatformreqs', this.commandCheckPlatformReqs, this))
    add(vscode.commands.registerCommand('composerCompanion.browse', this.commandBrowse, this))
    add(vscode.commands.registerCommand('composerCompanion.depends', this.commandDepends, this))
    add(vscode.commands.registerCommand('composerCompanion.createproject', this.commandCreateProject, this))
  }

  unregister() {
    for (const cmd of this.commandDisposables) {
      cmd.dispose()
    }
    this.commandDisposables.clear()
  }

  /**
   * @param {boolean} checkComposerFile
   * @param {boolean} checkEnabled
   * @param {boolean} showNew
   * @returns Promise<ComposerWorkspaceFolderData | null | true>
   */
  async pickWorkspaceFolder(checkComposerFile = true, checkEnabled = true, showNew = false) {
    const workspaceFolders = ComposerWorkspaceFolders.getInstance()
    let items = []

    if (showNew) {
      items.push({
        label: strings.NEW_FOLDER,
        folder: true,
        enabled: true,
        composerFileExists: false
      })
    }

    for (const folder of workspaceFolders.folders) {
      items.push({
        label: path.basename(folder.folderUri.fsPath),
        description: folder.folderUri.fsPath,
        folder
      })
    }

    let result = null

    if (!items.length) {
      vscode.window.showInformationMessage(`${strings.EXT_NAME}: ${strings.NO_WORKSPACE_MSG}`)
      this.output.appendLine(`${strings.COMMANDS}: ${strings.NO_WORKSPACE_MSG}`)
    } else if (items.length === 1) {
      result = items[0].folder
    } else {
      const selected = await vscode.window.showQuickPick(items, {
        ignoreFocusOut: false,
        canPickMany: false,
        matchOnDescription: true,
        placeHolder: strings.SELECT_WS_FOLDER
      })
      if (selected) {
        result = selected.folder
      }
    }

    if (result && checkEnabled && !result.enabled) {
      vscode.window.showInformationMessage(`${strings.EXT_NAME}: ${strings.FOLDER_DISABLED_MSG} "${result.wsFolder.name}"`)
      this.output.appendLine(`${strings.COMMANDS}: ${strings.FOLDER_DISABLED_MSG} "${result.wsFolder.name}"`)

      result = null
    } else if (result && checkComposerFile && !result.composerFileExists) {
      vscode.window.showInformationMessage(`${strings.EXT_NAME}: ${strings.NO_COMPOSER_IN_FOLDER_MSG} "${result.wsFolder.name}"`)
      this.output.appendLine(`${strings.COMMANDS}: ${strings.NO_COMPOSER_IN_FOLDER_MSG} "${result.wsFolder.name}"`)

      result = null
    }

    return result
  }

  /**
   * @param {vscode.Uri} folderUri
   * @param {boolean} forceReload
   */
  addWorkspaceFolder(folderUri, forceReload = false) {
    if (vscode.workspace.workspaceFolders && !forceReload) {
      vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
        0,
        {uri: folderUri}
      )
      vscode.commands.executeCommand('workbench.files.action.focusFilesExplorer')
    } else {
      vscode.commands.executeCommand('vscode.openFolder', folderUri)
    }
  }

  /**
   * @param {string[]} filters
   * @param {string[]} preSelected
   * @returns Promise<string[]>
   */
  async pickAdditionalArgs(filters, preSelected = []) {
    const flags = strings.flags.filter(...filters)
    if (!flags.length) {
      return []
    }

    for (const flag of flags) {
      flag.picked = preSelected.some((value) => flag.label === value)
    }

    const selected = await vscode.window.showQuickPick(flags, {
      ignoreFocusOut: true,
      canPickMany: true,
      matchOnDescription: false,
      matchOnDetail: true,
      placeHolder: strings.SELECT_ADDITIONAL_FLAGS
    })
    if (!selected || !selected.length) {
      return []
    }

    return selected.map((item) => item.label)
  }

  /**
   * @param {ComposerWorkspaceFolderData} folder
   * @param {string} prompt
   * @param {{dev: number, nodev: number}} info
   * @returns {Promise<false | string[]>}
   */
  async pickPackages(folder, prompt, info = undefined) {
    const selected = await vscode.window.showQuickPick(folder.requires, {
      ignoreFocusOut: true,
      canPickMany: true,
      matchOnDescription: false,
      matchOnDetail: true,
      placeHolder: prompt
    })

    if (!Array.isArray(selected)) {
      return false
    }

    if ((typeof info !== 'object') || info === null) {
      info = {}
    }
    info.nodev = 0
    info.dev = 0

    return selected.map((item) => {
      info.dev += item.dev ? 1 : 0
      info.nodev += item.dev ? 0 : 1
      return item.label
    })
  }

  /**
   *
   * @param {ComposerWorkspaceFolderData} folder
   * @param {string} prompt
   * @returns {Promise<false | string>}
   */
  async pickSinglePackage(folder, prompt) {
    const selected = await vscode.window.showQuickPick(folder.requires, {
      ignoreFocusOut: true,
      canPickMany: false,
      matchOnDescription: false,
      matchOnDetail: true,
      placeHolder: prompt
    })

    if (!selected) {
      return false
    }

    return selected.label
  }

  /**
   * @param {string} prompt
   * @returns {string[] | false}
   */
  async inputPackages(prompt) {
    const reg = /[^-\s]+\/\S+/g

    const input = await vscode.window.showInputBox({
      prompt,
      ignoreFocusOut: true,
      placeHolder: strings.PACKAGE_PLACEHOLDER,
      validateInput: (value) => {
        value = value.trim()
        if (value.length === 0) {
          return null
        }
        const matches = value.match(reg)
        if (!matches || matches.length !== value.split(' ').length) {
          return strings.INVALID_PACKAGE_NAMES
        }
      }
    })

    if (typeof input !== 'string') {
      return false
    }

    let packages = input.trim().match(reg)
    if (!packages) {
      packages = []
    }
    return packages
  }

  /**
   * @param {string} prompt
   * @param {string} placeHolder
   * @returns {string | false}
   */
  async inputNotEmpty(prompt, placeHolder = '') {
    const input = await vscode.window.showInputBox({
      prompt,
      placeHolder,
      ignoreFocusOut: true,
      validateInput: (value) => {
        return value.trim().length ? null : strings.INVALID_EMPTY
      }
    })

    if (typeof input !== 'string') {
      return false
    }

    return input.trim()
  }

  /**
   * @param {string | ComposerScriptsTreeScript | undefined} script
   * @param {vscodeUri | undefined} folderUri
   */
  async commandRun(script, folderUri) {
    const taskProvider = ComposerTaskProvider.getInstance()
    let taskFound

    if (typeof script === 'string') {
      taskFound = await taskProvider.findTask(script, folderUri)
    } else if (script instanceof ComposerScriptsTreeScript) {
      folderUri = script.command.ownerFolder.folderUri
      script = script.script
      taskFound = await taskProvider.findTask(script, folderUri)
    } else {
      const tasks = await taskProvider.provideTasks()
      let items = []
      for (const task of tasks) {
        items.push({
          label: task.script,
          description: path.basename(task.folderUri.fsPath),
          task
        })
      }
      if (!items.length) {
        vscode.window.showInformationMessage(`${strings.EXT_NAME}: ${strings.NO_WORKSPACE_MSG}`)
        this.output.appendLine(`${strings.COMMANDS}: ${strings.NO_WORKSPACE_MSG}`)
        return
      }
      const selected = await vscode.window.showQuickPick(items, {
        ignoreFocusOut: false,
        canPickMany: false,
        matchOnDescription: true,
        placeHolder: strings.SELECT_SCRIPT
      })
      if (selected) {
        taskFound = selected.task

      }
    }

    if (taskFound) {
      this.output.appendLine(`${strings.COMMANDS}: [run] "${taskFound.script}" (${path.basename(taskFound.folderUri.fsPath)})`)
      return vscode.tasks.executeTask(taskFound)
    }
  }

  /**
   * @param {vscode.Uri | undefined} fileUri
   */
  async commandOpen(fileUri) {
    if (!fileUri) {
      const pickedFolder = await this.pickWorkspaceFolder()
      if (pickedFolder) {
        fileUri = pickedFolder.composerFileUri
      }
    }

    if (fileUri) {
      this.output.appendLine(`${strings.COMMANDS}: [open] "${fileUri.fsPath}"`)
      return vscode.window.showTextDocument(fileUri)
    }
  }

  async commandInstall() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const args = await this.pickAdditionalArgs(['install'])
    return ComposerCommandTask.execute('install', pickedFolder.wsFolder, args)
  }

  async commandInit() {
    let pickedFolder = await this.pickWorkspaceFolder(false, false, true)
    if (!pickedFolder) { return }

    if (pickedFolder === true) {
      pickedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false
      })
      if (!pickedFolder || !pickedFolder.length) { return }
      pickedFolder = pickedFolder[0]

      const task = new ComposerCommandTask('init', vscode.TaskScope.Workspace, ['-d', pickedFolder.fsPath], true)
      return task.executeWithProgress(strings.INITING_PROJECT, () => this.addWorkspaceFolder(pickedFolder))
    }

    if (pickedFolder.composerFileExists) {
      const selected = await vscode.window.showQuickPick([
        {result: false, label: strings.NO, picked: true},
        {result: true, label: strings.YES}
      ], {
        canPickMany: false,
        placeHolder: strings.COMPOSER_OVERWRITE
      })
      if (!selected || !selected.result) {
        return
      }
    }

    const task = new ComposerCommandTask('init', pickedFolder.wsFolder, [], true)
    return task.executeWithProgress(strings.INITING_PROJECT)
  }

  async commandUpdate() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const info = {}
    const packages = await this.pickPackages(pickedFolder, strings.UPDATE_PROMPT, info)
    if (!packages) { return }

    const args = await this.pickAdditionalArgs(['update'], info.dev ? ['--dev'] : ['--no-dev'])
    return ComposerCommandTask.execute('update', pickedFolder.wsFolder, [...packages, ...args])
  }

  async commandCheckPlatformReqs() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const args = await this.pickAdditionalArgs(['check-platform-reqs'])
    return ComposerCommandTask.execute('check-platform-reqs', pickedFolder.wsFolder, args)
  }

  async commandDumpAutoload() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const args = await this.pickAdditionalArgs(['dump-autoload'])
    return ComposerCommandTask.execute('dump-autoload', pickedFolder.wsFolder, [...args])
  }

  async commandRemove() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const info = {}
    const packages = await this.pickPackages(pickedFolder, strings.REMOVE_PROMPT, info)
    if (!packages || !packages.length) { return }

    const args = await this.pickAdditionalArgs(['remove'], info.dev ? ['--dev'] : [])
    return ComposerCommandTask.execute('remove', pickedFolder.wsFolder, [...packages, ...args])
  }

  async commandBrowse() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const selected = await this.pickSinglePackage(pickedFolder, strings.BROWSE_PROMPT)
    if (!selected) { return }

    const args = await this.pickAdditionalArgs(['browse'])
    return ComposerCommandTask.execute('browse', pickedFolder.wsFolder, [selected, ...args])
  }

  async commandRequire() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const packages = await this.inputPackages(strings.REQUIRE_PROMPT)
    if (!packages) { return }

    const args = await this.pickAdditionalArgs(['require'])
    return ComposerCommandTask.execute('require', pickedFolder.wsFolder, [...packages, ...args], !packages.length)
  }

  async commandSearch() {
    let query = await this.inputNotEmpty(strings.SEARCH_PROMPT)
    if (!query) { return }

    query = {value: query, quoting: vscode.ShellQuoting.Strong}

    const args = await this.pickAdditionalArgs(['search'])
    return ComposerCommandTask.execute('search', vscode.TaskScope.Workspace, [query, ...args])
  }

  async commandSelfUpdate() {
    let version = await this.inputNotEmpty(strings.SELFUPDATE_PROMPT)
    let args = await this.pickAdditionalArgs(['self-update'])

    if (version) {
      args = [{value: version, quoting: vscode.ShellQuoting.Strong}, ...args]
    }

    return ComposerCommandTask.execute('self-update', vscode.TaskScope.Workspace, [...args])
  }

  async commandClearCache() {
    return ComposerCommandTask.execute('clear-cache', vscode.TaskScope.Workspace)
  }

  async commandDiagnose() {
    const pickedFolder = await this.pickWorkspaceFolder(false)
    if (!pickedFolder) { return }

    return ComposerCommandTask.execute('diagnose', pickedFolder.wsFolder)
  }

  async commandOutdated() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const args = await this.pickAdditionalArgs(['outdated'])
    return ComposerCommandTask.execute('outdated', pickedFolder.wsFolder, [...args])
  }

  async commandShow() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const selected = await this.pickSinglePackage(pickedFolder, strings.SHOW_PROMPT)
    let args = await this.pickAdditionalArgs(['show'])

    if (selected) {
      args = [selected, ...args]
    }

    return ComposerCommandTask.execute('show', pickedFolder.wsFolder, [...args])
  }

  async commandStatus() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const args = await this.pickAdditionalArgs(['status'])

    return ComposerCommandTask.execute('status', pickedFolder.wsFolder, [...args])
  }

  async commandValidate() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const args = await this.pickAdditionalArgs(['validate'])

    return ComposerCommandTask.execute('validate', pickedFolder.wsFolder, [...args])
  }

  async commandDepends() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const executablePath = ComposerSettings.getInstance().getExecutablePath(pickedFolder.folderUri, true)
    const cmd = `${executablePath} show -d "${pickedFolder.folderUri.fsPath}"`
    const out = await vscode.window.withProgress(
      {location: vscode.ProgressLocation.Window, title: strings.FETCHING_PACKAGES},
      () => {
        return new Promise((resolve) => {
          cp.exec(cmd, (error, stdout) => {
            resolve(error ? '': stdout)
          })
        })
      }
    )

    const items = Array.from(out.matchAll(/^(\S+)\s+(\S+(?:\s[A-z0-9]+|))(?: +(.*))$/gm)).map((val) => {
      return {label: val[1], description: val[2]}
    })
    if (!items || !items.length) {
      vscode.window.showInformationMessage(`${strings.EXT_NAME}: ${strings.NO_PACKAGES_MSG} "${pickedFolder.wsFolder.name}"`)
      this.output.appendLine(`${strings.COMMANDS}: ${strings.NO_PACKAGES_MSG} "${pickedFolder.wsFolder.name}"`)
      return
    }

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: false,
      ignoreFocusOut: true,
      placeHolder: strings.DEPENDS_PROMPT
    })
    if (!selected) { return }

    const args = await this.pickAdditionalArgs(['depends'])
    return ComposerCommandTask.execute('depends', pickedFolder.wsFolder, [selected.label, ...args])
  }

  async commandExec() {
    const pickedFolder = await this.pickWorkspaceFolder()
    if (!pickedFolder) { return }

    const executablePath = ComposerSettings.getInstance().getExecutablePath(pickedFolder.folderUri, true)
    const cmd = `${executablePath} exec --list -d "${pickedFolder.folderUri.fsPath}"`
    const out = await vscode.window.withProgress(
      {location: vscode.ProgressLocation.Window, title: strings.FETCHING_BINARIES},
      () => {
        return new Promise((resolve) => {
          cp.exec(cmd, (error, stdout) => {
            resolve(error ? '': stdout)
          })
        })
      }
    )

    const items = Array.from(out.matchAll(/^-\s(\S+)$/gm)).map((val) => val[1])
    if (!items || !items.length) {
      vscode.window.showInformationMessage(`${strings.EXT_NAME}: ${strings.NO_BINARIES_MSG} "${pickedFolder.wsFolder.name}"`)
      this.output.appendLine(`${strings.COMMANDS}: ${strings.NO_BINARIES_MSG} "${pickedFolder.wsFolder.name}"`)
      return
    }

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: false,
      ignoreFocusOut: true,
      placeHolder: strings.EXEC_BIN_PROMPT
    })
    if (!selected) { return }

    let args = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      prompt: strings.EXEC_ARGS_PROMPT
    })
    if (typeof args !== 'string') { return }
    args = args.match(/('.*?'|".*?"|\S+)/g)
    if (!Array.isArray(args)) {
      args = []
    }

    const task = new vscode.Task(
      {type: ComposerTaskDefinition.TASK_TYPE},
      pickedFolder.wsFolder,
      'exec',
      ComposerTaskDefinition.TASK_SOURCE,
      new vscode.ShellExecution(
        {
          value: path.join(pickedFolder.folderUri.fsPath, 'vendor', 'bin', selected),
          quoting: vscode.ShellQuoting.Strong
        },
        [
          ...args
        ],
        ComposerBaseTask.getShellOptions(pickedFolder.folderUri.fsPath)
      )
    )

    this.output.appendLine(`${strings.COMMANDS}: [exec] "${selected}" (${pickedFolder.wsFolder.name})`)
    return vscode.tasks.executeTask(task)
  }

  async commandCreateProject() {
    let project = await this.inputPackages(strings.CREATE_PROJECT_PROMPT)
    if (!project || !project.length) { return }
    project = project[0]

    let pickedFolder = await this.pickWorkspaceFolder(false, false, true)
    if (!pickedFolder) { return }

    const newFolder = pickedFolder === true
    if (newFolder) {
      pickedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: strings.OPEN_FOLDER_BTN
      })
      if (!pickedFolder || !pickedFolder.length) { return }
      pickedFolder = pickedFolder[0]
    } else {
      pickedFolder = pickedFolder.wsFolder.uri
    }

    const args = await this.pickAdditionalArgs(['create-project'])
    const task = new ComposerCommandTask(
      'create-project', vscode.TaskScope.Workspace, [...args, project, pickedFolder.fsPath]
    )
    task.executeWithProgress(strings.CREATING_PROJECT, () => {
      if (newFolder) {
        this.addWorkspaceFolder(pickedFolder)
      }
    })
  }

}

module.exports = {
  ComposerCommands,
  ComposerCommandTask
}

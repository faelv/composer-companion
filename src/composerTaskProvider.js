const vscode = require('vscode');
const cp = require('child_process');
const strings = require('./composerStrings');
const { ComposerWorkspaceFolders, ComposerWorkspaceFolderData } = require('./composerWorkspaceFolders');
const { ComposerSettings } = require('./composerSettings');
const { ComposerOutput } = require('./composerOutput');

/**
 * @implements {vscode.TaskDefinition}
 */
class ComposerTaskDefinition {

  static TASK_TYPE = 'composer'

  /** @type {string} */
  script

  /**
   * @param {string} script
   */
  constructor(script) {
    this.script = script
  }

  /** @returns {string} */
  get type() {
    return ComposerTaskDefinition.TASK_TYPE
  }
}

class ComposerBaseTask extends vscode.Task {

  /**
   * @param {string | undefined} cwd
   * @returns {vscode.ShellExecutionOptions | undefined}
   */
  static getShellOptions(cwd = undefined) {
    let opts
    if (process.platform === 'win32') {
      opts = {
        executable: 'cmd.exe',
        shellArgs: ['/d', '/c']
      }
      if (cwd) {
        opts = {...opts, cwd}
      }
    } else if (cwd) {
      opts = {cwd}
    }
    return opts
  }

}

class ComposerTask extends ComposerBaseTask {

  /** @type {vscode.Uri} */
  folderUri

  /**
   * @param {string} executable
   * @param {string} script
   * @param {vscode.Uri} folderUri
   * @param {vscode.WorkspaceFolder} scope
   * @param {ComposerTaskDefinition | undefined} definition
   */
  constructor(executable, script, folderUri, scope, definition = undefined) {
    super(
      definition || new ComposerTaskDefinition(script),
      scope,
      script,
      ComposerTaskDefinition.TASK_TYPE,
      new vscode.ShellExecution(
        {value: executable, quoting: vscode.ShellQuoting.Weak},
        [
          'run',
          script,
          '-d',
          folderUri.fsPath
        ],
        ComposerBaseTask.getShellOptions(folderUri.fsPath)
      )
    )

    this.folderUri = folderUri
  }

  /** @returns {string} */
  get script() {
    return this.name
  }

}

/**
 * @implements {vscode.TaskProvider}
 */
class ComposerTaskProvider extends vscode.Disposable {

  /** @type {ComposerTaskProvider} */
  static instance

  /** @type {ComposerOutput} */
  output
  /** @type {ComposerSettings} */
  settings
  /** @type {string} */
  _executablePath
  /** @type {ComposerWorkspaceFolders} */
  workspaceFolders
  /** @type {Promise<ComposerTask[]} */
  tasksPromise
  /** @type {vscode.Disposable} */
  registerDisp

  /** @returns {ComposerTaskProvider} */
  static getInstance() {
    if (!ComposerTaskProvider.instance) {
      ComposerTaskProvider.instance = new ComposerTaskProvider()
    }
    return ComposerTaskProvider.instance
  }

  constructor() {
    super(() => {
      this.registerDisp.dispose()

      this.output.appendLine(`${strings.TASK_PROVIDER}: ${strings.DISPOSED}`)
    })

    this.output = ComposerOutput.getInstance()
    this.settings = ComposerSettings.getInstance()
    this.workspaceFolders = ComposerWorkspaceFolders.getInstance()
    this.registerDisp = vscode.tasks.registerTaskProvider(ComposerTaskDefinition.TASK_TYPE, this)

    this.settings.addOnChangeListener('taskProvider', (affects) => {
      if (affects(ComposerSettings.SECTION_EXECUTABLE_PATH)) {
        this.tasksPromise = undefined
        this._executablePath = undefined
        this.checkExecutablePath()
      }
    })

    this.checkExecutablePath()

    this.output.appendLine(`${strings.TASK_PROVIDER}: ${strings.REGISTERED}`)
  }

  /** @returns {string} */
  get executablePath() {
    if (!this._executablePath) {
      this._executablePath = this.settings.getExecutablePath(undefined, true)
    }
    return this._executablePath
  }

  /** @returns {Promise<void>} */
  checkExecutablePath() {
    return new Promise((resolve) => {
      cp.exec(`${this.executablePath} --quiet`, (error) => {
        if (error) {
          vscode.window.showErrorMessage(`${strings.EXT_NAME}: ${strings.EXE_PATH_INVALID_MSG}`)
          this.output.appendLine(`${strings.SETTINGS} (${strings.EXE_PATH}): [${strings.INVALID}] ${this.executablePath}`)
        } else {
          this.output.appendLine(`${strings.SETTINGS} (${strings.EXE_PATH}): [${strings.OK}] ${this.executablePath}`)
        }
        resolve(error === null)
      })
    })
  }

  /** @returns {Promise<ComposerTask[]>} */
  async getTasks() {
    let tasksArr = []

    for (const elm of this.workspaceFolders.wsFolderMap) {
      const wsFolder = elm[0]
      const folder = elm[1]

      for (const script of folder.scripts) {
        const task = new ComposerTask(this.executablePath, script, folder.folderUri, wsFolder)

        switch (script.toLowerCase()) {
          case 'build':
            task.group = vscode.TaskGroup.Build
            break;
          case 'test':
            task.group = vscode.TaskGroup.Test
            break;
          case 'watch':
            task.group = vscode.TaskGroup.Rebuild
            break;
          case 'clean':
            task.group = vscode.TaskGroup.Clean
            break;
        }

        tasksArr.push(task)
      }
    }

    this.workspaceFolders.stale = false

    this.output.debugAppendLine(`${strings.TASK_PROVIDER}: ${tasksArr.length} ${strings.TASKS_RETURNED}`)
    return tasksArr
  }

  /**
   *
   * @param {string} script
   * @param {vscode.Uri} folderUri
   * @returns {ComposerTask | null}
   */
  async findTask(script, folderUri) {
    const tasks = await this.provideTasks()
    for (const task of tasks) {
      if (task.script === script && folderUri === task.folderUri) {
        return task
      }
    }
    return null
  }

  /** @returns {Promise<ComposerTask[]>} */
  provideTasks() {
    if (!this.tasksPromise || this.workspaceFolders.stale) {
      this.tasksPromise = this.getTasks()

      this.output.debugAppendLine(`${strings.TASK_PROVIDER}: ${strings.TASKS_REQUESTED} [${strings.OK}]`)
    } else {
      this.output.debugAppendLine(`${strings.TASK_PROVIDER}: ${strings.TASKS_REQUESTED} [${strings.CACHED}]`)
    }

    return this.tasksPromise
  }

  /**
   * @param {vscode.Task} task
   * @returns {ComposerTask | undefined}
   */
  resolveTask(task) {
    const scope = task.scope
    const folder = this.workspaceFolders.wsFolderMap.get(scope)
    const script = task.definition.script

    if (folder && folder.scriptSet.has(script)) {
      return new ComposerTask(this.executablePath, script, folder.folderUri, scope, task.definition)
    }
    return undefined
  }

}

module.exports = {
  ComposerTaskProvider,
  ComposerTaskDefinition,
  ComposerBaseTask,
  ComposerTask
}

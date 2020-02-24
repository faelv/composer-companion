const vscode = require('vscode');
const { ComposerOutput } = require('./composerOutput');
const { ComposerSettings } = require('./composerSettings');
const { ComposerCommands } = require('./composerCommands');
const { ComposerTaskProvider } = require('./composerTaskProvider');
const { ComposerWorkspaceFolders } = require('./composerWorkspaceFolders');
const { ComposerScriptsTreeDataProvider } = require('./composerScriptsTreeDataProvider');

class ComposerExtension extends vscode.Disposable {

	/** @type {ComposerOutput} */
	output
	/** @type {ComposerSettings} */
	settings
	/** @type {ComposerWorkspaceFolders} */
	workspaceFolders
	/** @type {ComposerCommands} */
	commands
	/** @type {ComposerTaskProvider} */
	taskProvider
	/** @type {ComposerScriptsTreeDataProvider} */
	treeProvider

	constructor() {
		super(() => {
			vscode.commands.executeCommand('setContext', `${ComposerSettings.SECTION}.${ComposerSettings.SECTION_ACTIVE}`, false)

			this.commands.dispose()
			this.treeProvider.dispose()
			this.taskProvider.dispose()
			this.workspaceFolders.dispose()
			this.settings.dispose()
			this.output.dispose()
		})

    vscode.commands.executeCommand('setContext', `${ComposerSettings.SECTION}.${ComposerSettings.SECTION_ACTIVE}`, true)

		this.output = ComposerOutput.getInstance()
		this.output.appendLine('Extension: Active')

		this.settings = ComposerSettings.getInstance()
		this.commands = ComposerCommands.getInstance()
		this.workspaceFolders = ComposerWorkspaceFolders.getInstance()
		this.taskProvider = ComposerTaskProvider.getInstance()
		this.treeProvider = ComposerScriptsTreeDataProvider.getInstance()
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(new ComposerExtension());
}

function deactivate() {
}

module.exports = {
	activate,
	deactivate,
	ComposerExtension
}

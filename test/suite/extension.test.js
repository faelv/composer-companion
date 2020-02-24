const assert = require('assert');
const path = require('path');
const fs = require('fs');
const simple = require('simple-mock');
const vscode = require('vscode');
//const { ComposerExtension } = require('../../src/extension');

function cleanDir(dir, rootDir = true) {
	fs.readdirSync(dir).forEach((file) => {
		const cur = path.join(dir, file)
		if (fs.lstatSync(cur).isDirectory()) {
			cleanDir(cur, false)
		} else {
			if (file !== 'README.md') {
				fs.unlinkSync(cur)
			}
		}
	})
	if (!rootDir) {
		fs.rmdirSync(dir)
	}
}

suite('Commands', () => {

	/** @type {ComposerExtension} */
	let extension
	/** @type {string} */
	let testDir
	/** @type {number} */
	let quickPickIndex = 0

	suiteSetup(() => {
		testDir = path.resolve(__dirname, '..', '..', 'test', 'data')
		cleanDir(testDir)

		simple.mock(vscode.window, 'showQuickPick').callFn(async (items, options) => items[quickPickIndex])
		simple.mock(vscode.window, 'showOpenDialog').callFn(async (options) => {
			return [vscode.Uri.file(testDir)]
		})

		//extension = new ComposerExtension()

		/* simple.mock(extension.commands, 'addWorkspaceFolder').callFn((folderUri) => {
			vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
        0,
        {uri: folderUri}
      )
		}) */
	})

	suiteTeardown(() => {
		simple.restore()
		cleanDir(testDir)
	})

	test('init', async () => {
		let terminal

		const eDisp = vscode.window.onDidChangeActiveTerminal(async (t) => {
			terminal = t
			await terminal.processId

			terminal.sendText('test/test')
			terminal.sendText('')
			terminal.sendText('n')
			terminal.sendText('')
			terminal.sendText('')
			terminal.sendText('')
			terminal.sendText('no')
			terminal.sendText('no')
			terminal.sendText('')

			terminal.sendText('')
			//terminal._runQueuedRequests()
			eDisp.dispose()
		})

		//await extension.commands.commandInit()
		await vscode.commands.executeCommand('composerCompanion.init')
		if (terminal) {
			terminal.dispose()
		}
		assert.ok(fs.existsSync(path.join(testDir, 'composer.json')), 'Failed to init composer.json')
	});

	test('open', async () => {
		const fileUri = vscode.Uri.file(path.join(testDir, 'composer.json'))

		//const editorA = await extension.commands.commandOpen(fileUri)
		const editorA = await vscode.commands.executeCommand('composerCompanion.open', fileUri)
		assert.notEqual(editorA, undefined, 'Failed to open composer.json from parameter')

		//const editorB = await extension.commands.commandOpen()
		const editorB = await vscode.commands.executeCommand('composerCompanion.open')
		assert.notEqual(editorB, undefined, 'Failed to open composer.json from picked folder')
	});

});

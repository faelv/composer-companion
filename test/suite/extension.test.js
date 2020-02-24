const assert = require('assert');
const path = require('path');
const fs = require('fs');
const simple = require('simple-mock');
const vscode = require('vscode');
const { ComposerExtension } = require('../../src/extension');

suite('Commands', () => {

	/** @type {ComposerExtension} */
	let extension
	/** @type {string} */
	let testDir
	/** @type {number} */
	let quickPickIndex = 0

	suiteSetup(() => {
		testDir = path.resolve(__dirname, '..', '..', '.vscode-test', 'test-data')
		if (!fs.existsSync(testDir)) {
			fs.mkdirSync(testDir)
		}
		testDir = fs.mkdtempSync(`${testDir}${path.sep}`)

		simple.mock(vscode.window, 'showQuickPick').callFn(async (items, options) => items[quickPickIndex])
		simple.mock(vscode.window, 'showOpenDialog').callFn(async (options) => {
			return [vscode.Uri.file(testDir)]
		})

		extension = new ComposerExtension()
		simple.mock(extension.commands, 'addWorkspaceFolder').returnWith(undefined)
	})

	suiteTeardown(() => {
		simple.restore()
		//fs.rmdirSync(testDir, {recursive: true})
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

		await extension.commands.commandInit()
		if (terminal) {
			terminal.dispose()
		}
		assert.ok(fs.existsSync(path.join(testDir, 'composer.json')))
	});



});

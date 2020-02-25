const assert = require('assert');
const path = require('path');
const fs = require('fs');
const simple = require('simple-mock');
const vscode = require('vscode');
const { ComposerExtension } = require('../../src/extension');
const { ComposerWorkspaceFolderData } = require('../../src/composerWorkspaceFolders');

function cleanDir(dir, rootDir = true) {
	fs.readdirSync(dir).forEach((file) => {
		const cur = path.join(dir, file)
		if (fs.lstatSync(cur).isDirectory()) {
			cleanDir(cur, false)
		} else {
			if (!(file === 'README.md' && rootDir)) {
				fs.unlinkSync(cur)
			}
		}
	})
	if (!rootDir) {
		fs.rmdirSync(dir)
	}
}

suite('Commands', () => {

	const extraTime = '120s'

	/** @type {ComposerExtension} */
	let extension
	/** @type {string} */
	let testDir
	/** @type {number} */
	let quickPickIndex
	/** @type {string} */
	let inputBoxResult
	/** @type {ComposerWorkspaceFolderData} */
	let firstWSFData
	/** @type {Function} */
	let firstWSFDataOnLoaded

	suiteSetup(() => {
		testDir = path.resolve(__dirname, '..', '..', 'test', 'data')
		cleanDir(testDir)

		extension = ComposerExtension.getInstance()

		firstWSFData = extension.workspaceFolders.folders[0]
		firstWSFDataOnLoaded = firstWSFData.onLoaded

		simple.mock(vscode.window, 'showQuickPick').callFn(async (items, options) => {
			if (options.canPickMany) {
				if (!Array.isArray(quickPickIndex)) {
					quickPickIndex = [quickPickIndex]
				}
				return items.filter((value, index) => quickPickIndex.includes(index))
			} else {
				return items[quickPickIndex]
			}
		})
		simple.mock(vscode.window, 'showOpenDialog').callFn(async (options) => {
			return [vscode.Uri.file(testDir)]
		})
		simple.mock(vscode.window, 'showInputBox').callFn(async (options) => {
			if (options.validateInput) {
				const vr = options.validateInput(inputBoxResult)
				if ((typeof vr === 'string') && vr.length) {
					return
				}
			}
			return inputBoxResult
		})
		simple.mock(extension.commands, 'addWorkspaceFolder').returnWith(undefined)
	})

	suiteTeardown(() => {
		simple.restore()
		cleanDir(testDir)
	})

	setup(() => {
		quickPickIndex = 0
		inputBoxResult = ''
	})

	teardown(() => {
		firstWSFData.onLoaded = firstWSFDataOnLoaded
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

		await vscode.commands.executeCommand('composerCompanion.init')
		if (terminal) {
			terminal.dispose()
		}
		assert.ok(fs.existsSync(path.join(testDir, 'composer.json')), 'Failed to init composer.json')
	});

	test('open', async () => {
		const fileUri = vscode.Uri.file(path.join(testDir, 'composer.json'))

		const editorA = await vscode.commands.executeCommand('composerCompanion.open', fileUri)
		assert.notEqual(editorA, undefined, 'Failed to open composer.json from parameter')

		const editorB = await vscode.commands.executeCommand('composerCompanion.open')
		assert.notEqual(editorB, undefined, 'Failed to open composer.json from picked folder')
	});

	test('require', async () => {
		inputBoxResult = 'phpunit/phpunit:6.5.14 psr/log:1.1.2'
		quickPickIndex = [0, 8] // --dev 0 --no-update 8 --no-cache 4

		let resultResolve
		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		firstWSFData.onLoaded = (s) => {
			firstWSFDataOnLoaded(s)
			const req = firstWSFData.requires[0]
			if (req) {
				assert.equal(req.label, 'phpunit/phpunit', 'Wrong require label')
				assert.equal(req.dev, true, 'Dependency not a dev dependency')
				resultResolve()
			}
		}

		vscode.commands.executeCommand('composerCompanion.require')
		return result
	}).timeout(extraTime);

});

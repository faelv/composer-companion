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

	const extraTime = '100s'

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
			let indexes

			if (typeof quickPickIndex === 'function') {
				indexes = quickPickIndex(items, options)
			} else {
				indexes = quickPickIndex
			}

			if (options.canPickMany) {
				if (!Array.isArray(indexes)) {
					indexes = [indexes]
				}
				return items.filter((value, index) => indexes.includes(index))
			} else {
				return items[indexes]
			}
		})
		simple.mock(vscode.window, 'showOpenDialog').callFn(async (options) => {
			return [firstWSFData.folderUri]
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

		return new Promise((resolve) => {
			setTimeout(() => resolve(), 2000)
		})
	})

	teardown(() => {
		firstWSFData.onLoaded = firstWSFDataOnLoaded
	})

	test('init', async () => {
		quickPickIndex = 1

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
		const filePath = path.join(testDir, 'composer.json')
		const fileUri = vscode.Uri.file(path.join(filePath))

		const editorA = await vscode.commands.executeCommand('composerCompanion.open', fileUri)
		assert.notEqual(editorA, undefined, 'Failed to open composer.json from parameter')

		const editorB = await vscode.commands.executeCommand('composerCompanion.open')
		assert.notEqual(editorB, undefined, 'Failed to open composer.json from picked folder')

		let jsonStr = fs.readFileSync(filePath, {encoding: 'utf8'})
		let jsonObj = JSON.parse(jsonStr)
		jsonObj.scripts = {
			test: 'echo test'
		}
		jsonStr = JSON.stringify(jsonObj)
		fs.writeFileSync(filePath, jsonStr, 'utf8')
		firstWSFData._stale = true
		await firstWSFData.loadScripts()

		vscode.commands.executeCommand('workbench.action.closeActiveEditor')
	});

	test('require', async () => {
		inputBoxResult = 'phpunit/phpunit:6.5.14 psr/log:1.1.2'
		quickPickIndex = [0, 8] // --dev 0 --no-update 8 --no-cache 4

		let resultResolve
		let taskExec

		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		firstWSFData.onLoaded = (s) => {
			firstWSFDataOnLoaded(s)
			const req = firstWSFData.requires[0]
			if (req) {
				assert.equal(firstWSFData.requireSet.size, 2, 'Wrong requireSet size')
				assert.equal(req.label, 'phpunit/phpunit', 'Wrong require label')
				assert.equal(req.dev, true, 'Dependency not a dev dependency')
				taskExec.terminate()
				resultResolve()
			}
		}

		taskExec = await vscode.commands.executeCommand('composerCompanion.require')
		return result
	}).timeout(extraTime);

	test('remove', async () => {
		let qpCall = 0
		let resultResolve
		let taskExec

		quickPickIndex = () => {
			qpCall++
			if (qpCall === 1) { return [1] }
			if (qpCall === 2) { return [0, 7] }
		}

		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		firstWSFData.onLoaded = (s) => {
			firstWSFDataOnLoaded(s)
			const req = firstWSFData.requires[0]
			if (req) {
				assert.equal(firstWSFData.requireSet.size, 1, 'Wrong requireSet size')
				assert.equal(req.label, 'phpunit/phpunit', 'Wrong require label')
				taskExec.terminate()
				resultResolve()
			}
		}

		taskExec = await vscode.commands.executeCommand('composerCompanion.remove')
		return result
	});

	test('install', async () => {
		quickPickIndex = []

		let resultResolve
		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		const taskDisp = vscode.tasks.onDidEndTask((event) => {
			if (event.execution.task.name === 'install' && event.execution.task.source === 'composer') {
				taskDisp.dispose()
				assert.ok(fs.existsSync(path.join(testDir, 'vendor', 'autoload.php')), 'Missing autoload.php')
        resultResolve()
      }
		})

		await vscode.commands.executeCommand('composerCompanion.install')
		return result
	}).timeout(extraTime);

	test('update', async () => {
		fs.unlinkSync(path.join(testDir, 'vendor', 'autoload.php'))

		quickPickIndex = []

		let resultResolve
		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		const taskDisp = vscode.tasks.onDidEndTask((event) => {
			if (event.execution.task.name === 'update' && event.execution.task.source === 'composer') {
				taskDisp.dispose()
				assert.ok(fs.existsSync(path.join(testDir, 'vendor', 'autoload.php')), 'Missing autoload.php')
        resultResolve()
      }
		})

		await vscode.commands.executeCommand('composerCompanion.update')
		return result
	}).timeout(extraTime);

	test('exec', async () => {
		quickPickIndex = 0
		inputBoxResult = '-h'

		let resultResolve
		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		const taskDisp = vscode.tasks.onDidEndTask((event) => {
			if (event.execution.task.name === 'exec' && event.execution.task.source === 'composer') {
				taskDisp.dispose()

        resultResolve()
      }
		})

		await vscode.commands.executeCommand('composerCompanion.exec')
		return result
	});

	test('run [string]', async () => {
		let resultResolve
		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		const taskDisp = vscode.tasks.onDidEndTask((event) => {
			if (event.execution.task.name === 'test') {
				taskDisp.dispose()
        resultResolve()
      }
		})

		const cr = await vscode.commands.executeCommand('composerCompanion.run', 'test', firstWSFData.folderUri)
		assert.notEqual(cr, undefined, 'Undefined task')
		return result
	});

	test('run [pick]', async () => {
		let resultResolve
		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		const taskDisp = vscode.tasks.onDidEndTask((event) => {
			if (event.execution.task.name === 'test') {
				taskDisp.dispose()
        resultResolve()
      }
		})

		const cr = await vscode.commands.executeCommand('composerCompanion.run')
		assert.notEqual(cr, undefined, 'Undefined task')
		return result
	});

	test('run [tree]', async () => {
		const rootChildren = await extension.treeProvider.getChildren(undefined)
		assert.equal(rootChildren.length, 1, 'Wrong number of tree root children')

		const parent = rootChildren[0]
		const children = await extension.treeProvider.getChildren(parent)
		assert.equal(children.length, 1, 'Wrong number of tree children')

		let resultResolve
		const result = new Promise((resolve) => {
			resultResolve = resolve
		})

		const taskDisp = vscode.tasks.onDidEndTask((event) => {
			if (event.execution.task.name === 'test') {
				taskDisp.dispose()
        resultResolve()
      }
		})

		const cr = await vscode.commands.executeCommand('composerCompanion.run', children[0])
		assert.notEqual(cr, undefined, 'Undefined task')
		return result
	});

});

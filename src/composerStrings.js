class ComposerFlagMap extends Map {

  /**
   * @param {...string} groups
   * @returns {vscode.QuickPickItem[]}
   */
  valuesByGroup(...groups) {
    return Array.from(this.values()).filter((value) => value.groups.some((group) => groups.includes(group)))
  }

}

class ComposerFlags {

  /** @type {Map<string, vscode.QuickPickItem}>} */
  all = new ComposerFlagMap()

  constructor() {
    this.set("--dev", "Install packages listed in require-dev", ['update', 'install'], -100)
    this.set("--dev:require", "Add packages to require-dev", ['require'], -100)
    this.set("--dev:remove", "Remove packages from require-dev", ['remove'], -100)
    this.set("--no-dev", "Skip installing packages listed in require-dev", ['update', 'install'], -70)
    this.set("--interactive", "Interactive interface to select the packages to update (alias: -i)", ['update'], -60)

    this.set("--all", "List all packages available in all your repositories", ['show'])
    this.set("--apcu", "Use APCu to cache found/not-found classes", ['dump-autoload'])
    this.set("--apcu-autoloader", "Use APCu to cache found/not-found classes", ['require', 'update', 'install', 'remove'])
    this.set("--available", "List available packages only", ['show'])
    this.set("--clean-backups", "Delete old backups during an update", ['self-update'])
    this.set("--classmap-authoritative", "Autoload classes from the classmap only", ['require', 'update', 'install', 'remove', 'dump-autoload'])
    this.set("--direct", "Shows only packages that are directly required by the root package", ['outdated'])
    this.set("--dry-run", "Simulate the command without actually doing anything", ['update', 'install'])
    this.set("--homepage", "Open the homepage instead of the repository URL", ['browse'])
    this.set("--ignore-platform-reqs", "Ignore php, hhvm, lib-* and ext-* requirements", ['require', 'update', 'install', 'remove'])
    this.set("--lock", "Only updates the lock file hash", ['update'])
    this.set("--minor-only", "Show only packages that have minor SemVer-compatible updates", ['outdated'])
    this.set("--name-only", "List package names only", ['show'])
    this.set("--no-autoloader", "Skips autoloader generation", ['update', 'install'])
    this.set("--no-cache", "Prevent use of the cache", ['update', 'install', 'require', 'remove', 'search', 'outdated', 'show', 'status', 'self-update'])
    this.set("--no-check-all", "Do not validate requires for overly strict/loose constraints", ['validate'])
    this.set("--no-check-lock", "Do not check if lock file is up to date", ['validate'])
    this.set("--no-check-publish", "Do not check for publish errors", ['validate'])
    this.set("--no-dev", "Disables autoload-dev rules", ['dump-autoload'])
    this.set("--no-dev:check-platform-reqs", "Disables checking of require-dev packages requirements", ['check-platform-reqs'])
    this.set("--no-progress", "Removes the progress display", ['require', 'update', 'install', 'remove', 'self-update'])
    this.set("--no-scripts", "Skips execution of scripts defined in composer.json", ['require', 'update', 'install', 'remove', 'dump-autoload'])
    this.set("--no-suggest", "Skips suggested packages in the output", ['require', 'update', 'install'])
    this.set("--no-update", "Disables the automatic update of the dependencies", ['require', 'remove'])
    this.set('--no-update-with-dependencies', "Does not allow inherited dependencies to be updated with explicit dependencies", ['remove'])
    this.set('--only-name', "Search only in name", ['search'])
    this.set("--optimize", "Optimizes PSR0 and PSR4 packages to be loaded with classmaps too", ['dump-autoload'])
    this.set("--optimize-autoloader", "Convert PSR-0/4 autoloading to classmap", ['require', 'update', 'install', 'remove'])
    this.set("--path", "Show package paths", ['show'])
    this.set("--platform", "List only platform packages (php & extensions)", ['show'])
    this.set("--prefer-dist", "Install packages from dist when available", ['require', 'update', 'install'])
    this.set("--prefer-lowest", "Prefer lowest versions of dependencies", ['require', 'update'])
    this.set("--prefer-source", "Install packages from source when available", ['require', 'update', 'install'])
    this.set("--prefer-stable", "Prefer stable versions of dependencies", ['require', 'update'])
    this.set("--preview", "Force an update to the preview channel", ['self-update'])
    this.set("--rollback", "Revert to an older installation of composer", ['self-update'])
    this.set("--root-reqs", "Restricts the update to your first degree dependencies", ['update'])
    this.set("--self", "List the root package info", ['show'])
    this.set("--set-channel-only", "Only store the channel as the default one and then exit", ['self-update'])
    this.set("--show", "Only show the homepage or repository URL", ['browse'])
    this.set("--snapshot", "Force an update to the snapshot channel", ['self-update'])
    this.set("--sort-packages", "Keep packages sorted in composer.json", ['require'])
    this.set("--stable", "Force an update to the stable channel", ['self-update'])
    this.set("--tree", "List the dependencies as a tree", ['show'])
    this.set("--update-keys", "Prompt user for a key update", ['self-update'])
    this.set("--update-no-dev", "Run the dependency update with the --no-dev option", ['require', 'remove'])
    this.set("--update-with-all-dependencies", "Also update dependencies of the newly required packages, including root requirements", ['require'])
    this.set("--update-with-dependencies", "Also update dependencies of the newly required packages, except root requirements", ['require'])
    this.set("--update-with-dependencies:remove", "Also update dependencies of the removed packages", ['remove'])
    this.set("--with-all-dependencies", "Add also all dependencies of whitelisted packages to the whitelist", ['update'])
    this.set("--with-dependencies", "Add also dependencies of whitelisted packages to the whitelist", ['update'])
    this.set("--with-dependencies:validate", "Also validate the composer.json of all installed dependencies", ['validate'])
    this.set("--verbose", "More verbose", ['update', 'install', 'require', 'remove', 'outdated', 'show', 'status', 'validate', 'self-update', 'dump-autoload'])
  }

  /**
   * @param {string} flag
   * @param {string} description
   * @param {string[]} groups
   * @param {number} sort
   */
  set(flag, description, groups = [], sort = 0) {
    const pos = flag.lastIndexOf(':')
    const label = pos === -1 ? flag : flag.slice(0, pos)
    this.all.set(flag, {label, detail: description, flag, groups, sort})
  }

  /**
   * @param  {...string} includes
   * @returns {vscode.QuickPickItem[]}
   */
  filter(...includes) {
    const items = new Set()
    let groups = []

    for (const inc of includes) {
      if (inc.startsWith('-')) {
        const val = this.all.get(inc)
        if (val) {
          items.add(val)
        }
      } else {
        groups.push(inc)
      }
    }

    const fromGroups = this.all.valuesByGroup(...groups)
    for (const val of fromGroups) {
      items.add(val)
    }

    const itemsArr = Array.from(items.values())
    itemsArr.sort((a, b) => a.sort - b.sort)
    return itemsArr
  }

}

module.exports = {
  EXT_NAME: 'Composer Companion',
  CHANNEL_NAME: 'Composer Companion',
  TASK_PROVIDER: 'Task Provider',
  COMMANDS: 'Commands',
  SETTINGS: 'Settings',
  WS_FOLDERS: 'Workspace Folders',
  TREE_PROVIDER: 'Explorer Scripts',
  OK: 'Ok',
  INVALID: 'Invalid',
  FAIL: 'Failed',
  REGISTERED: 'Registered',
  DISPOSED: 'Disposed',
  CACHED: 'Cached',
  CREATED: 'Created',
  MODIFIED: 'Modified',
  DELETED: 'Deleted',
  UPDATE: 'Update',
  RUN: 'Run',
  ENABLED: 'Enabled',
  YES: 'Yes',
  NO: 'No',
  FOLDER_ADDED: 'Added',
  FOLDER_REMOVED: 'Removed',
  FOLDER_DISABLED: 'Disabled',
  FOLDER_NO_COMPOSER: 'Missing',
  FOLDER_SCRIPTS: 'Scripts',
  FOLDER_REQUIRES: 'Requires +dev',
  CHANGE_AFFECTED: 'Affected by a change in',
  OPEN_COMPOSER_FILE: 'Open composer.json',
  EXE_PATH: 'executablePath',
  EXE_PATH_INVALID_MSG: 'Executable path is invalid, change it in Settings',
  TASKS_REQUESTED: 'Tasks requested',
  TASKS_RETURNED: 'tasks returned',
  SELECT_SCRIPT: 'Select a script',
  SELECT_WS_FOLDER: 'Select a workspace folder',
  SELECT_ADDITIONAL_FLAGS: 'Select additional options or <Esc> to skip',
  REQUIRE_PROMPT: 'Type the package names or leave it empty to search in terminal',
  SEARCH_PROMPT: 'Type your search...',
  UPDATE_PROMPT: 'Optionally select packages to update (or use --interactive) or <Esc> to cancel',
  REMOVE_PROMPT: 'Select packages to remove or <Esc> to cancel',
  BROWSE_PROMPT: 'Select a package or <Esc> to cancel',
  SHOW_PROMPT: 'Optionally select a package to show details or <Esc> to show all',
  SELFUPDATE_PROMPT: 'Optionally specify a version or <Esc> to use latest',
  EXEC_BIN_PROMPT: 'Select a binary to execute or <Esc> to cancel',
  EXEC_ARGS_PROMPT: 'Optional arguments',
  REQUIRE_PLACEHOLDER: 'vendor/package vendor2/package2:1.0',
  INVALID_PACKAGE_NAMES: 'There are invalid package names',
  INVALID_EMPTY: 'It can\'t be empty',
  NO_WORKSPACE_MSG: 'No workspace, open a folder or workspace first',
  NO_COMPOSER_IN_FOLDER_MSG: 'No composer.json in workspace folder',
  NO_BINARIES_MSG: 'No binaries for workspace folder',
  FOLDER_DISABLED_MSG: 'Disabled for',
  FETCHING_BINARIES: 'Fetching binaries',
  COMPOSER_OVERWRITE: 'You will overwrite this folder\'s composer.json. Continue?',

  flags: new ComposerFlags()
}

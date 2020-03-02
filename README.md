# Composer Companion

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/faelv.composer-companion?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=faelv.composer-companion)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/faelv.composer-companion?style=flat-square)
[![GitHub issues](https://img.shields.io/github/issues/faelv/composer-companion?style=flat-square)](https://github.com/faelv/composer-companion/issues)
[![Travis (.com) branch](https://img.shields.io/travis/com/faelv/composer-companion/master?style=flat-square)](https://travis-ci.com/faelv/composer-companion)
[![Donate PayPal](https://img.shields.io/badge/Donate-PayPal-blue?style=flat-square)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WRBW9WAGJ9QFL&source=url)

This is a companion extension for [**Composer**](https://getcomposer.org/), a dependency manager for PHP. Check out it's features below.

## Features

### Composer Scripts

![Composer Scripts](images/scripts.png)

Shows scripts in a dedicated view inside Explorer container, where you can easily run them or open their respective _composer.json_ file.

### Tasks

![Tasks](images/tasks.png)

Scripts can also be found as tasks in _**Terminal > Run Task / Run Build Task**_.

### Easy access to Composer commands

![Easy acces to Composer commands](images/commands.gif)

Press _**Ctrl+Shift+P**_ and start typing _**composer**_ to see all the available commands. The necessary inputs or arguments can be conveniently picked from a menu.

### Schema Validation

Validates and offer hints about the _**composer.json**_ file structure.

## Requirements

- **Composer**, version 1.9.0 or higher recommended (https://getcomposer.org/download/)
- **PHP**, version 5.3.2 or higher

## For Windows users

Using `composer.bat` instead of `composer.phar` is recommended.

If you don't have a `composer.bat` file you can create one in the same folder as `composer.phar`. Copy and paste the following content, then save:

```
@echo OFF
setlocal DISABLEDELAYEDEXPANSION
"php.exe" "%~dp0composer.phar" %*
```

(you may need to adjust the `php.exe` location).

## Extension Settings

This extension contributes the following settings:

* `composerCompanion.enabled` ( <span style="color: blue;">**true**</span> | <span style="color: blue;">false</span> ): If Composer Companion is enabled or not. It can be used in _user_, _workspace_ and _folder_ settings.
* `composerCompanion.executablePath` ( <span style="color: blue;">string </span>): Path to the composer executable. It can be used in _user_ and _workspace_ settings; if not specified the extension will try to pick it automatically, otherwise you'll see a warning.
* `composerCompanion.showScriptsInExplorer` ( <span style="color: blue;">**true**</span> | <span style="color: blue;">false</span> ): If Composer Companion should add a scripts view to the Explorer container. It's only available in the _user_ settings.

## Support

If something isn't working open an issue [here](https://github.com/faelv/composer-companion/issues).

Usually no one bothers to do it, but if you liked this extension consider leaving a rating and/or review, it means a lot to me. There's also a donation button if you are feeling generous. Top 10 donors get to display their name and a link of their choosing here, just provide an e-mail in the donation message, or [contact me](https://github.com/faelv).

#

### Third-Party Notices
- [**Codicons**](https://github.com/microsoft/vscode-codicons) icons used under a [Creative Commons Attribution 4.0 International Public License](https://creativecommons.org/licenses/by/4.0/legalcode), see the LICENSE file at https://github.com/microsoft/vscode-codicons/blob/master/LICENSE
- **Composer logo** used under a MIT License, see the LICENSE file at https://github.com/composer/composer/blob/master/LICENSE

# Factory
[![npm version](https://img.shields.io/npm/v/factory.svg)](https://www.npmjs.com/package/factory)
![Stability](https://img.shields.io/badge/stability-stable-brightgreen.svg)
[![Build Status](https://travis-ci.org/timkendrick/factory.svg?branch=master)](https://travis-ci.org/timkendrick/factory)

> Quick and easy template scaffolding for Node


## Installation

```bash
npm install factory
```


## Example

```javascript
var factory = require('factory');

var widgetFactory = factory({
	template: 'templates/widget',
	placeholders: [
		{
			name: 'foo',
			type: 'input',
			message: 'Enter a value for foo'
		},
		{
			name: 'bar',
			type: 'input',
			message: 'Enter a value for bar'
		}
	]
});

var options = {
	destination: 'app/widgets',
	overwrite: true,
};
var context = {
	foo: 'baz'
};

// Node-style callback interface
widgetFactory(options, context, function(error, results) {
	if (error) {
		console.error('Widget creation failed: ' + error);
	} else {
		console.info('Widget created successfully');
	}
});

// Promise interface
widgetFactory(options, context)
	.then(function(results) {
		console.info('Widget created successfully');
	}).catch(function(error) {
		console.error('Widget creation failed: ' + error);
	});
```

Contents of `templates/widget/<%= foo %>.js`:

```javascript
module.exports = function <%= foo %>() {
	console.log('<%= bar %>');
};
```

Output at `app/widgets/baz.js`:

```javascript
module.exports = function baz() {
	console.log('[user-prompted value]');
};
```

## How it works

- Call the `factory()` function with the following parameters:
	- `template`: path to the template folder
	- `placeholders`: (optional) array of [inquirer](https://www.npmjs.com/package/inquirer) prompts used to gather data for injecting into templates
	- `getContext`: (optional) function that transforms placeholder values before they are passed to the template
- You can then call the function that is returned, specifying a destination path and any copy options, and optionally passing in a key/value object containing template placeholder values
- The user is prompted for the value of any placeholders which were not provided in the placeholder values object
- The files are copied from the `template` folder to the destination folder, replacing any placeholders in filenames and file content with the supplied values (using [lodash template](https://www.npmjs.com/package/lodash.template) syntax)


## Usage

### `factory(options)`

Create a factory from an existing template

Template filenames/contents can use [lodash template](https://www.npmjs.com/package/lodash.template) syntax to specify placeholder values. These are injected into the template when the factory function is invoked.

#### Options:

| Name | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |
| `template` | `string` | Yes | N/A | Path to the template folder |
| `placeholders` | `Array` | No | `[]` | Array of [inquirer](https://www.npmjs.com/package/inquirer) prompts used to gather data for injecting into templates |
| `getContext` | `function` | No | `null` | Function that transforms placeholder values before they are passed to the template |

##### Notes:

- `getContext` has the following signature:

	##### `function(context)`

	###### Arguments:

	| Name | Type | Description |
	| ---- | ---- | ----------- |
	| `context` | `object` | Key/value object containing placeholder values, gathered from factory `context` and template `placeholders` |

	###### Returns:

	`object` Key/value object containing transformed context placeholder for use in templates


#### Returns:

- #### `function(options, [context], [callback])`

 	Factory function used to create instances of the template

 	The user will be prompted for the value of any placeholders which are not specified in the `context` object.

 	##### Options:

 	| Name | Type | Required | Default | Description |
	| ---- | ---- | -------- | ------- | ----------- |
	| `options.destination` | `string` | Yes | N/A | Destination directory for output files |
	| `options.overwrite` | `boolean` | No | `false` | Whether to overwrite existing files |
	| `context` | `object` | No | `{}` | Preset template placeholder values |
	| `callback` | `function` | No | `null` | Node-style callback that is invoked when the operation completes/fails |

	##### Returns:

	`Promise<Array>` Promise, fulfilled with array of copy results:

	```json
	[
		{
			"src": "/path/to/src",
			"dest": "/path/to/dest",
			"stats": <Stats>
		},
		{
			"src": "/path/to/src/file.txt",
			"dest": "/path/to/dest/file.txt",
			"stats": <Stats>
		},
		{
			"src": "/path/to/src/subfolder",
			"dest": "/path/to/dest/subfolder",
			"stats": <Stats>
		},
		{
			"src": "/path/to/src/subfolder/nested.txt",
			"dest": "/path/to/dest/subfolder/nested.txt",
			"stats": <Stats>
		}
	]
	```


## Events

The value returned by the generated factory function implements the `EventEmitter` interface, and emits the following events:

| Event | Handler signature |
| ----- | ----------------- |
| `factory.events.ERROR` | `function(error, ErrorInfo)` |
| `factory.events.COMPLETE` | `function(Array<CopyOperation>)` |
| `factory.events.CREATE_DIRECTORY_START` | `function(CopyOperation)` |
| `factory.events.CREATE_DIRECTORY_ERROR` | `function(error, CopyOperation)` |
| `factory.events.CREATE_DIRECTORY_COMPLETE` | `function(CopyOperation)` |
| `factory.events.CREATE_SYMLINK_START` | `function(CopyOperation)` |
| `factory.events.CREATE_SYMLINK_ERROR` | `function(error, CopyOperation)` |
| `factory.events.CREATE_SYMLINK_COMPLETE` | `function(CopyOperation)` |
| `factory.events.COPY_FILE_START` | `function(CopyOperation)` |
| `factory.events.COPY_FILE_ERROR` | `function(error, CopyOperation)` |
| `factory.events.COPY_FILE_COMPLETE` | `function(CopyOperation)` |

...where the types referred to in the handler signature are as follows:

### `ErrorInfo`

| Property | Type | Description |
| -------- | ---- | ----------- |
| `src` | `string` | Source path of the file/folder/symlink that failed to copy |
| `dest` | `string` | Destination path of the file/folder/symlink that failed to copy |

### `CopyOperation`

| Property | Type | Description |
| -------- | ---- | ----------- |
| `src` | `string` | Source path of the relevant file/folder/symlink |
| `dest` | `string` | Destination path of the relevant file/folder/symlink |
| `stats ` | `fs.Stats` | Stats for the relevant file/folder/symlink |


### Example: using events

```javascript
var factory = require('factory');

var widgetFactory = factory({
	template: 'templates/widget'
});

var options = {
	destination: 'app/widgets'
};
var context = {};
widgetFactory(options, context)
	.on(factory.events.COPY_FILE_START, function(copyOperation) {
		console.info('Copying file ' + copyOperation.src + '...');
	})
	.on(factory.events.COPY_FILE_COMPLETE, function(copyOperation) {
		console.info('Copied to ' + copyOperation.dest);
	})
	.on(factory.events.ERROR, function(error, copyOperation) {
		console.error('Unable to copy ' + copyOperation.dest);
	})
	.then(function(results) {
		console.info('Widget created successfully');
	}).catch(function(error) {
		console.error('Widget creation failed: ' + error);
	});
```

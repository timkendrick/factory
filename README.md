# factory

> Quick and easy template scaffolding


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
	],
	options: {
		overwrite: true
	}
});

var destination = 'widgets';
var context = {
	foo: 'baz'
};
widgetFactory(destination, context, function(error, callback) {
	if (error) {
		console.error('Widget creation failed: ' + error);
	} else {
		console.info('Widget created successfully');
	}
});
```

Contents of `templates/widget/<%= foo %>.js`:

```javascript
module.exports = function <%= foo %>() {
	console.log('<%= bar %>');
};
```

Output at `widgets/baz.js`:

```javascript
module.exports = function baz() {
	console.log('[user-prompted value]');
};
```

## How it works

- The `factory()` function takes two arguments:
	- `template`: path to the template file/folder
	- `placeholders`: array of [inquirer](https://www.npmjs.com/package/inquirer) prompts used to gather data for injecting into templates
- You can then call the function that is returned, specifying a `destination` path and optionally passing in a key/value object containing template placeholder values
- The user is prompted for the value of any placeholders which were not provided in the key/value object
- The files are copied from the `template` path to the `destination`, replacing any placeholders in filenames and file content with the supplied values (using [lodash template](https://www.npmjs.com/package/lodash.template) syntax)


## Usage

### `factory(options)`

Create a factory from an existing template

Template filenames/contents can use [lodash template](https://www.npmjs.com/package/lodash.template) syntax to specify placeholder values. These are injected into the template when the factory is invoked.

Options:

| Name | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |
| `template` | `string` | Yes | N/A | Path to the template file/folder |
| `placeholders` | `array` | No | `[]` | Array of [inquirer](https://www.npmjs.com/package/inquirer) prompts used to gather data for injecting into templates |
| `options | `object` | No | `{}` | Copy options |
| `options.overwrite | `boolean` | `false` | Whether to overwrite existing files |

Returns:

- `function(destination, [context], [callback])`

 	Factory function used to create instances of the template
 	
 	The user will be prompted for the value of any placeholders which are not specified in the `context` object.
 	
 	Options: 
 	
 	| Name | Type | Required | Default | Description |
	| ---- | ---- | -------- | ------- | ----------- |
	| `destination` | `string` | Yes | N/A | Destination directory for output files |
	| `context` | `object` | No | `{}` | Preset template placeholder values |
	| `callback` | `function` | No | `null` | Node-style callback that is invoked when the operation completes/fails |

	Returns:

	- `Promise`: Promise that is fulfilled when the operation completes/fails

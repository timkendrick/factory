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
	]
});

var destination = './widgets';
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

Options:

| Name | Required | Description |
| ---- | -------- | ----------- |
| `template` | Yes | Path to the template file/folder |
| `placeholders` | No | Array of [inquirer](https://www.npmjs.com/package/inquirer) prompts used to inject data into templates |

Returns:

- `function(destination, [context])`

 	Factory function used to create instances of the template
	- `destination`: Destination directory for output files
	- `context`: Preset template placeholder values

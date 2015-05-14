# factory

> Quick and easy template scaffolding


## Installation

```bash
npm install factory
```


## Usage

```javascript
var factory = require('factory');

var widgetFactory = factory({
	template: 'templates/widget',
	options: [
		{
			name: 'foo',
			type: 'input'
		},
		{
			name: 'bar',
			type: 'input'
		}
	]
});

var destination = './widgets';
var config = {
	foo: 'baz'
};
widgetFactory(destination, config, function(error, callback) {
	if (error) {
		console.error('Widget creation failed: ' + error);
	} else {
		console.info('Widget created successfully');
	}
})
```

## How it works

- The `factory()` function takes two arguments:
	- `template`: path to the template directory
	- `options`: array of [inquirer](https://www.npmjs.com/package/inquirer) prompts to gather template data
- You can then call the function that is returned, specifying a `destination` path and optionally passing in a key/value object containing template configuration variables
- The user is prompted for the value of any options which are not already present in the template configuration object
- The files are copied from the `template` path to the `destination`, replacing any placeholders in filenames and file content with the supplied configuration values (using [lodash template](https://www.npmjs.com/package/lodash.template) syntax)

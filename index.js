'use strict';

var fs = require('fs');
var Transform = require('stream').Transform;
var Promise = require('promise');
var errno = require('errno');
var extend = require('extend');
var inquirer = require('inquirer');
var istextorbinary = require('istextorbinary');
var copy = require('recursive-copy');
var template = require('lodash.template');

module.exports = function(options) {
	options = options || {};
	var templatePath = options.template || null;
	var templatePlaceholders = options.placeholders || [];

	return function(options, context, callback) {
		if ((arguments.length === 2) && (typeof context === 'function')) {
			callback = context;
			context = undefined;
		}
		if (typeof options === 'string') {
			options = {
				destination: options
			};
		}
		context = context || {};
		options = options || {};
		return parseOptions(context, templatePlaceholders)
			.then(function(context) {
				var source = templatePath;
				var destination = options.destination;
				var isValidSource = (typeof source === 'string');
				if (!isValidSource) {
					return Promise.reject(fsError('ENOENT', source));
				}
				var isValidDestination = (typeof destination === 'string');
				if (!isValidDestination) {
					return Promise.reject(fsError('ENOENT', destination));
				}
				return ensureValidSource(source)
					.then(function() {
						return copyDirectory(source, destination, context, options);
					});
			})
			.nodeify(callback);
	};
};

function parseOptions(context, placeholders) {
	return new Promise(function(resolve, reject) {
		var prompts = placeholders.filter(function(option) {
			var optionName = option.name;
			return !context.hasOwnProperty(optionName);
		});

		if (prompts.length === 0) {
			return resolve(context);
		}

		inquirer.prompt(prompts, function(answers) {
			context = extend(context, answers);
			return resolve(context);
		});
	});
}

function ensureValidSource(path) {
	return new Promise(function(resolve, reject) {
		fs.stat(path, function(error, stats) {
			if (error) {
				return reject(error);
			}
			if (!stats.isDirectory()) {
				return reject(fsError('ENOTDIR', path));
			}
			return resolve();
		});
	});
}

function copyDirectory(source, destination, context, options) {
	return copy(source, destination, {
		overwrite: options.overwrite,
		dot: true,
		rename: function(filePath) {
			return expandPlaceholders(filePath, context);
		},
		transform: function(src, dest, stats) {
			return templateStream(src, context);
		}
	});


	function templateStream(filename, context) {
		var stream = new Transform({ decodeStrings: false, encoding: 'utf8' });
		stream._transform = function(chunk, encoding, done) {
			var isBuffer = Buffer.isBuffer(chunk);
			var isTextFile = !isBuffer || istextorbinary.isTextSync(filename, chunk);
			if (isTextFile) {
				var templateString = isBuffer ? chunk.toString() : chunk;
				var containsPlaceholders = templateString.indexOf('<%') !== -1;
				if (containsPlaceholders) {
					try {
						chunk = template(templateString)(context);
					} catch (error) {
						done(error);
					}
					encoding = 'utf8';
				}
			}
			this.push(chunk, encoding);
			done();
		};
		return stream;
	}

	function expandPlaceholders(templateString, context) {
		var containsPlaceholders = templateString.indexOf('<%') !== -1;
		if (!containsPlaceholders) { return templateString; }
		var templateFunction = template(templateString);
		return templateFunction(context);
	}
}

function fsError(code, path) {
	var errorType = errno.code[code];
	var message = errorType.code + ', ' + errorType.description + ' ' + path;
	var error = new Error(message);
	error.errno = errorType.errno;
	error.code = errorType.code;
	error.path = path;
	return error;
}

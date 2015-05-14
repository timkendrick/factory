'use strict';

var path = require('path');
var Transform = require('stream').Transform;
var cprf = require('cprf');
var extend = require('extend');
var glob = require('glob');
var inquirer = require('inquirer');
var istextorbinary = require('istextorbinary');
var template = require('lodash.template');
var pathExists = require('path-exists');
var Promise = require('promise');

module.exports = function(options) {
	var templatePath = options.template;
	var templatePlaceholders = options.placeholders || [];
	var copyOptions = options.options || {};

	return function(destination, config, callback) {
		if (!destination) {
			throw new Error('No destination path specified');
		} else if (typeof destination !== 'string') {
			throw new Error('Invalid destination path');
		}
		if ((arguments.length === 2) && (typeof config === 'function')) {
			callback = config;
			config = undefined;
		}
		config = config || {};
		return parseOptions(config, templatePlaceholders)
			.then(function(context) {
				return copyDirectory(templatePath, destination, context, copyOptions);
			}).nodeify(callback);
	};
};

function parseOptions(config, placeholders) {
	return new Promise(function(resolve, reject) {
		var prompts = placeholders.filter(function(option) {
			var optionName = option.name;
			return !config.hasOwnProperty(optionName);
		});

		if (prompts.length === 0) {
			return resolve(config);
		}

		inquirer.prompt(prompts, function(answers) {
			var context = extend(config, answers);
			return resolve(context);
		});
	});
}

function copyDirectory(source, destination, context, options) {
	return new Promise(function(resolve, reject) {
		cprf(source, destination, function(error) {
			if (error) {
				return reject(error);
			}
		}).on('copy', function(stats, src, dest, copy) {
			var transform = templateStream(src, context);
			dest = expandPlaceholders(dest, context);
			if (options.overwrite) {
				copy(src, dest, transform);
			} else {
				pathExists(dest, function(error, exists) {
					if (!exists) {
						copy(src, dest, transform);
					} else {
						throw new Error('Destination path not empty: ' + dest);
					}
				});
			}
		});
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
					chunk = template(templateString)(context);
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

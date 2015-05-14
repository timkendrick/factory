'use strict';

var path = require('path');
var Transform = require('stream').Transform;
var Promise = require('promise');
var extend = require('extend');
var glob = require('glob');
var inquirer = require('inquirer');
var ncp = require('ncp');
var template = require('lodash.template');
var istextorbinary = require('istextorbinary');

module.exports = function(options) {
	var templatePath = options.template;
	var templateOptions = options.options;

	return function(destination, config, callback) {
		return parseOptions(templateOptions, config)
			.then(function(context) {
				return copyDirectory(templatePath, destination, context);
			}).nodeify(callback);
	};
};

function parseOptions(options, config) {
	config = config || {};

	return new Promise(function(resolve, reject) {
		if (!options) {
			return resolve({});
		}

		var context = options.reduce(function(context, option) {
			var optionName = option.name;
			context[optionName] = config.hasOwnProperty(optionName) ? config[optionName] : null;
			return context;
		}, {});

		var prompts = options.filter(function(option) {
			var optionName = option.name;
			return !config.hasOwnProperty(optionName);
		});

		if (prompts.length === 0) {
			return resolve(context);
		}

		inquirer.prompt(prompts, function(answers) {
			Object.keys(answers).forEach(function(optionName) {
				context[optionName] = answers[optionName];
			});
			return resolve(context);
		});
	});
}

function copyDirectory(source, destination, context) {
	return new Promise(function(resolve, reject) {
		var ncpOptions = {
			clobber: true,
			dereference: false,
			stopOnErr: true,
			rename: function(target) {
				return expandPlaceholders(target, context);
			},
			transform: function(read, write, file) {
				read
					.pipe(templateStream(context, file.name))
					.pipe(write);
			}
		};
		ncp.limit = 16;
		ncp(source, destination, ncpOptions, function(error) {
			if (error) {
				return reject(error);
			} else {
				return resolve();
			}
		});
	});
}

function expandPlaceholders(templateString, context) {
	var containsPlaceholders = templateString.indexOf('<%') !== -1;
	if (!containsPlaceholders) { return templateString; }
	var templateFunction = template(templateString);
	return templateFunction(context);
}

function templateStream(context, filename) {
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

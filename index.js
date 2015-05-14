'use strict';

var path = require('path');
var Transform = require('stream').Transform;
var cprf = require('cprf');
var extend = require('extend');
var glob = require('glob');
var inquirer = require('inquirer');
var istextorbinary = require('istextorbinary');
var template = require('lodash.template');
var Promise = require('promise');

module.exports = function(options) {
	var templatePath = options.template;
	var templatePlaceholders = options.placeholders;

	return function(destination, config, callback) {
		return parseOptions(config, templatePlaceholders)
			.then(function(context) {
				return copyDirectory(templatePath, destination, context);
			}).nodeify(callback);
	};
};

function parseOptions(config, placeholders) {
	config = config || {};
	placeholders = placeholders || [];

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

function copyDirectory(source, destination, context) {
	return new Promise(function(resolve, reject) {
		cprf(source, destination, function(error) {
			if (error) {
				return reject(error);
			}
		}).on('copy', function(stats, src, dest, copy) {
			var transform = templateStream(src, context);
			dest = expandPlaceholders(dest, context);
			copy(src, dest, transform);
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

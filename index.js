'use strict';

var Transform = require('stream').Transform;
var fs = require('fs');
var path = require('path');
var Promise = require('promise');
var cprf = require('cprf');
var errno = require('errno');
var extend = require('extend');
var inquirer = require('inquirer');
var istextorbinary = require('istextorbinary');
var junk = require('junk');
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
		return processTemplate(options, context)
			.nodeify(callback);
	};


	function processTemplate(options, context) {
		return parseOptions(context, templatePlaceholders)
			.then(function(context) {
				var destination = options.destination;
				var isValidDestination = (typeof destination === 'string');
				if (!isValidDestination) {
					return Promise.reject(fsError('ENOENT', destination));
				}
				return copyDirectory(templatePath, destination, context, options);
			});
	}
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

function copyDirectory(source, destination, context, options) {
	return ensureValidSource(source)
		.then(function() {
			return copyFiles(source, destination, context, options);
		});


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

	function copyFiles(source, destination, context, options) {
		return new Promise(function(resolve, reject) {
			var copiedFiles = [];
			cprf(source, destination, function(error) {
				if (error) {
					return reject(error);
				}
				return resolve(copiedFiles);
			}).on('copy', function(srcStats, src, dest, copy) {
				var filename = path.basename(src);
				var isJunkFile = junk.is(filename);
				if (isJunkFile) { return; }
				try {
					dest = expandPlaceholders(dest, context);
				} catch (error) {
					return reject(error);
				}
				if (options.overwrite) {
					copyFile(src, dest, srcStats);
				} else {
					fs.stat(dest, function(error, destStats) {
						if (error && error.code !== 'ENOENT') {
							return reject(error);
						}
						if (destStats && (!srcStats.isDirectory() || !destStats.isDirectory())) {
							return reject(fsError('EEXIST', destination));
						}
						copyFile(src, dest, srcStats);
					});
				}


				function copyFile(src, dest, stats) {
					var transform = templateStream(src, context);
					transform.on('error', function(error) {
						return reject(error);
					});
					copy(src, dest, transform);
					copiedFiles.push({
						src: src,
						dest: dest,
						stats: stats
					});
				}
			});
		});
	}

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
	var cause = extend({}, errorType, {
		path: path,
		message: errorType.code + ', ' + errorType.description + ' ' + path
	});
	return new errno.custom.FilesystemError(cause);
}

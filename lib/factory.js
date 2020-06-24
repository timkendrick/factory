'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var Transform = require('stream').Transform;
var Promise = require('promise');
var emitterMixin = require('emitter-mixin');
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
	var contextTransformFn = options.getContext || function(context) { return context; };


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

		var emitter;
		var promise = parseOptions(context, templatePlaceholders)
			.then(function(context) {
				return contextTransformFn(context);
			})
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
						return copyDirectory(source, destination, context, options, emitter);
					});
			});

		if (typeof callback === 'function') {
			promise.nodeify(callback);
			emitter = new EventEmitter();
		} else {
			emitter = emitterMixin(promise);
		}

		return emitter;
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

	function copyDirectory(source, destination, context, options, emitter) {
		var copier = copy(source, destination, {
			overwrite: options.overwrite,
			dot: true,
			rename: function(filePath) {
				return expandPlaceholders(filePath, context);
			},
			transform: function(src, dest, stats) {
				return templateStream(src, context);
			}
		});
		return addEventListeners(copier, emitter);


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
							encoding = 'utf8';
						} catch (error) {
							done(error);
							return;
						}
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

		function addEventListeners(copier, emitter) {
			var eventNames = Object.keys(copy.events).map(function(key) {
				return copy.events[key];
			});
			eventNames.forEach(function(eventName) {
				var listener = createEventListener(eventName);
				copier.on(eventName, listener);
			});
			return copier;


			function createEventListener(eventName) {
				return function(args) {
					var eventArguments = Array.prototype.slice.call(arguments);
					emitter.emit.apply(emitter, [eventName].concat(eventArguments));
				};
			}
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
};

module.exports.events = copy.events;

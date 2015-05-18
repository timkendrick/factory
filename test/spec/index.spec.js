'use strict';

var fs = require('fs');
var path = require('path');
var chai = require('chai');
var expect = chai.expect;
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var rewire = require('rewire');
var del = require('del');
var Promise = require('promise');
var readDirFiles = require('read-dir-files');
var emitterMixin = require('emitter-mixin');

var factory = rewire('../../index');

var TEMPLATES_PATH = path.resolve(__dirname, '../fixtures/templates');
var OUTPUT_DIR = path.resolve(__dirname, '../fixtures/output');

var COPY_EVENTS = Object.keys(factory.events).map(function(key) {
	return factory.events[key];
});

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('factory()', function() {
	var mockInquirer = createMockInquirer();
	var resetInquirer;
	before(function() {
		resetInquirer = factory.__set__('inquirer', mockInquirer);
		try {
			fs.mkdirSync(OUTPUT_DIR);
		} catch (error) {
			del.sync(path.join(OUTPUT_DIR, '**/*'), {
				dot: true,
				force: true
			});
		}
	});

	afterEach(function() {
		mockInquirer.prompt.reset();
		del.sync(path.join(OUTPUT_DIR, '**/*'), {
			dot: true,
			force: true
		});
	});

	after(function() {
		resetInquirer();
		try {
			fs.rmdirSync(OUTPUT_DIR);
		} catch (error) {
			del.sync(path.join(OUTPUT_DIR, '**/*'), {
				dot: true,
				force: true
			});
		}
	});

	function getTemplatePath(template) {
		return path.join(TEMPLATES_PATH, template);
	}

	function getOutputPath(filename) {
		if (!filename) { return OUTPUT_DIR; }
		return path.join(OUTPUT_DIR, filename);
	}

	function getOutputFiles() {
		return new Promise(function(resolve, reject) {
			readDirFiles.read(OUTPUT_DIR, 'utf8', function(error, files) {
				if (error) {
					return reject(error);
				}
				return resolve(files);
			});
		});
	}

	function createMockInquirer() {
		return {
			prompt: sinon.spy(function(prompts, callback) {
				var answers = prompts.reduce(function(answers, prompt) {
					answers[prompt.name] = prompt.name;
					return answers;
				}, {});
				setTimeout(function() {
					callback(answers);
				});
			})
		};
	}

	function checkResults(results, templateName, expectedFilenames) {
		var actual, expected;
		actual = results.reduce(function(files, file) {
			files[file.src] = file.dest;
			return files;
		}, {});
		expected = [''].concat(expectedFilenames).map(function(filename) {
			return {
				src: getTemplatePath(path.join(templateName, filename)),
				dest: getOutputPath(filename)
			};
		}).reduce(function(files, file) {
			files[file.src] = file.dest;
			return files;
		}, {});
		expect(actual).to.eql(expected);

		results.forEach(function(file) {
			expected = 'function';
			actual = file.stats && file.stats.isDirectory;
			expect(actual).to.be.a(expected);
		});
	}

	function listenTo(emitter, eventNames) {
		var events = [];
		eventNames.forEach(function(eventName) {
			emitter.on(eventName, createListener(eventName));
		});
		return events;


		function createListener(eventName) {
			return function(args) {
				events.push({
					name: eventName,
					args: Array.prototype.slice.call(arguments)
				});
			};
		}
	}

	describe('basic operation', function() {

		it('should return a factory function', function() {
			var actual, expected;
			actual = factory({
				template: getTemplatePath('file')
			});
			expected = 'function';
			expect(actual).to.be.a(expected);
		});

		it('should copy single files', function() {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options)
				.then(function(results) {
					var actual, expected;
					actual = fs.readFileSync(getOutputPath('file'), 'utf8');
					expected = 'Hello, world!\n';
					expect(actual).to.equal(expected);
				});
		});

		it('should allow destination shorthand', function() {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			return templateFactory(getOutputPath())
				.then(function(results) {
					var actual, expected;
					actual = fs.readFileSync(getOutputPath('file'), 'utf8');
					expected = 'Hello, world!\n';
					expect(actual).to.equal(expected);
				});
		});

		it('should recursively copy directories', function() {
			var templateFactory = factory({
				template: getTemplatePath('directory')
			});

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options)
				.then(function(results) {
					return getOutputFiles()
						.then(function(files) {
							var actual, expected;
							actual = files;
							expected = {
								nested: {
									file1: 'Hello, world!\n',
									file2: 'Hello, world!\n'
								},
								file: 'Hello, world!\n'
							};
							expect(actual).to.eql(expected);
						});
				});
		});

		it('should return information about the copied files', function() {
			var templateFactory = factory({
				template: getTemplatePath('directory')
			});

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options)
				.then(function(results) {
					var templateName = 'directory';
					var expectedFilenames = [
						'nested',
						'nested/file1',
						'nested/file2',
						'file'
					];
					checkResults(results, templateName, expectedFilenames);
				});
		});

		it('should filter out junk files', function() {
			var templateFactory = factory({
				template: getTemplatePath('junk')
			});

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options)
				.then(function(results) {
					return getOutputFiles()
						.then(function(files) {
							var actual, expected;
							actual = files;
							expected = {
								nested: {
									'.gitignore': '!*\n'
								},
								'.gitignore': '!*\n'
							};
							expect(actual).to.eql(expected);
						});
				});
		});
	});

	describe('placeholders', function() {
		it('should replace placeholders in file contents', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-content')
			});

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options,
				{
					foo: 'foo',
					bar: 'bar'
				}
			)
				.then(function(results) {
					var actual, expected;
					actual = fs.readFileSync(getOutputPath('file'), 'utf8');
					expected = 'foobar\n';
					expect(actual).to.equal(expected);
				});
		});

		it('should replace placeholders in filenames', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-filename')
			});

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options,
				{
					foo: 'foo',
					bar: 'bar'
				}
			)
				.then(function(results) {
					return getOutputFiles()
						.then(function(files) {
							var actual, expected;
							actual = files;
							expected = {
								foobar: 'foobar\n'
							};
							expect(actual).to.eql(expected);
						});
				});
		});

		it('should replace placeholders in nested paths', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-nested')
			});

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options,
				{
					foo: 'foo',
					bar: 'bar'
				}
			)
				.then(function(results) {
					return getOutputFiles()
						.then(function(files) {
							var actual, expected;
							actual = files;
							expected = {
								foo: {
									bar: 'foobar\n'
								},
								file: 'Hello, world!\n'
							};
							expect(actual).to.eql(expected);
						});
				});
		});

		it('should throw an error on undefined file contents placeholders', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-content')
			});

			var actual, expected;
			var options = {
				destination: getOutputPath()
			};
			var context = {
				foo: 'foo'
			};
			actual = templateFactory(options, context);
			expected = ReferenceError;
			return expect(actual).to.be.rejectedWith(expected);
		});

		it('should throw an error on undefined filename placeholders', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-filename')
			});

			var actual, expected;
			var options = {
				destination: getOutputPath()
			};
			var context = {
				foo: 'foo'
			};
			actual = templateFactory(options, context);
			expected = ReferenceError;
			return expect(actual).to.be.rejectedWith(expected);
		});
	});

	describe('overwriting', function() {

		it('should throw an error if a clashing destination path exists', function() {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			fs.writeFileSync(getOutputPath('file'), '');

			var actual, expected;
			var options = {
				destination: getOutputPath()
			};
			actual = templateFactory(options);
			expected = 'EEXIST';
			return expect(actual).to.be.rejectedWith(expected);
		});

		it('should not throw an error if a non-clashing destination path exists', function() {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			fs.writeFileSync(getOutputPath('file2'), '');

			var options = {
				destination: getOutputPath()
			};
			return templateFactory(options)
				.then(function() {
					return getOutputFiles()
						.then(function(files) {
							var actual, expected;
							actual = files;
							expected = {
								file: 'Hello, world!\n',
								file2: ''
							};
							expect(actual).to.eql(expected);
						});
				});
		});

		it('should overwrite files when the destination path exists and overwrite is enabled', function() {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			fs.writeFileSync(getOutputPath('file'), '');

			var options = {
				destination: getOutputPath(),
				overwrite: true
			};
			return templateFactory(options)
				.then(function() {
					return getOutputFiles()
						.then(function(files) {
							var actual, expected;
							actual = files;
							expected = {
								file: 'Hello, world!\n'
							};
							expect(actual).to.eql(expected);
						});
				});
		});
	});

	describe('prompts', function() {
		it('should prompt for placeholders which have not been provided', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-content'),
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
				destination: getOutputPath()
			};
			var context = {
				foo: 'foo'
			};
			return templateFactory(options, context)
				.then(function(results) {
					var actual, expected;
					actual = fs.readFileSync(getOutputPath('file'), 'utf8');
					expected = 'foobar\n';
					expect(actual).to.equal(expected);

					expect(mockInquirer.prompt).to.have.been.calledWith(
						[
							{
								name: 'bar',
								type: 'input',
								message: 'Enter a value for bar'
							}
						]
					);
				});
		});

		it('should prompt for all placeholders if none have been provided', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-content'),
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
				destination: getOutputPath()
			};
			return templateFactory(options)
				.then(function(results) {
					var actual, expected;
					actual = fs.readFileSync(getOutputPath('file'), 'utf8');
					expected = 'foobar\n';
					expect(actual).to.equal(expected);

					expect(mockInquirer.prompt).to.have.been.calledWith(
						[
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
					);
				});
		});

		it('should not prompt for placeholders if all have been provided', function() {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-content'),
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
				destination: getOutputPath()
			};
			var context = {
				foo: 'foo',
				bar: 'bar'
			};
			return templateFactory(options, context)
				.then(function(results) {
					var actual, expected;
					actual = fs.readFileSync(getOutputPath('file'), 'utf8');
					expected = 'foobar\n';
					expect(actual).to.equal(expected);

					expect(mockInquirer.prompt).not.to.have.been.called;
				});
		});
	});

	describe('argument validation', function() {

		it('should throw an error if an invalid source path is specified', function() {
			var templateFactory = factory({
				template: getTemplatePath('invalid')
			});

			var actual, expected;
			var options = {
				destination: getOutputPath()
			};
			actual = templateFactory(options);
			expected = 'ENOTDIR';
			return expect(actual).to.be.rejectedWith(expected);
		});

		it('should throw an error if an invalid destination path is specified', function() {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			var actual, expected;
			actual = [
				templateFactory(),
				templateFactory({}),
				templateFactory({ destination: undefined }),
				templateFactory({ destination: null }),
				templateFactory({ destination: false }),
				templateFactory({ destination: {} }),
				templateFactory({ destination: [] })
			];
			expected = 'ENOENT';
			return Promise.all(actual.map(function(actual) {
				return expect(actual).to.be.rejectedWith(expected);
			}));
		});

		it('should throw an error if the source path does not exist', function() {
			var templateFactory = factory({
				template: getTemplatePath('nonexistent')
			});

			var actual, expected;
			var options = {
				destination: getOutputPath()
			};
			actual = templateFactory(options);
			expected = 'ENOENT';
			return expect(actual).to.be.rejectedWith(expected);
		});
	});

	describe('callbacks', function() {
		it('should call the callback on success (without context or options)', function(done) {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			var options = {
				destination: getOutputPath()
			};
			templateFactory(options, function(error, results) {
				expect(results).to.exist;
				expect(error).not.to.exist;

				var templateName = 'file';
				var expectedFilenames = [
					'file'
				];
				checkResults(results, templateName, expectedFilenames);

				var actual, expected;
				actual = fs.readFileSync(getOutputPath('file'), 'utf8');
				expected = 'Hello, world!\n';
				expect(actual).to.equal(expected);

				done();
			});
		});

		it('should call the callback on failure (without context or options)', function(done) {
			var templateFactory = factory({
				template: getTemplatePath('nonexistent')
			});

			var options = {
				destination: getOutputPath()
			};
			templateFactory(options, function(error, results) {
				expect(error).to.exist;
				expect(results).not.to.exist;

				var actual, expected;
				actual = function() { throw error; };
				expected = 'ENOENT';
				expect(actual).to.throw(expected);

				done();
			});
		});

		it('should call the callback on success (with context, without options)', function(done) {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-content')
			});


			var options = {
				destination: getOutputPath()
			};
			var context = {
				foo: 'foo',
				bar: 'bar'
			};
			templateFactory(options, context, function(error, results) {
				expect(results).to.exist;
				expect(error).not.to.exist;

				var templateName = 'placeholders-content';
				var expectedFilenames = [
					'file'
				];
				checkResults(results, templateName, expectedFilenames);

				var actual, expected;
				actual = fs.readFileSync(getOutputPath('file'), 'utf8');
				expected = 'foobar\n';
				expect(actual).to.equal(expected);

				done();
			});
		});

		it('should call the callback on failure (with context, without options)', function(done) {
			var templateFactory = factory({
				template: getTemplatePath('placeholders-content')
			});

			var options = {
				destination: getOutputPath()
			};
			var context = {
				foo: 'foo'
			};
			templateFactory(options, context, function(error, results) {
				expect(error).to.exist;
				expect(results).not.to.exist;

				var actual, expected;
				actual = function() { throw error; };
				expected = ReferenceError;
				expect(actual).to.throw(expected);

				done();
			});
		});
	});

	describe('events', function() {

		it('should export event names and values', function() {
			var actual, expected;
			actual = factory.events;
			expected = {
				ERROR: 'error',
				COMPLETE: 'complete',
				CREATE_DIRECTORY_START: 'createDirectoryStart',
				CREATE_DIRECTORY_ERROR: 'createDirectoryError',
				CREATE_DIRECTORY_COMPLETE: 'createDirectoryComplete',
				CREATE_SYMLINK_START: 'createSymlinkStart',
				CREATE_SYMLINK_ERROR: 'createSymlinkError',
				CREATE_SYMLINK_COMPLETE: 'createSymlinkComplete',
				COPY_FILE_START: 'copyFileStart',
				COPY_FILE_ERROR: 'copyFileError',
				COPY_FILE_COMPLETE: 'copyFileComplete'
			};
			expect(actual).to.eql(expected);
		});

		it('should relay copy events', function() {
			var unmockCopyEvents = mockCopyEvents(factory);

			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			var options = {
				destination: getOutputPath()
			};
			var copier = templateFactory(options);
			var events = listenTo(copier, COPY_EVENTS);

			return copier.then(function() {
				var actual = events;
				var expected = [
					{ name: 'error', args: [1, 2, 3] },
					{ name: 'complete', args: [1, 2, 3] },
					{ name: 'createDirectoryStart', args: [1, 2, 3] },
					{ name: 'createDirectoryError', args: [1, 2, 3] },
					{ name: 'createDirectoryComplete', args: [1, 2, 3] },
					{ name: 'createSymlinkStart', args: [1, 2, 3] },
					{ name: 'createSymlinkError', args: [1, 2, 3] },
					{ name: 'createSymlinkComplete', args: [1, 2, 3] },
					{ name: 'copyFileStart', args: [1, 2, 3] },
					{ name: 'copyFileError', args: [1, 2, 3] },
					{ name: 'copyFileComplete', args: [1, 2, 3] }
				];
				expect(actual).to.eql(expected);
			}).finally(function() {
				unmockCopyEvents();
			});


			function mockCopyEvents(subject) {
				function copy(options, context, callback) {
					var copier = new Promise(function(resolve, reject) {
						setTimeout(function() {
							emitEvents(emitter);
							resolve([]);
						});
					});
					var emitter = emitterMixin(copier);
					return emitter;


					function emitEvents(emitter) {
						emitter.emit('error', 1, 2, 3);
						emitter.emit('complete', 1, 2, 3);
						emitter.emit('createDirectoryStart', 1, 2, 3);
						emitter.emit('createDirectoryError', 1, 2, 3);
						emitter.emit('createDirectoryComplete', 1, 2, 3);
						emitter.emit('createSymlinkStart', 1, 2, 3);
						emitter.emit('createSymlinkError', 1, 2, 3);
						emitter.emit('createSymlinkComplete', 1, 2, 3);
						emitter.emit('copyFileStart', 1, 2, 3);
						emitter.emit('copyFileError', 1, 2, 3);
						emitter.emit('copyFileComplete', 1, 2, 3);
					}
				}
				copy.events = {
					ERROR: 'error',
					COMPLETE: 'complete',
					CREATE_DIRECTORY_START: 'createDirectoryStart',
					CREATE_DIRECTORY_ERROR: 'createDirectoryError',
					CREATE_DIRECTORY_COMPLETE: 'createDirectoryComplete',
					CREATE_SYMLINK_START: 'createSymlinkStart',
					CREATE_SYMLINK_ERROR: 'createSymlinkError',
					CREATE_SYMLINK_COMPLETE: 'createSymlinkComplete',
					COPY_FILE_START: 'copyFileStart',
					COPY_FILE_ERROR: 'copyFileError',
					COPY_FILE_COMPLETE: 'copyFileComplete'
				};
				return subject.__set__('copy', copy);
			}
		});

		it('should allow event listeners to be chained', function() {
			var templateFactory = factory({
				template: getTemplatePath('file')
			});

			var options = {
				destination: getOutputPath()
			};
			var copier = templateFactory(options);

			var actual, expected;
			actual = copier.on('complete', function() {});
			expected = copier;
			expect(actual).to.equal(expected);
			return copier;
		});
	});
});

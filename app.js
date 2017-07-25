#!/usr/bin/env node


var fs = require('fs');
var Path = require('path');
var express = require('express');
var app = express();
var mkpath = require('yow').mkpath;
var server = require('http').Server(app);
var io = require('socket.io')(server);
var sprintf = require('yow').sprintf;
var isFunction = require('yow/is').isFunction;
var redirectLogs = require('yow').redirectLogs;
var prefixLogs = require('yow').prefixLogs;
var bodyParser = require('body-parser');
var cors = require('cors');
var config = require('./app.json');

var Service = function(socket, name, timeout) {

	var _this = this;

	_this.name    = name;
	_this.socket  = socket;
	_this.id      = socket.id;
	_this.timeout = timeout == undefined ? 5000 : timeout;

	console.log('New service', _this.name, _this.id);

	_this.emit = function(message, context) {
		return new Promise(function(resolve, reject) {

			var timer = setTimeout(expired, _this.timeout);

			function expired() {
				timer = undefined;
				reject(new Error(sprintf('Timeout emitting event \'%s\'', message)));
			}

			_this.socket.emit(message, context, function(data) {
				try {
					if (timer != undefined) {
						clearTimeout(timer);

						if (data.error)
							throw new Error(data.error);
						else
							resolve(data);

					}
				}
				catch(error) {
					reject(error);
				}
			});

		});
	}
};



var App = function(argv) {

	argv = parseArgs();
	var services = [];
	var serviceMap = {};

	function debug() {
		console.log.apply(this, arguments);
	}

	function parseArgs() {

		var args = require('yargs');

		args.usage('Usage: $0 [options]');
		args.help('h').alias('h', 'help');

		args.option('p', {alias:'port', describe:'Listen to specified port', default:80});
		args.option('r', {alias:'root', describe:'Specifies root path', default:'www'});

		args.wrap(null);

		args.check(function(argv) {
			return true;
		});

		return args.argv;
	}


	function run() {

		parseArgs();
		prefixLogs();

		var path = Path.resolve(argv.root);

		app.use(express.static(path));

		app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
		app.use(bodyParser.json({limit: '50mb'}));

		function emit(socket, message, context) {
			return new Promise(function(resolve, reject) {

				var timer = setTimeout(expired, 10000);

				function expired() {
					timer = undefined;
					reject(new Error(sprintf('Timeout emitting event \'%s\'', message)));
				}

				socket.emit(message, context, function(data) {
					try {
						if (timer != undefined) {
							clearTimeout(timer);

							if (data.error)
								throw new Error(data.error);
							else
								resolve(data);

						}
					}
					catch(error) {
						reject(error);
					}
				});

			});
		}


		app.post('/service/:name/:message', function(request, response) {

			try {

				var name    = request.params.name;
				var message = request.params.message;
				var context = request.body;

				console.log('Service message', message, 'to service', name, 'context', context);

				var serviceSocket = serviceMap[name];

				if (serviceSocket != undefined) {
					emit(serviceSocket, message, context).then(function(result) {
						response.status(200).json(result);
					})
					.catch(function(error) {
						response.status(401).json({error:error.message});
					});

				}
				else
					throw Error('Service not found');

			}
			catch(error) {
				console.log('Posting failed', error);
				response.status(401).json({error:error.message});

			}
		});


		app.post('/broadcast/:room/:message', function(request, response) {

			try {
				var room    = request.params.room;
				var message = request.params.message;
				var context = request.body;

				console.log('Posting message', message, 'to room', room, 'context', context);

				io.sockets.to(room).emit(message, context);
				response.status(200).json({status:'OK'});

			}
			catch(error) {
				console.log('Posting failed', error);
				response.status(401).json({error:error.message});

			}
		});

		function registerService(provider, consumer, methods, events) {

			var providerNamespace = io.of('/' + provider);
			var consumerNamespace = io.of('/' + consumer);

			providerNamespace.removeAllListeners();
			consumerNamespace.removeAllListeners();

			providerNamespace.on('connection', function(socket) {
				console.log('New provider socket connection', socket.id);


				debug('Service %s connected...', provider);
				serviceMap[provider] = socket;

				socket.on('disconnect', function() {
					debug('Service %s disconnected.', provider);
					delete serviceMap[provider];
				});

				events.forEach(function(event) {
					console.log('Defining event \'%s::%s\'.', provider, event);

					socket.on(event, function(params) {
						consumerNamespace.emit(event, params);
					});

				});

			});

			consumerNamespace.on('connection', function(socket) {
				console.log('New consumer socket connection', socket.id);

				methods.forEach(function(method) {
					console.log('Defining method \'%s::%s\'.', consumer, method);

					socket.on(method, function(params, fn) {

						var providerSocket = serviceMap[provider];

						if (providerSocket != undefined) {
							emit(providerSocket, method, params).then(function(reply) {
								if (isFunction(fn))
									fn(reply);
							})
							.catch(function(error) {
								console.log(error);

								if (isFunction(fn))
									fn({error:error.message});
							});

						}
						else {
							console.log('Service', provider, 'not found.');

							if (isFunction(fn))
								fn({error:sprintf('Service %s not found.', provider)});

						}

					});


				});

			});

		}


		io.of('/services').on('connection', function(socket) {

			console.log('Service connection!');

			socket.on('register-service', function(provider, consumer, methods, events) {
				console.log('Registerring service', provider, consumer, methods, events);
				registerService(provider, consumer, methods, events);

			});

		});

		function registerServices() {
			for (var key in config.namespaces) {
				var entry = config.namespaces[key];
				registerService(key + '-service', key, entry.methods, entry.events);
			}

		}


		server.listen(argv.port, function () {
			console.log('Root path is %s.', path);
			console.log('Listening on port %d...', argv.port);

			registerServices();

		});



	}

	run();
};


new App();

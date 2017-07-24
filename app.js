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



		app.post('/service/:name/:message', function(request, response) {

			try {

				var name    = request.params.name;
				var message = request.params.message;
				var context = request.body;

				console.log('Service message', message, 'to service', name, 'context', context);

				var service = services.find(function(service) {
					return service.name == name;
				});

				if (service) {
					service.emit(message, context).then(function(result) {
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




		io.of('/services').on('connection', function (socket) {


			function findService(name) {
				var service = services.find(function(service) {
					return service.name == name;
				});

				return service;
			}

			console.log('Service connection from', socket.id);

			socket.on('disconnect', function() {
				debug('Disconnect from socket', socket.id);

				var service = services.find(function(service) {
					return service.id == socket.id;
				});

				//debug('Removing all event listeners from socket');
				//service.socket.removeAllListeners();

				//debug('Removing all event listeners from namespace', service.name);
				//io.of('/' + service.name).removeAllListeners();

				services = services.filter(function(service) {
					return service.id != socket.id;
				});

				debug('Number of current active services:', services.length);
			});


			socket.on('notify', function(message, data) {

				var service = services.find(function(service) {
					return service.id == socket.id;
				});

				if (service != undefined) {
					io.of('/' + service.name).emit(message, data);
				}
			});

			socket.on('service', function(name, methods, options) {
				debug('Socket', socket.id, 'registerred service', name);

				var service = new Service(socket, name, options.timeout);

				services = services.filter(function(service) {
					return service.id != socket.id;
				});

				services.push(service);

				var serviceName = service.name;
				var namespace = io.of('/' + serviceName);

				namespace.on('connection', function(socket) {
					methods.forEach(function(method) {

						socket.on('disconnect', function() {
						});

						socket.on('disconnecting', function() {
						});

						socket.on(method, function(params, fn) {

							var service = findService(serviceName);

							if (service != undefined) {

								service.emit(method, params).then(function(reply) {
									if (isFunction(fn))
										fn(reply);
								})
								.catch(function(error) {
									console.log(error);

									if (isFunction(fn))
										fn({error:error.message});
								})
							}
							else {
								if (isFunction(fn))
									fn({error:'Service no longer available'});

							}

						});
					});
				});

				debug('Number of current active services:', services.length);
			});



		});
/*
		io.of('/foobar').on('connection', function (socket) {


			console.log('SocketIO (namespace) connection from', socket.id, socket.nsp.name);

			socket.emit('hello', {});

			socket.on('disconnect', function() {
				console.log('Disconnect from socket', socket.id);

				services = services.filter(function(service) {
					return service.id != socket.id;
				});

				console.log('Service count', services.length);
			});


			socket.on('join', function(room) {
				console.log('Socket', socket.id, 'joined room', room);
				socket.join(room);
			});

			socket.on('leave', function(room) {
				console.log('Socket', socket.id, 'left room', room);
				socket.leave(room);
			});

			socket.on('broadcast', function(room, message, data) {
				console.log('Broadcast message', room, message, data);

				socket.to(room).emit(message, data);
			});

			socket.on('service', function(data) {
				console.log('Socket', socket.id, 'registerred service', data.name);

				var service = new Service(socket, data.name, data.timeout);

				services = services.filter(function(service) {
					return service.id != socket.id;
				});

				services.push(service);
				console.log('Service count', services.length);
			});


			socket.on('invoke', function(name, message, data, fn) {

				console.log('Invoking service', name, message, data);

				var service = services.find(function(service) {
					return service.name == name;
				});

				if (service != undefined) {
					service.emit(message, data).then(function(data) {
						if (isFunction(fn))
							fn(data);
					})
					.catch(function(error) {
						console.log(error);

						if (isFunction(fn))
							fn({error:error.message});
					})
				}
				else {
					fn({error:'Service not found'});
					console.log('Service', name, 'not found');
				}
			});

		});
*/

		server.listen(argv.port, function () {
			console.log('Root path is %s.', path);
			console.log('Listening on port %d...', argv.port);

		});


	}

	run();
};


new App();

#!/usr/bin/env node


var fs = require('fs');
var Path = require('path');
var express = require('express');
var app = express();
var mkpath = require('yow').mkpath;
var server = require('http').Server(app);
var io = require('socket.io')(server);
var sprintf = require('yow').sprintf;
var redirectLogs = require('yow').redirectLogs;
var prefixLogs = require('yow').prefixLogs;
var bodyParser = require('body-parser');
var cors = require('cors');

var App = function(argv) {

	argv = parseArgs();

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

	function emit(socket, message, context) {
		return new Promise(function(resolve, reject) {

			var timer = setTimeout(timeout, 5000);

			function timeout() {
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

	function run() {

		parseArgs();
		prefixLogs();

		var path = Path.resolve(argv.root);
		var services = [];

		app.use(express.static(path));

		app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
		app.use(bodyParser.json({limit: '50mb'}));

		app.post('/sockets/to/:room/emit/:message', function(request, response) {

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

		app.post('/service/:room/:message', function(request, response) {

			try {
				var room    = request.params.room;
				var message = request.params.message;
				var context = request.body;



				console.log('Service message', message, 'to room', room, 'context', context);

				io.sockets.in(room).clients(function(error, clients) {
					var socket = io.sockets.connected[clients[0]];

					if (socket != undefined) {

						emit(socket, message, context).then(function(result) {
							response.status(200).json(result);
						})
						.catch(function(error) {
							response.status(401).json({error:error.message});
						});

					}
				});


			}
			catch(error) {
				console.log('Posting failed', error);
				response.status(401).json({error:error.message});

			}
		});

		app.post('/services/:name/:message', function(request, response) {

			try {
				var name    = request.params.room;
				var message = request.params.message;
				var context = request.body;

				console.log('Service message', message, 'to service', name, 'context', context);

				var service = services.find(function(service) {
					service.name == name;
				});

				if (service) {
					emit(service.socket, message, context).then(function(result) {
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


		io.on('connection', function (socket) {


			console.log('SocketIO connection from', socket.id);

			socket.emit('hello', {});

			socket.on('disconnect', function() {
				console.log('Disconnect from socket', socket.id);

				services = services.filter(function(service) {
					service.id != socket.id;
				});

				console.log('Service count', services.length);
			});


			socket.on('join', function(data) {
				console.log('Socket', socket.id, 'joined room', data.room);
				socket.join(data.room);
				io.in(data.room).clients(function(error, clients) {
					console.log('Clients in room', data.room, clients);
				});
			});

			socket.on('service', function(data) {
				console.log('Socket', socket.id, 'registerred service', data.name);

				var service = {};
				service.id     = socket.id;
				service.name   = data.name;
				service.socket = socket;

				services = services.filter(function(service) {
					service.id != socket.id;
				});

				services.push(service);
			});


			socket.on('leave', function(data) {
				console.log('Socket', socket.id, 'left room', data.room);
				socket.leave(data.room);
			});

			socket.on('broadcast', function(data) {
				console.log('Send message', data);

				var room    = data.room;
				var message = data.message;
				var context = data.context;

				if (data.room == undefined)
					console.log('No room specified!');
				else if (data.message == undefined)
					console.log('No message specified!');
				else {
					socket.to(room).emit(message, context);
				}
			});
		});

		server.listen(argv.port, function () {
			console.log('Root path is %s.', path);
			console.log('Listening on port %d...', argv.port);

		});


	}

	run();
};


new App();

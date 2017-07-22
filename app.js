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


	function run() {

		parseArgs();
		prefixLogs();

		var path = Path.resolve(argv.root);

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

		io.on('connection', function (socket) {

			console.log('SocketIO connection from', socket.id);

			socket.emit('hello', {});

			socket.on('disconnect', function() {
				console.log('Disconnect from socket', socket.id);
			});

			socket.on('join', function(data) {
				console.log('Socket', socket.id, 'joined room', data.room);
				socket.join(data.room);
			});

			socket.on('leave', function(data) {
				console.log('Socket', socket.id, 'left room', data.room);
				socket.leave(data.room);
			});

			socket.on('message', function(data) {
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

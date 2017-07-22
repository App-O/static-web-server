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

		io.on('connection', function (socket) {

			console.log('SocketIO connection!');
			
			socket.emit('hello', {});

			socket.on('join', function(data) {
				console.log('Join message', data);
				socket.join(data.room);
			});

			socket.on('leave', function(data) {
				console.log('Leave message', data);
				socket.leave(data.room);
			});

			socket.on('broadcast', function(data) {
				console.log('Broadcast message', data);

				if (data.room == undefined)
					console.log('No room specified!');
				else if (data.event == undefined)
					console.log('No event specified!');
				else if (data.data == undefined)
					console.log('No data specified!');
				else {
					socket.to(data.room).emit(data.event, data.data);
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

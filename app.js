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


var cmd = require('commander');


cmd.version('1.0.0');
cmd.option('-l --log <filename>', 'redirect logs to file');
cmd.option('-p --port <port>', 'listens to specified port', 80);
cmd.option('-r --root <dir>', 'specifies root path', '~/www');
cmd.parse(process.argv);

prefixLogs();

if (cmd.log)
	redirectLogs(cmd.log);

app.use(express.static(cmd.root));
/*
function setupStatics() {
	var path = Path.join(__dirname, 'www');

	app.get('/',function(req,res) {
	    res.redirect('/app-o');
	});


	mkpath(path);

	fs.readdirSync(path).forEach(function(file) {
		var fileName = Path.join(path, file);
		var stats = fs.statSync(fileName);

		if (stats.isDirectory()) {
			app.use('/' + file, express.static(Path.join(path, file)));
		};
	});
}

setupStatics();
*/
/*
io.on('connection', function (socket) {
	console.log('connection!');
	socket.emit('hello', { hello: 'world' });

	socket.on('join', function (data) {
    	console.log('join', data);

		if (data.room)
			socket.join(data.room);
	});
});
*/

server.listen(cmd.port, function () {
console.log('Root path is %s.', cmd.root);
  console.log('Listening on port %d...', cmd.port);
});

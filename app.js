


var fs = require('fs');
var Path = require('path');
var express = require('express');
var app = express();
var mkpath = require('yow').mkpath;
var server = require('http').Server(app);
var io = require('socket.io')(server);




function setupStatics() {
	var path = Path.join(__dirname, 'www');

	app.use('/', express.static(Path.join(path, 'app-o.se')));

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

io.on('connection', function (socket) {
	console.log('connection!');
	socket.emit('hello', { hello: 'world' });

	socket.on('join', function (data) {
    	console.log('join', data);

		if (data.room)
			socket.join(data.room);
	});
});

/*
app.get('*', function (req, res, next) {

	console.log(req.subdomains);
	console.log('host', req.headers.host);
	console.log('headers', req.headers);
	next();
});

*/
server.listen(80, function () {
  console.log('Listening on port 80...');
});



var io = require('socket.io-client');

var socket = io.connect('http://130.211.79.11');


socket.on('connect', function() {
	console.log('connected');

});

socket.on('hello', function(data) {
	console.log('hello');
});

socket.on('disconnect', function() {

	console.log('disconnect');
});

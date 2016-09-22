var fs = require('fs');
var Path = require('path');
var express = require('express');
var app = express();
var mkpath = require('yow').mkpath;

function setupStatics() {
	var path = Path.join(__dirname, 'www');

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

app.get('*', function (req, res, next) {

	console.log(req.subdomains);
	console.log('host', req.headers.host);
	next();
});

app.listen(80, function () {
  console.log('Listening on port 80.');
});

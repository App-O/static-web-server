#!/usr/bin/env node

require('dotenv').config();

var fs = require('fs');
var Path = require('path');
var express = require('express');
var app = express();
var sprintf = require('yow/sprintf');
var extend = require('yow/extend');
var isFunction = require('yow/is').isFunction;
var isString = require('yow/is').isString;
var redirectLogs = require('yow').redirectLogs;
var prefixLogs = require('yow').prefixLogs;
var config = require('./webserver.json');
var SocketServer = require('./socket-server.js');

function debug() {
	console.log.apply(this, arguments);
}

var App = function(argv) {



	function parseArgs() {

		var args = require('yargs');

		args.usage('Usage: $0 [options]');

		args.help('help').alias('help', 'h');
		args.option('port', {alias:'p', describe:'Listen to specified port', default:parseInt(process.env.WEBSERVER_PORT)});
		args.option('root', {alias:'r', describe:'Specifies root path', default:process.env.WEBSERVER_ROOT});

		args.wrap(null);

		args.check(function(argv) {
			return true;
		});

		return args.argv;
	}


	function run(argv) {

		var bodyParser = require('body-parser');

		prefixLogs();

		var path = Path.resolve(argv.root);

		app.use(express.static(path));

		app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
		app.use(bodyParser.json({limit: '50mb'}));

		app.get('/mysql/:database', function(request, response) {

			try {
				var MySQL = require('mysql');

				var database  = request.params.database;
				var context   = extend({}, request.body, request.query);

				function connect() {

					return new Promise(function(resolve, reject) {

						var options = {};
						options.host     = 'app-o.se';
						options.user     = context.user;
						options.password = context.password;
						options.database = database;

						var mysql = MySQL.createConnection(options);

						mysql.connect(function(error) {
							if (error) {
								reject(error);
							}
							else {
								resolve(mysql);
							}

						});
					});

				}

				function query(mysql) {

					return new Promise(function(resolve, reject) {

						var options = context.query;

						if (isString(options)) {
							options = {sql:options};
						}

						var query = mysql.query(options, function(error, results, fields) {
							if (error)
								reject(error);
							else
								resolve(results);
						});


					});
				}

				connect().then(function(mysql) {

					query(mysql).then(function(result) {
						response.status(200).json(result);
					})
					.catch(function(error) {
						response.status(401).json({error:error.message});
					})
					.then(function() {
						mysql.end();
					});
				})
				.catch(function(error) {
					response.status(401).json({error:error.message});

				})
			}
			catch(error) {
				response.status(401).json({error:error.message});

			}
		});


		var server = require('http').Server(app);


		server.listen(argv.port, function () {

			var socketServer = new SocketServer(server, app);

			console.log('Root path is %s.', path);
			console.log('Listening on port %d...', argv.port);

			socketServer.registerServices();

		});



	}

	run(parseArgs());
};


new App();

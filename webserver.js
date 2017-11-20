#!/usr/bin/env node

require('dotenv').config();

var fs = require('fs');
var Path = require('path');
var express = require('express');
var app = express();
var mkpath = require('yow').mkpath;
var server = require('http').Server(app);
var io = require('socket.io')(server);
var sprintf = require('yow/sprintf');
var extend = require('yow/extend');
var isFunction = require('yow/is').isFunction;
var isString = require('yow/is').isString;
var redirectLogs = require('yow').redirectLogs;
var prefixLogs = require('yow').prefixLogs;
var bodyParser = require('body-parser');
var cors = require('cors');
var config = require('./webserver.json');

var Service = function(socket, name, timeout) {

	var _this = this;

	_this.name    = name;
	_this.socket  = socket;
	_this.id      = socket.id;
	_this.timeout = timeout == undefined ? 5000 : timeout;

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


var Services = function() {

	var _this = this;
	var _services = [];

	_this.findByName = function(name) {
		return _services.find(function(service) {
			return service.name == name;
		});
	}

	_this.findByID = function(id) {
		return _services.find(function(service) {
			return service.id == id;
		});
	}

	_this.add = function(service) {
		_this.removeByName(service.name);
		_services.push(service);
	}

	_this.removeByName = function(name) {
		_services = _services.filter(function(service) {
			return service.name != name;
		});
	};

	_this.removeByID = function(id) {
		_services = _services.filter(function(service) {
			return service.id != id;
		});
	};



};

var App = function(argv) {

	var services = new Services();

	function debug() {
		console.log.apply(this, arguments);
	}

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



		app.post('/service/:name/:message', function(request, response) {

			try {

				var name    = request.params.name;
				var message = request.params.message;
				var context = {};

				extend(context, request.body, request.query);

				debug('Service message', message, 'to service', name, 'context', context);

				var service = services.findByName(name);

				if (service != undefined) {
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

		app.get('/service/:name/:message', function(request, response) {

			try {
				var name    = request.params.name;
				var message = request.params.message;
				var context = {};

				extend(context, request.body, request.query);

				debug('Service message', message, 'to service', name, 'context', context);

				var service = services.findByName(name);

				if (service != undefined) {
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


		function registerNeopixels() {

			var namespace = io.of('/neopixels');
			var services = new Services();

			debug('Registering neopixels service...');


			app.post('/neopixels/:name/:message', function(request, response) {

				try {

					var name    = request.params.name;
					var message = request.params.message;
					var context = {};

					extend(context, request.body, request.query);

					debug('Neopixel message', message, 'to service', name, 'context', context);

					var service = services.findByName(name);

					if (service != undefined) {
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

			namespace.on('connection', function(socket) {


				if (isString(socket.handshake.query.instance)) {
					var instanceName = socket.handshake.query.instance;
					var service = services.findByName(instanceName);

					if (service == undefined) {
						debug('************************** SERVICE NOT FOUND ************');
//						socket.disconnect();
					}
				}

				socket.on('disconnect', function() {
					debug('Service disconnected.', socket.handshake.query.instance);
					services.removeByID(socket.id);
				});


				socket.on('register', function(instanceName, methods, events) {
					methods = methods || [];
					events  = events  || [];

					debug('Neopixels provider connected...', instanceName, methods, events);


					if (instanceName == undefined)
						throw new Error('Invalid neopixels instance name');

					//var namespace = io.of(sprintf('/neopixels-%s', instanceName));
					var service = new Service(socket, instanceName, 30000);

					services.add(service);

					namespace.on('connection', function(socket) {
						debug('**************New Neopixel client connection', instanceName, socket.handshake.query.instance);
/*
						debug('**************New Neopixel client connection', instanceName, socket.handshake.query.instance);

						if (instanceName != socket.handshake.query.instance) {
							return;
						}
						var instanceName = socket.handshake.query.instance;
*/


						if (instanceName)
							socket.join(instanceName);


						events.forEach(function(event) {
							debug('Defining event \'%s::%s\'.', instanceName, event);

							socket.on(event, function(params) {
								namespace.to(instanceName).emit(event, params);
							});

						});

						methods.forEach(function(method) {
							console.log('Defining method \'%s::%s\'.', instanceName, method);

							socket.on(method, function(params, fn) {

								var service = services.findByName(instanceName);

								if (service != undefined) {
									service.emit(method, params).then(function(reply) {
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
									console.log('Instance', instanceName, 'not found.');

									if (isFunction(fn))
										fn({error:sprintf('Instance %s not found.', instanceName)});

								}

							});


						});

					});

				});



			});

		}


		function registerService(serviceName, methods, events) {

			var namespace = io.of('/' + serviceName);

			console.log('Registering service ', serviceName, ', methods: ', methods, ', events: ', events);

			namespace.on('connection', function(socket) {

				socket.on('disconnect', function() {
					services.removeByID(socket.id);
				});

				socket.on('i-am-the-provider', function() {
					debug('Service %s connected...', serviceName);
					services.add(new Service(socket, serviceName, 30000));

				});

				events.forEach(function(event) {
					debug('Defining event \'%s::%s\'.', serviceName, event);

					socket.on(event, function(params) {
						namespace.emit(event, params);
					});

				});

				methods.forEach(function(method) {
					console.log('Defining method \'%s::%s\'.', serviceName, method);

					socket.on(method, function(params, fn) {

						var service = services.findByName(serviceName);

						if (service != undefined) {
							service.emit(method, params).then(function(reply) {
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
							console.log('Service', serviceName, 'not found.');

							if (isFunction(fn))
								fn({error:sprintf('Service %s not found.', serviceName)});

						}

					});


				});


			});

		}



		function registerServices() {
			for (var key in config.namespaces) {
				var entry = config.namespaces[key];
				registerService(key, entry.methods, entry.events);
			}

		}


		server.listen(argv.port, function () {
			console.log('Root path is %s.', path);
			console.log('Listening on port %d...', argv.port);

			registerNeopixels();
			//registerServices();

		});



	}

	run(parseArgs());
};


new App();

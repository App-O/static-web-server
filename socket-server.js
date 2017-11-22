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

function debug() {
	console.log.apply(this, arguments);
}

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

module.exports = class SocketServer {


	constructor(app) {
		this.app = app;
		this.services = [];
	}


	registerServices() {

		var app = this.app;
		var services = this.services;

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

		for (var key in config.namespaces) {
			var entry = config.namespaces[key];
			registerService(key, entry.methods, entry.events);
		}

	}

	registerService(serviceName, methods, events) {

		var namespace = io.of('/' + serviceName);
		var services = this.services;

		console.log('Registering service ', serviceName, ', methods: ', methods, ', events: ', events);

		namespace.on('connection', function(socket) {

			var instance = socket.handshake.query.instance;
			var instanceName = isString(instance) ? sprintf('%s.%s', serviceName, instance) : serviceName;

			if (isString(instance)) {
				socket.join(instance);
			}

			socket.on('disconnect', function() {
				services.removeByID(socket.id);
			});

			socket.on('i-am-the-provider', function() {
				debug('Service %s connected...', instanceName);
				services.add(new Service(socket, instanceName, 30000));

			});

			events.forEach(function(event) {
				debug('Defining event \'%s::%s\'.', instanceName, event);

				if (isString(instance)) {
					socket.on(event, function(params) {
						namespace.to(instance).emit(event, params);
					});

				}
				else {
					socket.on(event, function(params) {
						namespace.emit(event, params);
					});
				}

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
						console.log('Service', instanceName, 'not found.');

						if (isFunction(fn))
							fn({error:sprintf('Service %s not found.', instanceName)});

					}

				});


			});


		});

	}


}

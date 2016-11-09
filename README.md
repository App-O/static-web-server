#WebServer

## Running with **forever**

	$ sudo forever -w start webserver.js --all

## Install with **forever-service**

	$ sudo forever-service install webserver --script webserver.js --scriptOptions " --root /home/admin/www" --start

## Removing with **forever-service**

	$ sudo forever-service delete webserver

## Controlling the service

	$ sudo service lights stop
	$ sudo service lights start

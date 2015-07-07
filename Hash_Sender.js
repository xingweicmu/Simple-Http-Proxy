var proxiedHost = 'http://127.0.0.1'

var serviceName = 'Inventory';
var requestCount=0;
var responseCount=0;
var listenPort=9999;
var firstRequest = null;

process.argv.forEach(function (val, index, array) {
  	//console.log(index + ': ' + val);
	if(index==2){
		proxiedHost=val;
	}
	if(index==3){
		serviceName = val;
	}
});

//---------------[ Parse the url to be proxied]---------------//
var parts = proxiedHost.split(':');
var hostName = '';
var portNumber = '';
if(parts.length == 2){
	hostName = parts[1].substring(2);
	portNumber = 80;
}
else if(parts.length == 3){
	hostName = parts[1].substring(2);
	portNumber = parts[2];
}

console.log('Proxying for host: '+hostName + ' on '+ portNumber);
console.log('Proxying for service: '+serviceName);

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

//---------------[ Setup Dependencies ]---------------//
var express = require('express');
var bodyParser = require("body-parser");
var http = require('http');
var path = require('path');
var os=require('os');
var fs = require('fs');
var request = require('request');
var HashMap = require('hashmap');

fs.mkdir(serviceName,function(){});

//---------------[ Create the Application ]---------------//
var proxyApp = express();
proxyApp.set('port', process.env.PORT || listenPort);
proxyApp.set('views', path.join(__dirname, 'views'));
proxyApp.set('view engine', 'ejs');
proxyApp.engine('html', require('ejs').renderFile);
proxyApp.use(express.logger('dev'));
proxyApp.use(express.json());
proxyApp.use(express.urlencoded());
proxyApp.use(express.methodOverride());
proxyApp.use(proxyApp.router);
proxyApp.use(express.static(path.join(__dirname, 'public')));
proxyApp.use(express.bodyParser());
proxyApp.use(bodyParser.urlencoded({ extended: false }));

//---------------[ Used for Development Only ]---------------//
if ('development' == proxyApp.get('env')) {
  proxyApp.use(express.errorHandler());
}
	
var requestList = null;
var map = new HashMap();
var sortMap = new HashMap();

fs.readdir(serviceName, function(err, list) {
	if (err) return console.log(err);
	requestList = list;

	// First to sort the requestList, put them in sortMap
	for (var i = 0; i < requestList.length; i++) {
		var key = requestList[i].substring(0, requestList[i].indexOf('_'));
		var value = requestList[i];
		sortMap.set(key, value);
		console.log(key + ' ' + value);
	}

	for(var i = 1; i < requestList.length; i++){
		var filePath = serviceName + '/' + sortMap.get(i+'') + '/Request';
		console.log(filePath);
	}

	// Start to send requests
	waitAndDo(1);

});


function waitAndDo(times) {
	if(times > requestList.length) {
		return;
	}

	setTimeout(function() {
		console.log('******* Doing a request on '+times+' *******');
		readAndSend(times);
		waitAndDo(times+1);

	}, 100);
}
		
// waitAndDo(1);

function readAndSend(num){
	// console.log(num);
	var filePath = serviceName + '/' + sortMap.get(num+'') + '/Request';
	fs.readFile(filePath, 'utf-8', function(err,data) {
		if (err) {
	    	return console.log(err);
	  	}

	  	firstRequest = JSON.parse(data);
	  	var readPath = firstRequest.path;
	  	var readHeaders = firstRequest.headers;
	  	var readMethod = firstRequest.method;
	  	var readBody = firstRequest.body;
	  	console.log('path: ' + readPath);
	  	console.log('method: ' + readMethod);
		console.log('headers: ' + JSON.stringify(readHeaders));
		console.log('body: '+ readBody);

		// Create a new header by removing host
		var newHeaders = {};
		for(var key in readHeaders) {
		    var value = readHeaders[key];
			//console.log('HEADER:'+key+':'+value);
			if(key != 'content-length' && key!='host'){
			// if(key != 'cookie'){
				newHeaders[key]=value;
			}
		}
		// console.log(newHeaders);
		sendRequest();
	
		// If it's GET
		function sendRequest(){
			if(readMethod == 'GET' || readMethod == 'get'){
				var options = {
					uri:proxiedHost + readPath
					, headers: newHeaders
					, jar: true
				};
		  		request(options, function (error, resp, body) {
			    	if (!error) {
			    		console.log('---------------[ Sent Request: '+readMethod + ' ' +readPath+' ]---------------');
			   			console.log('---------------[ Response from Server ]---------------');
		    			console.log(resp.body);
		       		}
					else{
						console.log('ERROR: '+error);
					}
			    });
			}	
			// If it's POST
			else if(readMethod == 'POST' || readMethod == 'post') {
				var options = {
					uri:proxiedHost + readPath
					, headers: newHeaders
					, body:readBody
					, jar: true
				};
			    request.post(options, function (error, resp, body) {
			   		if (!error) {
			   			// console.log(options);
			   			console.log('---------------[ Sent Request: '+readMethod + ' ' +readPath+']----------------');
			   			console.log('---------------[ Response from Server ]---------------');
		       			console.log(body);
		       		}
			       	else{
			       		console.log('ERROR: '+error);
			       	}
		    	});	
		    }
		    else {
		    	console.log('Unrecognized Request: '+readMethod);
		    }
		}
	});
}


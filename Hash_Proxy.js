var proxiedHost = 'http://127.0.0.1'
var serviceName = 'Inventory';
var requestCount=0;
var responseCount=0;
var listenPort=9999;

process.argv.forEach(function (val, index, array) {
	if(index==2){
		proxiedHost=val;
	}
	if(index==3){
		serviceName = val;
	}
	if(index==4){
		listenPort = val;
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

//---------------[ Create the Folder ]---------------//
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

//---------------[ Setup the Routes ]---------------//
proxyApp.get('/*', function(webRequest, response) {
	var request = require('request').debug=true;
	console.log('GET Request:'+webRequest.url);
	
	var request = require('request');
	var jar = request.jar();
	var headers = webRequest.headers;
	var currentRequestNum = requestCount;
	var data = '';

	console.log('--------------------[ simulation Request '+currentRequestNum+ ' ]---------------');
	console.log('GET Request:'+webRequest.url);
	console.log('GET Headers:'+JSON.stringify(headers));

	var currentCount = requestCount;
	console.log('###'+currentCount);

	// Create new headers based on webReqeust.headers by removing browser-based info
	var newHeaders = {};
	for(var key in webRequest.headers) {
		var value = webRequest.headers[key];
		if(key != 'content-length' && key!='host'){
			newHeaders[key]=value;
		}
	}
	console.log('Send Headers:'+JSON.stringify(newHeaders));

	function endsWith(str, suffix) {
		return str.indexOf(suffix, str.length - suffix.length) !== -1;
	}

	// Prepare file path by replacing the '/' with '!'
	var filePath = webRequest.url.replace(new RegExp('/', 'g'), '!');
	console.log('@@@'+filePath);

	// Handle text-based content
	if(!endsWith(webRequest.url, 'png') && !endsWith(webRequest.url, 'jpg') 
		&& !endsWith(webRequest.url, 'ttf') && !endsWith(webRequest.url, 'woff')){
		
		// Prepare redirecting request options
		var options = {
			uri:proxiedHost + webRequest.url, 
			// headers: newHeaders, 
			jar:true, 
		};

		request(options, function (error, resp, body) {
			if (!error) {
				console.log(webRequest.url);
				console.log(resp.body);

				// Add the count by one after receiving the response
				requestCount++;

				// rqst - the request sent to the proxy
				var rqst = {'path':webRequest.path, 'method':'get', 'headers':webRequest.headers};

				// 1. Normalize the request
				var normalized = {'path':webRequest.path, 'method':'get'};
				// var cookie = webRequest.headers['cookie'];
				// var normalized = {'path':webRequest.path, 'method':'get', 'cookie':cookie};

				// 2. Do Hash
				var hash = require('crypto').createHash('md5').update(JSON.stringify(normalized)).digest("hex");
				
				// 3. Create foldername in the format of num-hash-path
				var foldername = requestCount + '_' + hash + '_' + filePath;
				// console.log('FILE_NAME: '+foldername);
				
				// 4. Create folder
				fs.mkdir(serviceName+'/'+foldername,function(){
					
					// 5. Write to the file
					fs.writeFile(serviceName+'/'+foldername+'/Request', JSON.stringify(rqst), function(err) {
						if (err) return console.log('ERR!!!'+err);
					});
					fs.writeFile(serviceName+'/'+foldername+'/Response', body, function(err) {
						if (err) return console.log('ERR!!!'+err);
					});
					fs.writeFile(serviceName+'/'+foldername+'/ResponseHeader', JSON.stringify(resp.headers), function(err) {
						if (err) return console.log('ERR!!!'+err);
					});

					// 6. Send back the response from the server
					response.write(resp.body);
					response.end();
				});
			}
			else {
				console.log("ERROR in sending/receving the request " + webRequest.path);
			}
		});
	}
	// Handle with images or font, which requires to be encoded in binary
	else{	
		options = {
			host: hostName
			, port: portNumber
			, path: webRequest.url
			, jar:true
		}

		var request = http.get(options, function(res){
			
			var imagedata = '';
			res.setEncoding('binary');

			res.on('data', function(chunk){
			    imagedata += chunk;
			})

			res.on('end', function(){
				
				requestCount++;
				var rqst = {'path':webRequest.path, 'method':'get', 'headers':webRequest.headers};
				
				// 1. Normalize the request
				var normalized = {'path':webRequest.path, 'method':'get'};
				// var cookie = webRequest.headers['cookie'];
				// var normalized = {'path':webRequest.path, 'method':'get', 'cookie':cookie};
				
				// 2. Do Hash
				var hash = require('crypto').createHash('md5').update(JSON.stringify(normalized)).digest("hex");
				
				// 3. Create foldername in the format of num-hash-path
				var foldername = requestCount + '_' + hash + '_' + filePath;
				
				// 4. Create folder
				fs.mkdir(serviceName+'/'+foldername,function(){
					
					// 5. Write the request to file 
					fs.writeFile(serviceName+'/'+foldername+'/Request', JSON.stringify(rqst), function(err) {
						if (err) return console.log('ERR!!!'+err);
					});

					fs.writeFile(serviceName+'/'+foldername+'/Response', imagedata, 'binary', function(err){
						if (err) return console.log('ERR!!!'+err);
						console.log('File saved.')
					})

					fs.writeFile(serviceName+'/'+foldername+'/ResponseHeader', JSON.stringify(res.headers), 'binary', function(err){
						if (err) throw err
					})

					// 6. Send back the data
					response.end(imagedata, 'binary');
				});

			})

		})
	}
	console.log('--------------------[ /simulation Request '+currentRequestNum+' ]---------------');

});

proxyApp.post('/*', function(webRequest, response) {
	var request = require('request');
	var jar = request.jar();
	var headers = webRequest.headers;
	var currentRequestNum = requestCount;
	var data = '';
	var queryBody = webRequest.body;
	
	console.log('--------------------[ simulation Request '+currentRequestNum+ ' ]---------------');
	console.log('POST Request:'+webRequest.url);
	console.log('POST Headers:'+JSON.stringify(headers));

	data = JSON.stringify(queryBody);
	console.log('POST body:'+data);

	var currentCount = requestCount;

	function callback(error, cbresponse, body) {
		console.log('--------------------[ endpoint Response '+currentCount+ ' ]---------------');
		var cbheaders = cbresponse.headers;
		console.log('Headers from endpoint:'+JSON.stringify(cbheaders));
		
		var rtnHeaders = {};
		for(var key in cbheaders) {
			var value = cbheaders[key];
			if(key!='content-length'&&key!='host' && key != 'location'){
				rtnHeaders[key]=value;
			}
		}

		// IMPORTANT: the 'location' should be the host name running the proxy
		console.log('http://'+hostName+':'+listenPort+'/');
		rtnHeaders['location']='http://localhost:'+listenPort+'/';

		requestCount++;

		var filePath = webRequest.url.replace(new RegExp('/', 'g'), '!');
		var rqst = {'path':webRequest.path, 'method':'post', 'headers':webRequest.headers, 'body':data};

		// 1. Normalize the request
		var normalized = {'path':webRequest.path, 'method':'post', 'body':data};
		// 2. Do Hash
		var hash = require('crypto').createHash('md5').update(JSON.stringify(normalized)).digest("hex");
		// 3. Create foldername in the format of num-hash-path
		var foldername = requestCount + '_' + hash + '_' + filePath;
		console.log(foldername);
		// 4. Create folder
		fs.mkdir(serviceName+'/'+foldername,function(){
			// 5. Write file
			fs.writeFile(serviceName+'/'+foldername+'/Request', JSON.stringify(rqst), function(err) {
				if (err) throw err;
			});

			fs.writeFile(serviceName+'/'+foldername+'/ResponseHeader', JSON.stringify(rtnHeaders), function (err) {
				if (err) throw err;
			});

			fs.writeFile(serviceName+'/'+foldername+'/Response', body, function (err) {
				if (err) throw err;
			});

			console.log('Response Code:'+cbresponse.statusCode); // + '   Body:'+body);

			// 6. Send back the response
			response.writeHead(cbresponse.statusCode,rtnHeaders);
			response.write(body);
			response.end();
		});

		console.log('--------------------[ /endpoint Response '+currentCount+ ' ]---------------');
	};

	// Prepare new headers based on webRequest.headers
	var newHeaders = {};
	for(var key in webRequest.headers) {
		var value = webRequest.headers[key];
		//console.log('HEADER:'+key+':'+value);
		if(key!='content-length'&&key!='host'){
			newHeaders[key]=value;
		}
	}

	console.log('Send Headers:'+JSON.stringify(newHeaders));

	var options = {
		uri:proxiedHost+webRequest.url
		//, headers: {"content-type":"text/xml; charset=utf-8","soapaction":"urn:vim25/5.5","user-agent":"VMware vim-java 1.0"}
		// , headers: newHeaders
		, headers: webRequest.headers
		, jar:true
		, body:data
	};

	// Redirect the POST request
	request.post(options, callback);
	console.log('--------------------[ /simulation Request '+currentRequestNum+' ]---------------');

});

//---------------[ Start the Server ]---------------//
var server = http.createServer(proxyApp).listen(proxyApp.get('port'), function(){
	console.log('Proxy server listening on port ' + proxyApp.get('port'));
});



/*
 * Created by G on 03/02/2016.
 */


var http = require("http");
var fs = require('fs');
var jsonfile = require('jsonfile');

exports.tdxDataOpen = function (tdxId, callback) {
    var options = {
        host: 'q.nqminds.com',
        path: tdxId
    };

	http.get(options, function(res) {
        var body = [];

        res.on('data', function(chunk) {
            body.push(chunk);
        }).on('end', function() {
            body = Buffer.concat(body);

            console.log("Got data from URL");

            var dataArray = JSON.parse(body).data;

            callback(dataArray);
        });
    }).on('error', function(e) {
        console.log("Got an error: ", e);
    });
};

exports.jsonFileWrite = function (jsonArray, filePath) {
	jsonfile.writeFile(filePath, jsonArray, {spaces: 4}, function(err) {
		if (err) {console.log (err);}
	});
};

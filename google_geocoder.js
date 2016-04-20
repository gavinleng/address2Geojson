/*
 * Created by G on 03/02/2016.
 */


var argv = require("minimist")(process.argv.slice(2));
var path = require("path");
var geocoder = require('geocoder');
var fileOpen = require('./fileopen.js'); //self made module for file opening/writing
var dataConfig;

//get config
if (!argv.config) {
	console.log("no config file given");
	process.exit(-1);
} else {
	var configFile = path.resolve(argv.config);

	// Get the configuration.
	try {
		dataConfig = require(configFile);
	} catch (err) {
		console.log("failed to parse config file %s: %s", configFile, err.message);
		process.exit(-1);
	}
}

var filePath = dataConfig.outPath;

var pathToInput = './tempFile.json'; //this is an input and output file, please backup before running

var timeGap = 150; // 1 requests per 0.15 second. Users of the standard API: 2,500 free requests per day, 10 requests per second

var geoJsonFile = {"type": "FeatureCollection",
                    "features": []};
var singleData = {};

var jsonArray = []; // will contain resulting json structures

var tdxAPI = '/v1/datasets/' + dataConfig.dataID + '/data?opts={"limit":' + dataConfig.dataCount + '}';

var addressArray = dataConfig.address;

var len = addressArray.length;

var apiKey = {key: "YOUR_API_KEY"}; // please put your Google Maps Geocoding api key here

/*******
*	GOOGLE-API GEOCODER FOR BULK DATABASE
*
*	Made to run constantly and under the GOOGLE-API limit of 2500 queries/day (hence Timeout of 35.5s)
*	Backing up the written file after every 10 queries.
*	Note: no GOOGLE-API KEY needed.
*
*	Code may be run multiple times, it skips rows which are already done and begins from where it last ended.
*
*	Example of JSON structure used:
	{
		"_id": 0,
		"name": "Bellabeg Shop",
		"type": "General And Convenience Stores",
		"address": {
			"street": "Strathdon",
			"city": "Strathdon",
			"postcode": "AB36 8UL"
		},
		"coordinates": {
			"easting": "",
			"northing": "",
*ADD:		"geoCode": {
*ADD:			"lat": 57.2040739,
*ADD:			"lng": -3.070043
*ADD:		},
*ADD:		"geoStatus": "OK"
		},
		"websiteURL": "http://genepool.bio.ed.ac.uk/glenbuchat/businessesandservices.html"

*
*
*
*	Created by bartosz paszcza.
*/

var indexToBeginAt = 0; //starts from the beginning, unsurprisingly

function doNext(listIndex, jsonArray, callback) { /* for recursively going through documents in collection*/
		if (listIndex > jsonArray.length - 1)
		{
                        callback(); // if end is reached, go to final write-up
                        return 1;
		}

		console.log("now doing: %s", listIndex + 1);

		if (typeof jsonArray[listIndex].geoStatus === "undefined") { //checks whether given document was already geocoded, omits if so
			console.log("Doing new coordinates entry...");

			if (listIndex % 10 == 0) { /*this 'updates' the json file every tenth entry*/
				fileOpen.jsonFileWrite (jsonArray, pathToInput);
			}

			setTimeout(function() {
						processList(listIndex, jsonArray, callback);
			}, timeGap); //Timeout of 35.5s is imposed in order not to exceed limit of 2500queries/24h
		} else {
			console.log("Coordinates already exist for that entry, proceed to do next");
			doNext(listIndex + 1, jsonArray, callback);
		}
}

function processList(listIndex, jsonArray, callback) { /*processes a single document (singleEntry), finds its LatLong, and assigns it to the array of results (jsonArray)*/
    var singleEntry = jsonArray[listIndex];

	var addressString = "";
	for (var i = 0; i < len; i++) {
		addressString = addressString + singleEntry[addressArray[i]] + ", ";
	}

	addressString = addressString + "United Kingdom";

	var stringAddress = String(addressString);

	singleData = {"type": "Feature","properties": {}, "geometry": {"type": "Point", "coordinates": []}};
    geocoder.geocode(stringAddress, function (err, data) {
        if (data.status == "OK") {
            var loc = data.results[0].geometry.location; // obtaining the most probable location

            singleData.properties = singleEntry;
            singleData.geometry.coordinates = [loc.lng, loc.lat];

            geoJsonFile.features.push(singleData);

			singleEntry.geoStatus = data.status;
        } else {
			console.log(data.status);
			console.log("error: data status is not ok (processList)"); // usually: ZERO_RESULTS is given, indicating wrong address format
            singleEntry.geoStatus = data.status;
        }

        jsonArray[listIndex] = singleEntry; //updating results array

        doNext(listIndex + 1, jsonArray, callback);
    }, apiKey);
}

function appendGeolocation (jsonParsed){ /* final step, after going through all the documents*/
	jsonArray = jsonParsed;

	console.log("now doing: %s", indexToBeginAt + 1);
	console.log("Doing new coordinates entry...");

	processList(indexToBeginAt, jsonArray, function() {
		fileOpen.jsonFileWrite (jsonArray, pathToInput);
		fileOpen.jsonFileWrite (geoJsonFile, filePath);
        console.log("finished, " + jsonArray.length + " entries.");
});
}

fileOpen.tdxDataOpen(tdxAPI, appendGeolocation); //execute

var tickets = "ticket";
var activities = "activity";
var students = "student";
var admins = "manager";
var seats = "seat";

var redis = require('redis');

var database_config = require('../database_config.json');

exports.tickets = tickets;
exports.activities = activities;
exports.students = students;
exports.admins = admins;
exports.seats = seats;

var table = [{name: tickets, key: []},
        {name: activities, key: []},
        {name: students, key: []},
        {name: admins, key: []},
        {name: seats, key: []}];

var client;

exports.createRedisClient = function () {
    client = redis.createClient(database_config.port, database_config.address);
    client.auth(database_config.password, function() {
        console.log("auth success!");
    });

    client.on('error', function(error){
        console.log(error);
    });

    client.get("name", function(err, data) {
        console.log(data);
    });

    exports.db = client;

    exports.db[tickets].find = function(obj, callback) {

    };

    exports.db[activities].find = function(obj, callback) {};

    exports.db[students].find = function(obj, callback) {};

    exports.db[admins].find = function(obj, callback) {
        
    };

    exports.db[seats].find = function(obj, callback) {};    
};

exports.getIDClass=function(idValue)
{
    return idValue;
}
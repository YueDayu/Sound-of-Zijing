var mongojs = require('mongojs');
var redis = require('redis');
var redis_config = require('../config.json').redis_config;
var tickets = "ticket";
var activities = "activity";
var students = "student";
var admins = "manager";
var seats = "seat";


exports.tickets = tickets;
exports.activities = activities;
exports.students = students;
exports.admins = admins;
exports.seats = seats;

exports.db = mongojs('mongodb://localhost/ticket', [tickets, activities, students, admins, seats]);

var client = redis.createClient(redis_config.port, redis_config.address);

client.auth(redis_config.password, function () {
    console.log("redis auth success!");
});

client.on('error', function (error) {
    console.log(error);
});

exports.redis_db = client;

exports.getIDClass = function (idValue) {
    idValue = "" + idValue;
    return mongojs.ObjectId(idValue);
};

exports.authIP = "127.0.0.1";
exports.authPort = 9003;
exports.authPrefix = "/v1";

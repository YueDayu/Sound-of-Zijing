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

var table = [{name: tickets, key: ['stu_id', 'activity', 'unique_id']},
        {name: activities, key: ['status', 'key']},
        {name: students, key: ['weixin_id', 'status', 'stu_id']},
        {name: admins, key: ['username', 'user', 'manager', 'cashier']},
        {name: seats, key: ['activity']}];

var redis = require('./adaptor');

exports.db = redis.redis(table);

exports.getIDClass=function(idValue)
{
    return idValue;
};
var express = require('express');
var router = express.Router();
var models = require('../models/models');
var lock = require('../models/lock');

var ticket_handler = require("../weixin_handler/handler_ticket");

var cache = require('../models/ticket_cache');
var all_activity = cache.all_activity;
var current_activity = cache.current_activity;

var db = models.db;
var tickets = models.tickets;
var activities = models.activities;

router.post('/', function(req, res) {
    if (!req.body["refund_id"]) {
        res.send("refund_id is needed");
        return;
    }
    if (!req.body["stu_id"]) {
        res.send("stu_id is needed");
        return;
    }
    var refund_id = req.body["refund_id"];
    var stuID = req.body["stu_id"];
    var refund_info = ticket_handler.decode_refund_id(refund_id);

    ticket_handler.verifyActivities(refund_info.act_key, function () {
            res.send("目前没有符合要求的活动处于退票期。");
        }, function (actID, act) {
            var stu_tickets = act.user_map[stuID];
            if (!stu_tickets || stu_tickets.num == 0) {
                res.send("未找到您的抢票记录，退票失败。");
                return;
            }
            var ticket = stu_tickets.tickets[refund_info.ticket_id];
            if (!ticket) {
                res.send("您的票夹中没有这张票，退票失败。");
                return;
            }
            if (ticket.status != 1) {
                res.send(
                    "未找到您的抢票记录或您的票已经支付，退票失败。如为已支付票，请联系售票机构退还钱款后退票。");
                return;
            }
            lock.acquire('cache' + act.activity_info.key, function () {
                if (ticket.seat != "" && ticket.seat != null) {
                    act.seat_map[ticket.seat]++;
                }
                act.activity_info.remain_tickets++;
                delete stu_tickets.tickets[refund_info.ticket_id];
                stu_tickets.num--;
                res.send("退票成功。");
                lock.release('cache' + act.activity_info.key);
            });
        });
});

module.exports = router;

var express = require('express');
var router = express.Router();
var models = require('../models/models');
var lock = require('../models/lock');

var encoder = require("../weixin_handler/handler_ticket").encode_refund_id;

var cache = require('../models/ticket_cache.js');
var all_activity = cache.all_activity;
var current_activity = cache.current_activity;

var db = models.db;
var tickets = models.tickets;
var activities = models.activities;

function translateSeatNum(row, col) {
    var total;
    var result = new Object();
    switch (row) {
        case "A":
            result.r = 1;
            total = 33;
            break;
        case "B":
            result.r = 2;
            total = 35;
            break;
        case "C":
            result.r = 3;
            total = 37;
            break;
        case "D":
            result.r = 4;
            total = 39;
            break;
        case "E":
            result.r = 5;
            total = 41;
            break;
        case "F":
            result.r = 6;
            total = 41;
            break;
        case "G":
            result.r = 7;
            total = 41;
            break;
        case "H":
            result.r = 8;
            total = 41;
            break;
        default:
            result.r = -1;
            result.c = -1;
            return result;
    }

    result.c = total - parseInt(col) * 2;
    if (result.c < 0)
        result.c = -result.c + 1;

    return result;
}
function addZero(num) {
    if (num < 10)
        return "0" + num;
    return "" + num;
}
function getTime(datet, isSecond) {
    if (!(datet instanceof Date))
        datet = new Date(datet);
    datet.getMinutes()
    return datet.getFullYear() + "年"
        + (datet.getMonth() + 1) + "月"
        + (datet.getDate()) + "日 "
        + addZero(datet.getHours()) + ":"
        + addZero(datet.getMinutes())
        + (isSecond === true ? ":" + datet.getSeconds() : "");
}

//0是被人退掉的票，1是订了但未支付，2是订了且支付了，3是使用过的票，4是活动结束的票
router.get('/', function (req, res) {
    if (req.query.ticketid == null) {
        res.send("不要捣乱，要有ticket id！！");
        return;
    }
    if (req.query.actid == null) {
        res.send("不要捣乱，要有act id！！");
        return;
    }
    if (req.query.stuid == null) {
        res.send("不要捣乱，要有stu id！！");
        return;
    }
    var ticket_id = req.query.ticketid;
    var activity_id = req.query.actid;
    var student_id = req.query.stuid;

    if (all_activity[activity_id] != null) { // if in the cache.
        var act = current_activity[all_activity[activity_id].activity_key];
        if (!act || act.status < 0) {
            res.send("该票对应活动还未开始！");
        } else { // read from cache
            var activity = all_activity[activity_id];
            if (!activity.user_map[student_id]) {
                res.send("不要捣乱，你的student_id没有票！！");
                return;
            }
            var ticket_info = activity.user_map[student_id].tickets[ticket_id];
            if (!ticket_info) {
                res.send("不要捣乱，你的ticketid没有对应的票！！");
                return;
            }
            var docs1 = [activity.activity_info];
            var activityName = docs1[0].name;
            var activityPhoto = docs1[0].pic_url;
            var activityPlace = docs1[0].place;
            var tmp1 = new Date(docs1[0].start_time);
            var beginTime = getTime(tmp1);
            var tmp2 = new Date(docs1[0].end_time);
            var endTime = getTime(tmp2);
            var activityKey = docs1[0].key;

            var ticket_status;
            var ticketstatus = ticket_info.status;
            var tiSeat = ticket_info.seat;

            if (ticketstatus == 0 || ticketstatus == 99) {
                res.render("alert", {
                    errorinfo: "无效票。可能是已经退掉的票或是活动已结束而无效。",
                    backadd: null
                });
                return;
            }

            if (docs1[0].need_seat != 0 && tiSeat == "") {
                ticket_status = 1;
            } else {
                ticket_status = 2;
            }
            if (ticketstatus == 3) {
                ticket_status = 3;
            }

            if (tiSeat == "") {
                if (ticket_status == 1 && act.status >= 2) {
                    ticket_status = 2;
                    tiSeat = "您未在抢票时间内选座，系统将稍后随机分配座位";
                }
            } else {
                if (docs1[0].need_seat == 1) {
                    tiSeat = tiSeat[0] + "区";
                }
                if (docs1[0].need_seat == 2) {
                    var tres = translateSeatNum(tiSeat[0], tiSeat.substr(1));
                    if (tres.c < 10) tres.c = "0" + tres.c;
                    tiSeat = tres.r + "排" + tres.c + "座";
                }
            }
            var be = new Date(docs1[0].book_end);
            var valid_refund = (act.status == 0 || act.status == 1) ? 1 : 0;
            var refund_id = "";
            if (valid_refund == 1) {
                refund_id = encoder(activityKey, ticket_id);
            }
            res.render('checkTicket', {
                act_valid_refund: valid_refund,
                refund_id: refund_id,
                act_name: activityName,
                act_photo: activityPhoto,
                act_place: activityPlace,
                act_begintime: beginTime,
                act_endtime: endTime,
                act_key: activityKey,
                tid: req.query.ticketid,
                act_need_seat: docs1[0].need_seat,
                seat: tiSeat,
                ticket_status: ticket_status,
                ticket_price: ticket_info.cost,
                has_paid: (ticket_info.cost == 0 || ticketstatus == 2),
                act_book_end: getTime(be)
            });
        }
    } else { // if not
        db[tickets].find({unique_id: req.query.ticketid}, function (err, docs) {
            if (docs.length == 0) {
                res.send("不要捣乱，你的ticketid没有对应的票！！");
            }
            else {
                var activityid = docs[0].activity;
                var ticketstatus = docs[0].status;
                var tiSeat = docs[0].seat;

                db[activities].find({_id: activityid}, function (err, docs1) {
                    if (docs1.length == 0) {
                        res.send("您的票所对应的活动不存在！");
                    } else {
                        var activityName = docs1[0].name;
                        var activityPhoto = docs1[0].pic_url;
                        var activityPlace = docs1[0].place;
                        var tmp1 = new Date(docs1[0].start_time);
                        var beginTime = getTime(tmp1);
                        var tmp2 = new Date(docs1[0].end_time);
                        var endTime = getTime(tmp2);
                        var activityKey = docs1[0].key;

                        var ticket_status;

                        if (ticketstatus == 0 || ticketstatus == 99) {
                            res.render("alert", {
                                errorinfo: "无效票。可能是已经退掉的票或是活动已结束而无效。",
                                backadd: null
                            });
                            return;
                        }

                        if (docs1[0].need_seat != 0 && tiSeat == "") {
                            ticket_status = 1;
                        } else {
                            ticket_status = 2;
                        }
                        if (ticketstatus == 3) {
                            ticket_status = 3;
                        }

                        if (tiSeat == "") {
                            var current = (new Date()).getTime();
                            if (ticket_status == 1 && (current < docs1[0].book_start || current > docs1[0].book_end)) {
                                ticket_status = 2;
                                tiSeat = "您未在抢票时间内选座，系统将稍后随机分配座位";
                            }
                        }
                        else {
                            if (docs1[0].need_seat == 1)
                                tiSeat = tiSeat[0] + "区";
                            if (docs1[0].need_seat == 2) {
                                var tres = translateSeatNum(tiSeat[0], tiSeat.substr(1));
                                if (tres.c < 10) tres.c = "0" + tres.c;
                                tiSeat = tres.r + "排" + tres.c + "座";
                            }
                        }
                        var be = new Date(docs1[0].book_end);
                        res.render('checkTicket', {
                            act_valid_refund: 0,
                            refund_id: "",
                            act_name: activityName,
                            act_photo: activityPhoto,
                            act_place: activityPlace,
                            act_begintime: beginTime,
                            act_endtime: endTime,
                            act_key: activityKey,
                            tid: req.query.ticketid,
                            act_need_seat: docs1[0].need_seat,
                            seat: tiSeat,
                            ticket_status: ticket_status,
                            ticket_price: docs[0].cost,
                            has_paid: (docs[0].cost == 0 || ticketstatus == 2),
                            act_book_end: getTime(be)
                        });
                    }
                });
            }
        });
    }
});

module.exports = router;

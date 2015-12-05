var express = require('express');
var router = express.Router();

var model = require('../models/models');
var urls = require("../address_configure");
var ticket_cache = require('../models/ticket_cache');
var lock = require('../models/lock');

var TICKET_DB = model.tickets;
var ACTIVITY_DB = model.activities;
var SEAT_DB = model.seats;
var db = model.db;

var chooser_lock = {};

function checkValidity(req, res, callback) {
    if (req.query.ticketid == null) {
        res.send("ticketid is required!");
        return;
    }
    if (req.query.actid == null) {
        res.send("actid is required!");
        return;
    }
    if (req.query.stuid == null) {
        res.send("stuid is required!");
        return;
    }

    var activityid = req.query.actid;
    var ticketid = req.query.ticketid;
    var stuid = req.query.stuid;

    var all_activity = ticket_cache.all_activity;
    var current_activity = ticket_cache.current_activity;

    console.log(all_activity);
    console.log(activityid);
    console.log(all_activity[activityid]);
    if (all_activity[activityid] == null) {
        res.render("alert",
        {
            errorinfo: "activity not found or has expired",
            backadd: urls.ticketInfo + "?ticketid=" + ticketid
        });
        return;
    }

    var activity = all_activity[activityid];
    if (current_activity[activity.activity_key] == null) {
        res.render("alert",
        {
            errorinfo: "activity has expired",
            backadd: urls.ticketInfo + "?ticketid=" + ticketid
        });
        return;
    }
    if (current_activity[activity.activity_key].status < 0 || current_activity[activity.activity_key].status == 2) {
        res.render("alert",
        {
            errorinfo: "you cannot choose seat at this time",
            backadd: urls.ticketInfo + "?ticketid=" + ticketid
        });
        return;
    }
    if (all_activity[activityid].user_map[stuid] == undefined) {
        res.send("stuid invalid");
        return;
    }
    if (all_activity[activityid].user_map[stuid].tickets[ticketid] == undefined) {
        res.send("ticketid invalid");
        return;
    }

    var ticket = all_activity[activityid].user_map[stuid].tickets[ticketid];
    if (ticket.seat != "") {
        var tres = translateSeatNum(ticket.seat[0], ticket.seat.substr(1));
        if (tres.c < 10) tres.c = "0" + tres.c;
        res.render("alert",
            {
                errorinfo: "已经选过座位啦！座位是" + tres.r + "排" + tres.c + "座",
                backadd: urls.ticketInfo + "?ticketid=" + ticketid
            });
        return;
    }
    if (activity.activity_info.need_seat != 1) {
        res.render("alert",
            {
                errorinfo: "no need to choose area",
                backadd: urls.ticketInfo + "?ticketid=" + ticketid
            });
        return;
    }
    callback(ticketid, activityid, stuid);

/*
    if (chooser_lock[req.query.ticketid] != null) {
        res.render("alert",
            {
                errorinfo: "您的选座请求正在处理中，请稍等...",
                backadd: urls.ticketInfo + "?ticketid=" + req.query.ticketid
            });
        return;
    }
    else {
        chooser_lock[req.query.ticketid] = true;
    }
    db[TICKET_DB].find({unique_id: req.query.ticketid, status: {$ne: 0}}, function (err, docs) {
        if (docs.length == 0) {
            res.send("No such a ticket.");
            chooser_lock[req.query.ticketid] = null;
            return;
        }
        else {
            var activityid = docs[0].activity;
            if (docs[0].status != 1 && docs[0].status != 2) {
                res.send("Wrong status.");
                chooser_lock[req.query.ticketid] = null;
                return;
            }
            if (docs[0].seat != "") {
                res.render("alert",
                    {
                        errorinfo: "已经选过座位啦！座位是" + docs[0].seat,
                        backadd: urls.ticketInfo + "?ticketid=" + req.query.ticketid
                    });
                chooser_lock[req.query.ticketid] = null;
                return;
            }

            db[ACTIVITY_DB].find({_id: activityid}, function (err, docs1) {
                if (docs1.length == 0) {
                    res.send("No activity found.");
                    chooser_lock[req.query.ticketid] = null;
                    return;
                }
                else {
                    if (docs1[0].need_seat != 1) {
                        res.send("No need to choose area.");
                        chooser_lock[req.query.ticketid] = null;
                        return;
                    }
                    var current = (new Date()).getTime();
                    if (current < docs1[0].book_start || current > docs1[0].book_end) {
                        res.render("alert",
                            {
                                errorinfo: "抱歉，选座时间已过<br>请等待系统自动分配座位",
                                backadd: urls.ticketInfo + "?ticketid=" + req.query.ticketid
                            });
                        chooser_lock[req.query.ticketid] = null;
                        return;
                    }
                    callback(req.query.ticketid, activityid, docs1[0].book_end);
                }
            });
        }
    });*/
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
router.get("/", function (req, res) {
    checkValidity(req, res, function (ticketID, activityID, stuID) {
        var activity = ticket_cache.all_activity[activityID];
        var seat_map = activity.seat_map;
        var errorid = 100;
        if (req.query.err != null)
            errorid = 1;
        var inf =
        {
            tid: ticketID,
            maxTicket: activity.activity_info.max_tickets,
            bookddl: getTime(activity.book_end),
            ArestTicket: (seat_map["A_area"] == null ? 0 : seat_map["A_area"]),
            BrestTicket: (seat_map["B_area"] == null ? 0 : seat_map["B_area"]),
            CrestTicket: (seat_map["C_area"] == null ? 0 : seat_map["C_area"]),
            DrestTicket: (seat_map["D_area"] == null ? 0 : seat_map["D_area"]),
            ErestTicket: (seat_map["E_area"] == null ? 0 : seat_map["E_area"]),
            errorid: errorid
        };
/*        if (req.query.simple != null) {
            res.render("seat_simple", inf);
        }
        else {
            res.render("seat", inf);
        }*/
        res.render("seat_simple", inf);
        /*chooser_lock[req.query.ticketid] = null;
        db[SEAT_DB].find({activity: activityID}, function (err, docs) {
            if (err || docs.length == 0) {
                res.send("Error.");
                return;
            }
            var errorid = 100;
            if (req.query.err != null)
                errorid = 1;
            var inf =
            {
                tid: ticketID,
                bookddl: getTime(bookend),
                ArestTicket: (docs[0]["A_area"] == null ? 0 : docs[0]["A_area"]),
                BrestTicket: (docs[0]["B_area"] == null ? 0 : docs[0]["B_area"]),
                CrestTicket: (docs[0]["C_area"] == null ? 0 : docs[0]["C_area"]),
                DrestTicket: (docs[0]["D_area"] == null ? 0 : docs[0]["D_area"]),
                ErestTicket: (docs[0]["E_area"] == null ? 0 : docs[0]["E_area"]),
                errorid: errorid
            };
            if (req.query.simple != null) {
                res.render("seat_simple", inf);
            }
            else {
                res.render("seat", inf);
            }
        });*/
    });
});

router.post("/", function (req, res) {
    checkValidity(req, res, function (ticketID, activityID, stuID) {
        console.log(req.body);

        var realName = req.body.seat[0] + "_area";
        console.log(req.body);

        var activity = ticket_cache.all_activity[activityID];
        var ticket = activity.user_map[stuID].tickets[ticketID];
        var seat_map = activity.seat_map;

        if (seat_map[realName] <= 0) {
            if (req.query.simple != null)
                res.redirect(urls.choosearea + "?simple=1&ticketid=" + ticketID + "&actid=" + activityID + "&stuid=" + stuID + "&err=1");
            else
                res.redirect(urls.choosearea + "?ticketid=" + ticketID + "&actid=" + activityID + "&stuid=" + stuID + "&err=1");
            return;
        }

        lock.acquire('cache' + activity.activity_key, function() {
            seat_map[realName] -= 1;
            ticket.seat = realName;
            lock.release('cache' + activity.activity_key);
            res.redirect(urls.ticketInfo +"?ticketid=" + ticketID + "&actid=" + activityID + "&stuid=" + stuID + "&err=1");
        });

/*        db[SEAT_DB].update(toFind, {$inc: toModify}, {multi: false}, function (err, result) {
            if (err || result.n == 0) {
                chooser_lock[req.query.ticketid] = null;
                //WARNING!
                if (req.query.simple != null)
                    res.redirect(urls.choosearea + "?simple=1&ticketid=" + ticketID + "&err=1");
                else
                    res.redirect(urls.choosearea + "?ticketid=" + ticketID + "&err=1");
                return;
            }
            db[TICKET_DB].update({unique_id: req.query.ticketid, status: {$ne: 0}},
                {
                    $set: {seat: realName}
                }, {multi: false}, function (err, result) {
                    if (err || result.n == 0) {
                        chooser_lock[req.query.ticketid] = null;
                        //ROLL BACK, supposed never to be executed.
                        res.send("Fatal Failure!");
                        toModify[realName] = 1;
                        db[SEAT_DB].update({activity: activityID}, {$inc: toModify}, {multi: false}, function () {
                        });
                        return;
                    }
                    chooser_lock[req.query.ticketid] = null;
                    res.redirect(urls.ticketInfo + "?ticketid=" + ticketID);
                });
        });*/
    });
});

module.exports = router;

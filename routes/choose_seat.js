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

    if (all_activity[activityid] == undefined || all_activity[activityid] == null) {
        res.render("alert",
        {
            errorinfo: "activity not found or has expired",
            backadd: urls.ticketInfo + "?ticketid=" + ticketid
        });
        return;
    }

    var activity = all_activity[activityid];
    if (current_activity[activity.activity_key] == undefined || current_activity[activity.activity_key] == null) {
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
    if (activity.activity_info.need_seat != 2) {
        res.render("alert",
            {
                errorinfo: "no need to choose seat",
                backadd: urls.ticketInfo + "?ticketid=" + ticketid
            });
        return;
    }
    callback(ticketid, activityid, stuid);



/*    db[TICKET_DB].find({unique_id: req.query.ticketid, status: {$ne: 0}}, function (err, docs) {
        if (docs.length == 0) {
            res.send("No such a ticket.");
        }
        else {
            var activityid = docs[0].activity;
            if (docs[0].status != 1 && docs[0].status != 2) {
                res.send("Wrong status.");
                return;
            }
            if (docs[0].seat != "") {
                var tres = translateSeatNum(docs[0].seat[0], docs[0].seat.substr(1));
                if (tres.c < 10) tres.c = "0" + tres.c;
                res.render("alert",
                    {
                        errorinfo: "已经选过座位啦！座位是" + tres.r + "排" + tres.c + "座",
                        backadd: urls.ticketInfo + "?ticketid=" + req.query.ticketid
                    });
                return;
            }

            db[ACTIVITY_DB].find({_id: activityid}, function (err, docs1) {
                if (docs1.length == 0) {
                    res.send("No activity found.");
                }
                else {
                    if (docs1[0].need_seat != 2) {
                        res.send("No need to choose seat.");
                        return;
                    }
                    var current = (new Date()).getTime();
                    if (current < docs1[0].book_start || current > docs1[0].book_end) {
                        res.render("alert",
                            {
                                errorinfo: "抱歉，选座时间已过<br>请等待系统自动分配座位",
                                backadd: urls.ticketInfo + "?ticketid=" + req.query.ticketid
                            });
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
    datet.getMinutes();
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
        var seat_data = activity.seat_map;

        var errorid = 100;
        if (req.query.err != null)
            errorid = 1;

        var seatMap = {}, line, row;
        for (var i in seat_data) {
            if (i != "_id" && i != "activity" && i.length >= 2) {
                line = i[0] + "";
                row = i.substr(1);
                if (seatMap[line] == null)
                    seatMap[line] = [];
                if (seat_data[i] > 0)
                    seatMap[line].push(parseInt(row));
            }
        }
        var seatMap2 = [];
        var alpha = "ABCDEFGH";
        for (var i = 0; i < 8; i++) {
            if (seatMap[alpha[i]] == null)
                seatMap2[i] = [];
            else
                seatMap2[i] = seatMap[alpha[i]];
        }

        var inf =
        {
            tid: ticketID,
            bookddl: getTime(activity.book_end),
            seatMap: JSON.stringify(seatMap2),
            errorid: errorid
        };

        res.render("seat_litang", inf);
/*        db[SEAT_DB].find({activity: activityID}, function (err, docs) {
            if (err || docs.length == 0) {
                res.send("Error.");
                return;
            }
            var errorid = 100;
            if (req.query.err != null)
                errorid = 1;
            var seatMap = {}, line, row;
            for (var i in docs[0]) {
                if (i != "_id" && i != "activity" && i.length >= 2) {
                    line = i[0] + "";
                    row = i.substr(1);
                    if (seatMap[line] == null)
                        seatMap[line] = [];
                    if (docs[0][i] > 0)
                        seatMap[line].push(parseInt(row));
                }
            }
            var seatMap2 = [];
            var alpha = "ABCDEFGH";
            for (var i = 0; i < 8; i++) {
                if (seatMap[alpha[i]] == null)
                    seatMap2[i] = [];
                else
                    seatMap2[i] = seatMap[alpha[i]];
            }
            var inf =
            {
                tid: ticketID,
                bookddl: getTime(bookend),
                seatMap: JSON.stringify(seatMap2),
                errorid: errorid
            };

            res.render("seat_litang", inf);
        });*/
    });
});

router.post("/", function (req, res) {
    checkValidity(req, res, function (ticketID, activityID, stuID) {
        var realName = req.body.seat;
        console.log(realName);

        var activity = ticket_cache.all_activity[activityID];
        var ticket = activity.user_map[stuID].tickets[ticketID];

        if (activity.seat_map[realName] <= 0) {
            res.redirect(urls.chooseseat + "?ticketid=" + ticketID + "&actid=" + activityID + "&stuid=" + stuID + "&err=1");
            return 0;
        }

        lock.acquire('cache' + activity.activity_key, function() {
            activity.seat_map[realName] -= 1;
            ticket.seat = realName;
            lock.release('cache' + activity.activity_key);
            res.redirect(urls.ticketInfo + "?ticketid=" + ticketID + "&actid=" + activityID + "&stuid=" + stuID + "&err=1");
        });


/*        db[SEAT_DB].update(toFind, {$inc: toModify}, {multi: false}, function (err, result) {
            if (err || result.n == 0) {
                //WARNING!
                res.redirect(urls.chooseseat + "?ticketid=" + ticketID + "&err=1");
                return 0;
            }
            db[TICKET_DB].update({unique_id: req.query.ticketid, status: {$ne: 0}},
                {
                    $set: {seat: realName}
                }, {multi: false}, function (err, result) {
                    if (err || result.n == 0) {
                        //ROLL BACK, supposed never to be executed.
                        res.send("Fatal Failure!");
                        toModify[realName] = 1;
                        db[SEAT_DB].update({activity: activityID}, {$inc: toModify}, {multi: false}, function () {
                        });
                        return;
                    }
                    res.redirect(urls.ticketInfo + "?ticketid=" + ticketID);
                });
        });*/
    });
});

module.exports = router;

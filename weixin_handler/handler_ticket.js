var template = require('./reply_template');
var model = require('../models/models');
var lock = require('../models/lock');
var urls = require("../address_configure");
var checker = require("./checkRequest");
var basicInfo = require("../weixin_basic/settings.js");

var cache = require('../models/ticket_cache.js');
var all_activity = cache.all_activity;
var current_activity = cache.current_activity;

//Attentez: keep the activity::key unique globally.
var TICKET_DB = model.tickets;
var USER_DB = model.students;
var ACTIVITY_DB = model.activities;
//var SEAT_DB = model.seats;
var db = model.db;
var redis_db = model.redis_db;

var alphabet = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789_-()!@$^*";

var usr_lock = {};

function translateSeatNum(row, col) {
    var total;
    var result = {};
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

function verifyStudent(openID, ifFail, ifSucc) {
    redis_db.get(USER_DB + '_' + openID, function (err, res) {
        if (err || !res) {
            ifFail();
            return;
        }
        ifSucc(res);
    });
}
exports.verifyStu = verifyStudent;

function reverse(s) {
    return s.split("").reverse().join("");
}

exports.encode_refund_id = function(activity_key, ticket_id) {
    var res = activity_key + " ";
    res += reverse(ticket_id);
    return res;
};

function decode_refund_id(refund_id) {
    refund_id = refund_id.trim();
    refund_id += " end";
    var part = refund_id.split(" ", 2);
    return {
        act_key: part[0],
        ticket_id: reverse(part[1])
    }
}

function verifyActivities(actKey, ifFail, ifSucc) {
    var timer = new Date();
    var current = timer.getTime();
    var book_start = 0;
    var activity = current_activity[actKey];
    if (activity == null) {
        for (var x in all_activity) {
            if (all_activity[x].activity_key == actKey) {
                book_start = all_activity[x].book_start;
                break;
            }
        }
        if (book_start == 0) {
            ifFail();
            return;
        }
        ifFail(book_start - current);
    } else if (activity.status < 0) { // not start
        book_start = all_activity[activity.activity_id].book_start;
        ifFail(book_start - current);
    } else if (activity.status > 0) {
        ifFail();
    } else {
        ifSucc(activity.activity_id, all_activity[activity.activity_id]);
    }
}

function getRandomString(len) {
    var ret = "";
    for (var i = 0; i < len; i++)
        ret += alphabet[Math.floor(Math.random() * alphabet.length)];
    return ret;
}

function transTime(tt) {
    var res = "";
    var len = alphabet.length;
    while (tt > 0) {
        res += alphabet[tt % len];
        tt /= len;
        tt = Math.floor(tt);
    }
    return res;
}

//Attentez: this function can only be called on condition that the collection is locked.
function generateUniqueCode(stu_id, act_id, tic_index) {
    var res = "";
    res += transTime(parseInt(stu_id));
    res += (act_id.toString()).substr(14);
    res += transTime((new Date()).getTime());
    res += tic_index.toString(36);
    res += getRandomString(32 - res.length);
    return res;
}

function presentTicket(msg, res, stuID, act) {
    var user_tickets = act.user_map[stuID];
    var tmp = "恭喜，抢票成功！您现在有" + user_tickets.num + "张票:\n";
    var i = 1;
    for (var x in user_tickets.tickets) {
        if (!user_tickets.tickets[x]) {
            continue;
        }
        var seat_info = "(未选座)";
        if (user_tickets.tickets[x].seat && user_tickets.tickets[x].seat != "") {
            var seat = "";
            if (act.activity_info.need_seat == 1) {
                seat = user_tickets.tickets[x].seat[0] + "区";
            }
            if (act.activity_info.need_seat == 2) {
                var tres = translateSeatNum(user_tickets.tickets[x].seat[0], user_tickets.tickets[x].seat.substr(1));
                if (tres.c < 10) tres.c = "0" + tres.c;
                seat = tres.r + "排" + tres.c + "座";
            }
            seat_info = "(座位为" + seat + ")"
        }
        tmp += template.getHyperLink("点我查看第" + i + "张电子票" + seat_info, urls.ticketInfo + "?ticketid="
            + user_tickets.tickets[x].unique_id + "&stuid=" + stuID + "&actid=" + act.activity_info._id);
        i++;
        tmp += '\n';
    }
    if (act.activity_info.need_seat != 0)
        tmp += "注意:选座（区）将在抢票结束一小时之后截止，请尽快前往电子票选座。";
    res.send(template.getPlainTextTemplate(msg, tmp));
}

function getTimeFormat(timeInMS) {
    var sec = Math.floor(timeInMS / 1000);
    var min = Math.floor(sec / 60);
    var hou = Math.floor(min / 60);

    sec -= min * 60;
    min -= hou * 60;
    if (hou + min + sec == 0)
        return "1秒";
    return (hou > 0 ? hou + "小时" : "") + (min > 0 ? min + "分" : "") + (sec > 0 ? sec + "秒" : "");
}

function needValidateMsg(msg) {
    return template.getPlainTextTemplate(msg, '<a href="' + urls.validateAddress
        + '?openid=' + msg.FromUserName + '">请先点我绑定学号。</a>');
}

exports.check_get_ticket = function (msg) {
    if (checker.checkMenuClick(msg).substr(0, basicInfo.WEIXIN_BOOK_HEADER.length) === basicInfo.WEIXIN_BOOK_HEADER)
        return true;
    if (msg.MsgType[0] === "text")
        if (msg.Content[0] === "抢票" || msg.Content[0].substr(0, 3) === "抢票 ")
            return true;
    return false;
};

exports.faire_get_ticket = function (msg, res) {
    var actName, openID;

    if (msg.MsgType[0] === "text") {
        if (msg.Content[0] === "抢票") {
            res.send(template.getPlainTextTemplate(msg,
                "请使用“抢票 活动代称 [抢票张数（可选，阿拉伯数字）]”的命令或菜单按钮完成指定活动的抢票。"));
            return;
        } else {
            actName = msg.Content[0].substr(3);
        }
    } else {
        actName = msg.EventKey[0].substr(basicInfo.WEIXIN_BOOK_HEADER.length);
    }

    actName = actName.trim();
    var part = actName.split(" ");
    actName = part[0];
    var ticket_num = 1;
    if (part.length > 1) {
        ticket_num = parseInt(part[1]);
    }
    if (!ticket_num) {
        res.send(template.getPlainTextTemplate(msg,
            "无法解析抢票张数；请使用“抢票 活动代称 [抢票张数（可选，阿拉伯数字）]”的命令或菜单按钮完成指定活动的抢票。"));
        return;
    }

    openID = msg.FromUserName[0];
    verifyStudent(openID, function () {
        //WARNING: may change to direct user to bind
        res.send(needValidateMsg(msg));
    }, function (stuID) {
        if (usr_lock[stuID] != null) {
            res.send(template.getPlainTextTemplate(msg, "您的抢票请求正在处理中，请稍后通过查票功能查看抢票结果(/▽＼)"));
            return;
        }

        verifyActivities(actName, function (tl) {
            if (tl == null)
                res.send(template.getPlainTextTemplate(msg, "目前没有符合要求的活动处于抢票期。"));
            else
                res.send(template.getPlainTextTemplate(msg, "该活动将在" + getTimeFormat(tl) + "后开始抢票，请耐心等待！"));
        }, function (actID, staticACT) {
            if (staticACT.activity_info.remain_tickets < ticket_num) {
                res.send(template.getPlainTextTemplate(msg, "对不起，只剩下"
                    + staticACT.activity_info.remain_tickets + "张票啦\n(╯‵□′)╯︵┻━┻。"));
                return;
            }
            var user_info = staticACT.user_map[stuID];
            if (!user_info) {
                staticACT.user_map[stuID] = {
                    num: 0,
                    tickets: {}
                };
                user_info = staticACT.user_map[stuID];
            }
            if (user_info.num + ticket_num > staticACT.activity_info.max_tickets) {
                res.send(template.getPlainTextTemplate(msg,
                    "你已经有" + user_info.num + "张票啦，每个人最多" + staticACT.activity_info.max_tickets
                    + "张票哦，再抢会炸的！"));
                return;
            }
            if (usr_lock[stuID] != null) {
                res.send(template.getPlainTextTemplate(msg, "您的抢票请求正在处理中，请稍后通过查票功能查看抢票结果(/▽＼)"));
                return;
            }
            usr_lock[stuID] = true;
            lock.acquire('cache' + staticACT.activity_info.key, function () {
                for (var i = 0; i < ticket_num; i++) {
                    staticACT.activity_info.remain_tickets -= 1;
                    staticACT.user_map[stuID].num += 1;
                    var unique_tic_code = generateUniqueCode(stuID, actID, staticACT.user_map[stuID].num);
                    staticACT.user_map[stuID].tickets[unique_tic_code] = {
                        stu_id: stuID,
                        unique_id: unique_tic_code,
                        activity: actID,
                        status: 1,
                        seat: "",
                        cost: (staticACT.need_seat == 2 ? parseInt(staticACT.price) : 0)
                    };
                }
                presentTicket(msg, res, stuID, staticACT);
                usr_lock[stuID] = null;
                lock.release('cache' + staticACT.activity_info.key);
            });
        });
    });
};

//========================================
exports.check_reinburse_ticket = function (msg) {
    if (msg.MsgType[0] === "text")
        if (msg.Content[0] === "退票" || msg.Content[0].substr(0, 3) === "退票 ")
            return true;
    return false;
};

exports.faire_reinburse_ticket = function (msg, res) {
    var openID = msg.FromUserName[0];
    var refund_id = "";
    if (msg.Content[0] === "退票") {
        res.send(template.getPlainTextTemplate(msg, "请使用“退票 活动代称 代码”的命令完成指定活动的退票。"));
        return;
    } else {
        refund_id = msg.Content[0].substr(3);
    }

    var refund_info = decode_refund_id(refund_id);
    console.log(refund_info);

    verifyStudent(openID, function() {
        res.send(needValidateMsg(msg));
    }, function (stuID) {
        verifyActivities(refund_info.act_key, function () {
            res.send(template.getPlainTextTemplate(msg, "目前没有符合要求的活动处于退票期。"));
        }, function (actID, act) {
            var stu_tickets = act.user_map[stuID];
            if (!stu_tickets || stu_tickets.num == 0) {
                res.send(template.getPlainTextTemplate(msg,
                    "未找到您的抢票记录，退票失败。"));
                return;
            }
            var ticket = stu_tickets.tickets[refund_info.ticket_id];
            if (!ticket) {
                res.send(template.getPlainTextTemplate(msg,
                    "您的票夹中没有这张票，退票失败。"));
                return;
            }
            if (ticket.status != 1) {
                res.send(template.getPlainTextTemplate(msg,
                    "未找到您的抢票记录或您的票已经支付，退票失败。如为已支付票，请联系售票机构退还钱款后退票。"));
                return;
            }
            lock.acquire('cache' + act.activity_info.key, function () {
                if (ticket.seat != "" && ticket.seat != null) {
                    act.seat_map[ticket.seat]++;
                }
                act.activity_info.remain_tickets++;
                delete stu_tickets.tickets[refund_info.ticket_id];
                stu_tickets.num--;
                res.send(template.getPlainTextTemplate(msg, "退票成功。"));
                lock.release('cache' + act.activity_info.key);
            });
        });
    });
};

//========================================
exports.check_list_ticket = function (msg) {
    if (msg.MsgType[0] === "text")
        if (msg.Content[0] === "查票")
            return true;
    return (checker.checkMenuClick(msg) === basicInfo.WEIXIN_EVENT_KEYS['ticket_get']);
};

function renderTicketList(oneTicket, oneActivity, isSingle) {
    var ret = {};
    if (isSingle) {
        //Attentez: notify the user to select seat.
        ret[template.rich_attr.title] = "抢票成功！";
        ret[template.rich_attr.description] = oneActivity.name;
    } else {
        ret[template.rich_attr.title] = oneActivity.name;
    }
    ret[template.rich_attr.url] = urls.ticketInfo + "?ticketid=" + oneTicket.unique_id
        + "&stuid=" + oneTicket.stu_id + "&actid=" + oneActivity._id;
    ret[template.rich_attr.picture] = oneActivity.pic_url;
    return ret;
}

exports.faire_list_ticket = function (msg, res) {
    var openID = msg.FromUserName[0];
    verifyStudent(openID, function () {
        res.send(needValidateMsg(msg));
    }, function (stuID) {
        db[TICKET_DB].find(
            {
                stu_id: stuID,
                $or: [{status: 1}, {status: 2}]
            }, function (err, docs) {
                for (var x in current_activity) {
                    var act = current_activity[x];
                    if (!act) {
                        continue;
                    }
                    if (act.status >= 0) {
                        var activity = all_activity[act.activity_id];
                        if (activity.user_map[stuID]) {
                            for (var y in activity.user_map[stuID].tickets) {
                                docs.push(activity.user_map[stuID].tickets[y]);
                            }
                        }
                    }
                }
                if (err || docs.length == 0) {
                    res.send(template.getPlainTextTemplate(msg, "没有找到属于您的票哦，赶快去抢一张吧！"));
                    return;
                }
                var actList = [];
                var actMap = {};
                var list2Render = [];
                for (var i = 0; i < docs.length; i++) {
                    actList.push({_id: docs[i].activity});
                }
                db[ACTIVITY_DB].find(
                    {
                        $or: actList
                    }, function (err1, docs1) {
                        if (err1 || docs1.length == 0) {
                            res.send(template.getPlainTextTemplate(msg, "出错了 T T，稍后再试。"));
                            return;
                        }
                        //WARNING: what if tickets>=WEIXIN_LIMIT?
                        for (var i = 0; i < docs1.length; i++) {
                            actMap[docs1[i]._id] = docs1[i];
                        }

                        var tmpEle;
                        tmpEle = {};
                        tmpEle[template.rich_attr.title] = "\n我的票夹\n";
                        tmpEle[template.rich_attr.description] =
                            "以下列表中是您抢到的票。(如果超过9个则可能有省略)";

                        list2Render.push(tmpEle);
                        for (var i = 0; i < docs.length; i++) {
                            list2Render.push(renderTicketList(docs[i], actMap[docs[i].activity], false));
                        }
                        res.send(template.getRichTextTemplate(msg, list2Render));
                    });
            });
    });
};

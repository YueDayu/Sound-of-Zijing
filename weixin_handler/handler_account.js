var handler_ticket = require("./handler_ticket");
var template = require('./reply_template');
var urls = require("../address_configure");
var model = require('../models/models');
var lock = require('../models/lock');
var act_infoer = require("../weixin_basic/activity_info");
var checker = require("./checkRequest");
var basicInfo = require("../weixin_basic/settings.js");

//Attentez: keep the activity::key unique globally.
var TICKET_DB = model.tickets;
var USER_DB = model.students;
var ACTIVITY_DB = model.activities;
var db = model.db;
var redis_db = model.redis_db;

exports.check_bind_accout = function (msg) {
  if (msg.MsgType[0] === "text") {
    if (msg.Content[0] === "绑定") {
      return true;
    }
  }
  return checker.checkMenuClick(msg) === basicInfo.WEIXIN_EVENT_KEYS['account_bind'];
};
function sendBindInfo(msg, res, openID) {
  res.send(
    template.getPlainTextTemplate(msg, "请在绑定页面输入学生卡号以及校园账户密码以验证身份。\n"
      + template.getHyperLink("打开绑定页面", urls.validateAddress + "?openid=" + openID))
  );
}
exports.faire_bind_accout = function (msg, res) {
  var openID = msg.FromUserName[0];
  handler_ticket.verifyStu(openID, function () {
    sendBindInfo(msg, res, openID);
  }, function () {
    res.send(template.getPlainTextTemplate(msg, "该账号已经绑定，如需绑定其他学号请先解绑。"));
  });
};
//=============================================
exports.check_unbind_accout = function (msg) {
  if (msg.MsgType[0] === "text")
    if (msg.Content[0] === "解绑")
      return true;
  return checker.checkMenuClick(msg) === basicInfo.WEIXIN_EVENT_KEYS['account_unbind'];
};
exports.faire_unbind_accout = function (msg, res) {
  var openID = msg.FromUserName[0];
  handler_ticket.verifyStu(openID, function () {
    res.send(template.getPlainTextTemplate(msg, "该账号尚未绑定。"));
  }, function (stuid) {
    lock.acquire(USER_DB, function () {
      redis_db.multi()
        .del(USER_DB + '_' + openID)
        .del(USER_DB + '_r_' + stuid)
        .exec(function () {
          lock.release(USER_DB);
          res.send(template.getPlainTextTemplate(msg, "绑定已经解除。"));
        });
    });
  });
};
//=============================================
exports.check_bookable_activity = function (msg) {
  if (msg.MsgType[0] === "text")
    if (msg.Content[0] === "抢啥")
      return true;
  return checker.checkMenuClick(msg) === basicInfo.WEIXIN_EVENT_KEYS['ticket_book_what'];
};
exports.faire_bookable_activity = function (msg, res) {
  act_infoer.getCurrentActivity_EX(function (docs) {
    if (docs.length === 0) {
      res.send(template.getPlainTextTemplate(msg, "对不起，最近没有可以抢票的活动 orz..."));
      return;
    }
    var showList = [];
    var tmpEle;
    for (var i = 0; i < docs.length; i++) {
      tmpEle = {};
      tmpEle[template.rich_attr.title] = docs[i].name;
      tmpEle[template.rich_attr.description] = docs[i].description.replace(/\\n/g, "\n");
      if (tmpEle[template.rich_attr.description].length > 100) {
        tmpEle[template.rich_attr.description] = tmpEle[template.rich_attr.description].substr(0, 100);
        tmpEle[template.rich_attr.description] += "...";
      }
      tmpEle[template.rich_attr.url] = urls.activityInfo + "?actid=" + docs[i].id;
      tmpEle[template.rich_attr.picture] = docs[i].pic_url;
      showList.push(tmpEle);
    }
    res.send(template.getRichTextTemplate(msg, showList));
  });
};
//======================================
exports.check_get_help = function (msg) {
  return true;
  if (msg.MsgType[0] === "text")
    if (msg.Content[0] === "帮助")
      return true;
  if (checker.checkSubscribe(msg))
    return true;
  return false;
};
exports.faire_get_help = function (msg, res) {
  var showList = [];
  var tmpEle;
  tmpEle = {};
  tmpEle[template.rich_attr.title] = "紫荆之声-操作指南";
  tmpEle[template.rich_attr.description] =
    "刚刚关注平台不知道该做什么？抢票时间将近却不知从何入手？点这里，三步内带你抢票，分秒间玩转紫荆之声！";
  tmpEle[template.rich_attr.url] = urls.help;
  showList.push(tmpEle);

  res.send(template.getRichTextTemplate(msg, showList));
};
//============================================
var debug_mode = true;

exports.check_apply_exp = function (msg) {
  //return false;
  if (msg.MsgType[0] === "text")
    if (msg.Content[0] === "获取实验账号")
      return debug_mode;
  return false;
};

if (debug_mode) {
  var current_id = 100;
  redis_db.dbsize(function (err, data) {
    console.log('user num: ' + data);
    current_id = data + 1;
  });
}

exports.faire_apply_exp = function (msg, res) {
  if (!debug_mode) {
    res.send(template.getPlainTextTemplate(msg, "当前不是开发模式，不要捣乱！"));
    return;
  }
  var openID = msg.FromUserName[0];
  handler_ticket.verifyStu(openID, function () {
    lock.acquire(USER_DB, function () {
      redis_db.set(USER_DB + '_' + openID, current_id + "_1", function () {
        lock.release(USER_DB);
        current_id++;
        res.send(template.getPlainTextTemplate(msg, "获取实验账号成功"));
      });
    });
  }, function () {
    res.send(template.getPlainTextTemplate(msg, "该账号已经绑定。"));
  });
};

//==========================
exports.check_set_number = function (msg) {
  if (msg.MsgType[0] === "text") {
    var content = msg.Content[0].trim().split(" ")[0];
    if (content === "张数")
      return true;
  }
  return checker.checkMenuClick(msg) === basicInfo.WEIXIN_EVENT_KEYS['ticket_default_number'];
};

exports.faire_set_number = function (msg, res) {
  var openID = msg.FromUserName[0];
  handler_ticket.verifyStu(openID, function (stuID, num) {
    var ticket_number = parseInt(num);
    var set_number = 1;
    var msg_content;
    if (msg.MsgType[0] === "text") {
      msg_content = msg.Content[0];
    } else {
      msg_content = "张数";
    }
    msg_content = msg_content.trim();
    var msg_part = msg_content.split(" ");
    if (msg_part.length <= 1) {
      res.send(template.getPlainTextTemplate(msg, "您现在的默认抢票张数是" + ticket_number
        + "张，回复“张数 [阿拉伯数字，大于0小于10]”来查询默认张数或者设置默认张数"));
      return;
    } else {
      set_number = parseInt(msg_part[1].trim());
    }
    if (!set_number) {
      res.send(template.getPlainTextTemplate(msg, "请输入有效的修改命令，" +
        "回复“张数 [阿拉伯数字，大于0小于10]”来查询默认张数或者设置默认张数"));
      return;
    }
    if (set_number > 9 || set_number <= 0) {
      res.send(template.getPlainTextTemplate(msg, "请设置有效范围，" +
        "回复“张数 [阿拉伯数字，大于0小于10]”来查询默认张数或者设置默认张数"));
      return;
    }
    lock.acquire(USER_DB, function () {
      redis_db.set(USER_DB + '_' + openID, current_id + "_" + set_number, function () {
        lock.release(USER_DB);
        res.send(template.getPlainTextTemplate(msg, "默认张数设置成功！"));
      });
    });
  }, function () {
    res.send(template.getPlainTextTemplate(msg, "请先进行绑定。"));
  });
};

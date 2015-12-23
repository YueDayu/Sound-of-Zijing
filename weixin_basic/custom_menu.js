var https = require('https');
var set = require('./settings');
var at = require('./access_token');
var act_info = require('./activity_info');
var ticket_cache = require('../models/ticket_cache');
var lock = require('../models/lock')
var later = require('later');

exports.createMenu = createMenu;
exports.getMenu = getMenu;
exports.deleteMenu = deleteMenu;
exports.modifyMenu = modifyMenu;
exports.autoClearOldMenus = autoClearOldMenus;
exports.setMenuTimer = setMenuTimer;
exports.menuStr = menuStr;
exports.isExit = false;

var menuStr = JSON.stringify(set.WEIXIN_COSTUM_MENU_TEMPLATE);
var menuNowUsed;

var createMenu_url = '/cgi-bin/menu/create?access_token=';
var options_creatMenu = {
    hostname: 'api.weixin.qq.com',
    port: '443',
    path: '/cgi-bin/menu/create?access_token=',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        //'Content-Length': '' + Buffer.byteLength(menuStr)
    }
};

function createMenu(access_token) {
    options_creatMenu.path = createMenu_url + access_token;

    lock.acquire('menu_api', function() {    
        var post = https.request(options_creatMenu, function (response) {
            response.on('data', function (d) {
                lock.release('menu_api');
                process.stdout.write(d);
                if (exports.isExit == true)
                    process.exit(0);
            });
        }).on('error', function (e) {
            lock.release('menu_api');
            console.log('Error while createMenu:');
            console.error(e);
        });
        post.write(menuStr);
        post.end();
    });
}

//at.getAccessToken(createMenu);

var getMenu_url = '/cgi-bin/menu/get?access_token=';
var options_getMenu = {
    hostname: 'api.weixin.qq.com',
    port: '443',
    path: '/cgi-bin/menu/get?access_token=',
    method: 'GET'
};

function getMenu(access_token) {
    options_getMenu.path = getMenu_url + access_token;

    var request = https.request(options_getMenu, function (response) {
        response.on("data", function (d) {
            process.stdout.write(d);
            var obj = JSON.parse(d);
            menuNowUsed = obj;
        });
    });

    request.end();
}
//at.getAccessToken(getMenu);

var deleteMenu_url = '/cgi-bin/menu/delete?access_token=';
var options_deleteMenu = {
    hostname: 'api.weixin.qq.com',
    port: '443',
    path: '/cgi-bin/menu/delete?access_token=',
    method: 'GET'
};

function deleteMenu(access_token) {
    options_deleteMenu.path = deleteMenu_url + access_token;

    var request = https.request(options_deleteMenu, function (response) {
        response.on("data", function (d) {
            process.stdout.write(d);
        });
    });

    request.end();
}
//at.getAccessToken(deleteMenu);


function modifyMenu(buttons) {
    if (buttons.length > 0) {
        delete set.WEIXIN_COSTUM_MENU_TEMPLATE["button"][2]["type"];
        delete set.WEIXIN_COSTUM_MENU_TEMPLATE["button"][2]["key"];
    }
    menuStr = JSON.stringify(set.getCustomMenuWithBookActs(buttons));
}

function autoClearOldMenus(activities) {
    console.log(activities);
    buttons = [];
    Obj = {};
    while (activities.length > 4) {
        earliestAct = activities[0];
        for (var i in activities) {
            act = activities[i];
            if (earliestAct.book_start > act.book_start) {
                earliestAct = act;
            }
        }
        var index = activities.indexOf(earliestAct);
        activities.splice(index, 1);
    }
    console.log("Updated: " + activities.length);
    for (i = 0; i < activities.length; i++) {
        Obj["type"] = "click";
        if (Buffer.byteLength(activities[i].key) > 40) {
            continue;
        }
        if (Buffer.byteLength(activities[i].id) > 114) {
            continue;
        }
        Obj["name"] = activities[i].key;
        Obj["key"] = set.WEIXIN_BOOK_HEADER + activities[i].key;
        Obj["sub_button"] = [];

        buttons.push(JSON.parse(JSON.stringify(Obj)));
    }
   
    var oldMenu = menuStr;
    modifyMenu(buttons);
    if (oldMenu !== menuStr) {
        console.log("Menu modified");
        at.getAccessToken(createMenu);
    }
}

var menu_timer = null;
function setMenuTimer() {
    if (menu_timer == null) {
        later.setInterval(function() {
            autoClearOldMenus(ticket_cache.menu_activity);
        }, later.parse.recur().every(3).minute());
    }
}

var set = require("./settings.js");
var https = require('https');
var lock = require('../models/lock');

var ACCESS_TOKEN;
var AT_UPDATE_TIME = undefined;

exports.getAccessToken = function getAccessToken(callback) {
    lock.acquire('getAccessToken', function() {
        console.log("getAccessToken: AT_UPDATE_TIME=" + AT_UPDATE_TIME);
        var now = new Date();
        if (AT_UPDATE_TIME != undefined
            && now.getYear() == AT_UPDATE_TIME.getYear()
            && now.getMonth() == AT_UPDATE_TIME.getMonth()
            && now.getDay() == AT_UPDATE_TIME.getDay()
            && (now.getHours() - AT_UPDATE_TIME.getHours()) <= 1) {
            lock.release('getAccessToken');
            callback(ACCESS_TOKEN);
        }
        else {
            var at_tmp = ACCESS_TOKEN;
            https.get("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="
                + set.WEIXIN_APPID + "&secret=" + set.WEIXIN_SECRET, function (response) {
                response.on('data', function (d) {
                    var obj = JSON.parse(d);
                    ACCESS_TOKEN = obj.access_token;
                    AT_UPDATE_TIME = new Date();
                    lock.release('getAccessToken');
                    callback(ACCESS_TOKEN);
                });
            }).on('error', function (e) {
                lock.release('getAccessToken');
                console.log("Error while getAccessToken");
                console.error(e);
            });
        }
    });
};

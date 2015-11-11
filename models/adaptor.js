/**
 * Created by Yue Dayu on 2015/11/11.
 */
var redis = require('redis');
var database_config = require('../database_config.json');

client = redis.createClient(database_config.port, database_config.address);

client.auth(database_config.password, function () {
    console.log("auth success!");
});

client.on('error', function (error) {
    console.log(error);
});

var DB = {
    createNew: function (obj) {
        this.name = obj.name;
        this.list = obj.key;
        this.pk = 0;
        return this;
    },

    find: function () {

    },

    insert: function (obj, callback) {
        var key_name = this.name + "_" + this.pk;
        client.hmset(key_name, obj);
        for (var x in this.list) {
            client.sadd(this.name + '_' + this.list[x] + '_' + obj[this.list[x]], key_name);
        }
        this.pk++;
        if (callback) {
            callback();
        }
    },

    update: function () {

    }
};

exports.redis = function (list) {
    var res = [];
    list.each(function (x) {
        res[x.name] = DB.createNew(x);
    });
    return res;
};

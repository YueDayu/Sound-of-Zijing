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

    insert: function () {
        var key_name = this.name + "_" + str(this.pk);
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

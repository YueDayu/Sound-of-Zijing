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

    find: function (obj, callback) {
        if (!callback) {
            callback = function () {};
        }

        if ("pk" in obj) {
            client.hgetall(this.name + "_" + obj["pk"], function(err, res) {
                if (err) {
                    callback(err, []);
                } else {
                    callback(null, [res]);
                }
            });
        } else {
            var cmd = [];
            for (var attr in obj) {
                if (attr[0] != '$') {
                    cmd.push(this.name + "_" + attr + "_" + obj[attr]);
                } else {
                    if (attr === "$or") {
                        //TODO
                    }
                }
            }

            client.sinter(cmd, function(err, res) {
                if (err) {
                    callback(err, []);
                } else {
                    if (res.length() === 0) {
                        callback(null, []);
                    }
                    var docs = [];
                    var iserror = false;
                    var finished = 0;
                    finished = res.length();
                    for (x in res) {
                        client.hgetall(res[x], function(err, res) {
                            if (err) {
                                if (!iserror) {
                                    iserror = true;
                                    callback(err, []);
                                }
                            } else if (!iserror) {
                                docs.append(res);
                                finished -= 1;
                                if (finished === 0) {
                                    callback(null, []);
                                }
                            }
                        });
                    }
                }
            });
        }
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

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
        var union = function(obj, callback) {
            var iserror = false;
            var finished = obj.length();
            var docs = [];
            for (x in obj) {
                this.find(obj[x], function(err, res) {
                    if (err) {
                        if (!iserror) {
                            iserror = true;
                            callback(err, []);
                        }
                    } else if (!iserror) {
                        finished -= 1;
                        docs.append(res);
                        if (finished === 0) {
                            callback(null, docs);
                        }
                    }
                });
            }
        };

        if (id in obj) {
            client.hgetall(this.name + "_" + id, function(err, res) {
                if (err) {
                    callback(err, []);
                } else {
                    callback(null, [res]);
                }
            });
        } else {
            var cmd = "";
            for (attr in obj) {
                if (attr[0] != '$') {
                    cmd  = cmd + " " + this.name + "_" + attr + "_" + obj[attr];
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
                    var docs = [];
                    var iserror = false;
                    var finished = 0;
                    for (x in res) finished += 1;
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

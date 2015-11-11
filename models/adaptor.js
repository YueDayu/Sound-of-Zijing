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

var DB = function () {
    return {
        createNew: function (obj) {
            this.name = obj.name;
            this.list = obj.key;
            this.pk = 0;
            return this;
        },

        __findPks__: function (obj, callback) {
            if (!callback) {
                callback = function () {
                };
            }

            if ("pk" in obj) {
                callback(null, [obj["pk"]]);
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

                client.sinter(cmd, function (err, res) {
                    if (err) {
                        callback(err, []);
                    } else {
                        callback(null, res);
                    }
                });
            }
        },

        find: function (obj, callback) {
            if (!callback) {
                callback = function () {
                };
            }

            this.__findPks__(obj, function (err, res) {
                if (err) {
                    callback(err, []);
                } else {
                    if (res.length === 0) {
                        callback(null, []);
                    } else {
                        var docs = [];
                        var iserror = false;
                        var finished = 0;
                        finished = res.length;
                        for (var x in res) {
                            client.hgetall(res[x], function (err, resobj) {
                                if (err) {
                                    if (!iserror) {
                                        iserror = true;
                                        callback(err, []);
                                    }
                                } else if (!iserror) {
                                    resobj.pk = res[x];
                                    docs.push(resobj);
                                    finished -= 1;
                                    if (finished === 0) {
                                        callback(null, docs);
                                    }
                                }
                            });
                        }
                    }
                }
            });
        },

        insert: function (obj, callback) {
            var key_name = this.name + "_" + this.pk;
            console.log(key_name);
            var finished = this.list.length + 1;
            var cb = function (err, reply) {
                finished--;
                if (finished <= 0) {
                    callback(err, reply);
                }
            };
            client.hmset(key_name, obj, cb);
            for (var x in this.list) {
                client.sadd(this.name + '_' + this.list[x] + '_' + obj[this.list[x]], key_name, cb);
            }
            this.pk++;
        },

        update: function (condition, update, callback) {
            if (!callback) {
                callback = function () {
                };
            }

            var list = this.list;
            var name = this.name;

            var updateRelations = function (pk, update, callback) {
                if (!("$set" in update)) {
                    callback("no $set", []);
                    return;
                }
                client.hgetall(pk, function (err, resobj) {
                    if (err) {
                        callback(err, []);
                        return;
                    }
                    var finished = 0;
                    var iserror = false;
                    for (var x in list) {
                        if (list[x] in update["$set"]) finished += 1;
                    }
                    if (finished === 0) {
                        callback(null, []);
                        return;
                    }
                    for (x in list) {
                        if (iserror) {
                            return;
                        }
                        var attr = list[x];
                        if (!(attr in update["$set"])) {
                            continue;
                        }

                        client.srem(name + "_" + attr + "_" + resobj[attr], pk, function (err, reply) {
                            if (iserror) return;
                            if (err) {
                                if (!iserror) {
                                    iserror = true;
                                    callback(err, []);
                                }
                                return;
                            }
                            client.sadd(name + "_" + attr + "_" + update["$set"][attr], pk, function (err, reply) {
                                if (iserror) return;
                                if (err) {
                                    if (!iserror) {
                                        iserror = true;
                                        callback(err, []);
                                    }
                                    return;
                                }
                                finished -= 1;
                                if (finished === 0) {
                                    callback(null, [resobj]);
                                    return;
                                }
                            });
                        });
                    }
                });
            };

            this.__findPks__(condition, function (err, res) {
                if (err) {
                    callback(err, []);
                    return;
                }
                if (res.length === 0) {
                    callback(null, []);
                    return;
                }
                var finished = res.length;
                var iserror = false;
                var docs = [];
                for (var x in res) {
                    updateRelations(res[x], update, function (err, result) {
                        client.hmset(res[x], update["$set"], function (err, reply) {
                            if (err) {
                                if (!iserror) {
                                    iserror = true;
                                    callback(err, []);
                                }
                                return;
                            }
                            client.hgetall(res[x], function (err, resobj) {
                                finished -= 1;
                                resobj.pk = res[x];
                                docs.push(resobj);
                                if (finished === 0) {
                                    callback(null, docs);
                                }
                            });
                        });
                    });
                }
            });
        }
    };
};

exports.redis = function (list) {
    var res = {};
    for (var x in list) {
        var y = list[x];
        var temp = new DB();
        res[y.name] = temp.createNew(y);
    }
    return res;
};

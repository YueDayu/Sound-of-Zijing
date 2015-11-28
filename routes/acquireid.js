var express = require('express');
var router = express.Router();

var model = require('../models/models');

var USER_DB = model.students;
var db = model.db;
var redis_db = model.db;

router.get("/", function (req, res) {
    if (req.query.openid == null) {
        res.send("-1");
        return;
    }
    redis_db.get(USER_DB + '_' + req.query.openid, function(err, doc) {
        if (err || doc.length === '') {
            res.send("-1");
            return;
        }
        res.send(doc);
    });
});

module.exports = router;

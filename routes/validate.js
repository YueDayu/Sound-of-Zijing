var express = require('express');
var router = express.Router();
var request = require('request');
var http = require('http');
var querystring = require('querystring');
var models = require('../models/models');
var lock = require('../models/lock');

var db = models.db;
var redis_db = models.redis_db;
var students = models.students;

router.get('/', function (req, res) {
  if (req.query.openid == null) {
    res.send("不要捣乱，要有openid！！");
    return;
  }
  var openID = req.query.openid;
  redis_db.get(students + '_' + openID, function (err, res) {
    var isValidated = 1;
    if (err || !res) {
      isValidated = 0;
    }
    res.render('validate', {openid: openID, isValidated: isValidated});
  });
});

router.get('/time', function (req, res) {
  request('http://' + models.authIP + ':' + models.authPort + models.authPrefix + '/time', //
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        res.send(body);
      }
      else
        res.send('');
    });
});

router.post('/', function (req, res) {
  var tmp = req.body.secret;
  var openid = req.body.openid;
  var post_option = {
    host: models.authIP,
    port: models.authPort,
    path: models.authPrefix,
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  var r = http.request(post_option, function (resp) {
    resp.setEncoding('utf8');
    resp.on('data', function (chunk) {
      //console.log(chunk);
      var stu = JSON.parse(chunk);
      if (stu.code == 0) {
        lock.acquire(students, function () {
          redis_db.get(students + '_' + openid, function (err, docs) {
            if (!docs) {
              redis_db.get(students + '_r_' + stu.data.ID, function (err, docs2) {
                if (err || !docs2) {
                  redis_db.multi()
                    .set(students + '_' + openid, stu.data.ID + '_1')
                    .set(students + '_r_' + stu.data.ID, openid)
                    .exec(function () {
                      lock.release(students);
                      res.send('Accepted');
                    });
                } else {
                  redis_db.multi()
                    .del(students + '_' + docs2)
                    .set(students + '_' + openid, stu.data.ID + '_1')
                    .set(students + '_r_' + stu.data.ID, openid)
                    .exec(function () {
                      lock.release(students);
                      res.send('Accepted');
                    });
                }
              });
            } else {
              if (docs.split("_")[0] == stu.data.ID) {
                lock.release(students);
                res.send('Accepted');
              } else {
                lock.release(students);
                res.send('Binded');
              }
            }
          });
        });
      }
      else {
        res.send(stu.message);
      }
    });
    resp.on('end', function () {
    });
  });
  var post_data = querystring.stringify({'secret': tmp});
  r.write(post_data);
  r.end();
});

module.exports = router;

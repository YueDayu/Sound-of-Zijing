var express = require('express');
var router = express.Router();

var model = require('../models/models');
var lock = require('../models/lock');
var urls = require("../address_configure");

var ADMIN_DB = model.admins;
var db = model.db;

router.get("/", function(req, res, next)
{
    if (req.session.user!=null)
        res.redirect("/users");
    else
        res.render("login", {});
});

router.post("/", function(req, res) 
{
    var resData={};
    db[ADMIN_DB].find({username: req.body.username}, function(err,docs)
    {
        docs = docs[0];
        if (err)
        {
            resData.message="failed";
            resData.error="none";
        }
        else
        {
            if (docs.password===req.body.password)
            {
                resData.message="success";
                resData.next=urls.userPage;
                req.session.user=docs.pk;
            }
            else
            {
                resData.message="failed";
                resData.error="wrong";
            }
        }
        res.send(JSON.stringify(resData));
        return;
    });
});

module.exports = router;

var express = require('express');
var router = express.Router();

var model = require('../models/models');
var lock = require('../models/lock');
var urls = require("../address_configure");
var manageRoute = require("./user_manage");
var purchaseRoute = require("./user_purchase");
var uploadRoute = require("./user_upload_pic");

var ADMIN_DB = model.admins;
var db = model.db;

/* GET users listing. */

router.use("/", function(req, res, next)
{
    console.log(1);
    if (req.session.user==null) {
        console.log(2);
        res.redirect("/login");
    }
    else
        next();
});
router.get("/", function(req, res)
{
    console.log(3);
    db[ADMIN_DB].find({user:req.session.user},function(err,docs)
    {
        if (err || docs.length==0)
        {
            req.session.user=null;
            console.log(4);
            res.redirect("/login");
            return;
        }
        if (true)
        {
            res.redirect("/users/manage");
            return;
        }
        if (docs[0].cashier===true)
        {
            res.redirect("/users/purchase");
            return;
        }
        req.session.user=null;
        console.log(5);
        res.redirect("/login");
        return;
    });
});
router.use("/manage", function(req, res, next)
{
    db[ADMIN_DB].find({user:req.session.user,manager:1},function(err,docs)
    {
        if (err || docs.length==0)
        {
            req.session.user=null;
            res.redirect("/login");
            return;
        }
        next();
    });
});
router.use("/manage", manageRoute);

router.use("/purchase", function(req, res, next)
{
    db[ADMIN_DB].find({user:req.session.user,cashier:true},function(err,docs)
    {
        if (err || docs.length==0)
        {
            req.session.user=null;
            res.redirect("/login");
            return;
        }
        next();
    });
});
router.use("/purchase",purchaseRoute);

router.use("/upload", uploadRoute);

module.exports = router;

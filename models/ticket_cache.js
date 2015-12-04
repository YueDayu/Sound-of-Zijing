/**
 * Created by Yue Dayu on 2015/11/29.
 */

/*
 Store all ticket information during taking ticket;
 Pre-load activity information before begin;
 Save all information after ending (Or save information every hour).
 */

var later = require('later');
var moment = require('moment');
var fs = require('fs');
var model = require('../models/models');
var lock = require('../models/lock');
var db = model.db;
var ACTIVITY_DB = model.activities;
var SEAT_DB = model.seats;
var TICKET_DB = model.tickets;

var snapshot_path = "./snapshot/";

later.date.localTime();

/*
 Add activity when pre-load. use 'activity key' to search status and activity_id
 -2: pre-loading
 -1: pre-load finished: read data from the cache.
 0: book begin
 1: book end but can choose area
 2: all opt end and save back
 null: save back finished or not begin.

 status = [-1:2] ==> read data from cache.
 */
var current_activity = {};
exports.current_activity = current_activity;

/*
 the set of activity cache.
 all not-end activity should be here.
 use 'activity id' to search activity.
 */
var all_activity = {};
exports.all_activity = all_activity;

/*
 load not end activities to the list.
 may need load data from temp file.
 */
var load_not_end_activity = function () {
    var current_time = moment().subtract(1, 'h').subtract(5, 'h').valueOf();
    db[ACTIVITY_DB].find(
        {
            status: 1,
            book_end: {$gt: current_time}
        }, function(err, docs){
            if (err || docs.length == 0) {
                console.log("pre-load failed or no activity");
                return;
            }
            for (idx in docs) {
                var doc = docs[idx];
                all_activity[doc._id] = new activity_cache(doc.key, doc.book_start, doc.book_end);
                if (moment(parseInt(doc.book_start)).subtract(5, 'm').isBefore())
                {
                    all_activity[doc._id].pre_load();
                }
            }
        });
};
exports.load_not_end_activity = load_not_end_activity;

var activity_cache = function (activity_key, book_start, book_end) {
    this.activity_key = activity_key;
    this.all_ticket_num = 0;
    this.user_map = {}; // {num: ticket_number, tickets: {ticket_info}}
    this.activity_info = {};
    this.seat_map = {};
    this.pre_load_timer = null;
    this.book_start_timer = null;
    this.book_end_timer = null;
    this.save_back_timer = null;
    this.save_file_timer = null;
    this.book_start = 0;
    this.book_end = 0;

    this.clear_timer = function () {
        if (this.pre_load_timer != null) {
            this.pre_load_timer.clear();
            this.pre_load_timer = null;
        }
        if (this.book_start_timer != null) {
            this.book_start_timer.clear();
            this.book_start_timer = null;
        }
        if (this.book_end_timer != null) {
            this.book_end_timer.clear();
            this.book_end_timer = null;
        }
        if (this.save_back_timer != null) {
            this.save_back_timer.clear();
            this.save_back_timer = null;
        }
        if (this.save_file_timer != null) {
            this.save_file_timer.clear();
            this.save_file_timer = null;
        }
    };
    this.get_sched = function (time) {
        return {
            schedules: [{
                Y: [time.year()], M: [time.month() + 1],
                D: [time.date()], h: [time.hour()], m: [time.minute()]
            }]
        }
    };
    // just set timer!
    this.set_time = function (book_start, book_end) {
        this.clear_timer();
        this.pre_load_timer = later.setTimeout(function () {
            this.pre_load();
        }.bind(this), this.get_sched(moment(parseInt(book_start)).subtract(5, 'm')), this);

        this.book_start = book_start;
        this.book_start_timer = later.setTimeout(function () {
            this.book_start_event();
        }.bind(this), this.get_sched(moment(parseInt(book_start))), this);

        this.book_end = book_end;
        this.book_end_timer = later.setTimeout(function () {
            this.book_end_event();
        }.bind(this), this.get_sched(moment(parseInt(book_end))), this);

        this.save_back_timer = later.setTimeout(function () {
            this.save_to_db();
        }.bind(this), this.get_sched(moment(parseInt(book_end)).add(1, 'h')), this);
    };
    this.pre_load = function () {
        if (current_activity[this.activity_key] != null) {
            console.log("the activity is exist! please check the data.");
            return;
        }
        current_activity[this.activity_key] = {
            status: -2,
            activity_id: 0
        };
        // loading data from db
        lock.acquire('cache' + this.activity_key, function () {
            db[ACTIVITY_DB].find(
                {
                    key: this.activity_key,
                    status: 1
                }, function (err, docs) {
                    if (err || docs.length == 0) {
                        console.log('can\'t pre-load activity information. key: ' + this.activity_key);
                        return;
                    }
                    this.activity_info = docs[0];
                    this.all_ticket_num = this.activity_info.remain_tickets;
                    current_activity[this.activity_key].activity_id = this.activity_info._id;
                    console.log('pre-load success. ');
                    if (this.activity_info.need_seat != 0) { // load seat information
                        db[SEAT_DB].find({activity: this.activity_info._id}, function (err, doc2) {
                            if (err || doc2.length == 0) {
                                console.log('can\'t pre-load seat information. key: ' + this.activity_key);
                                return;
                            }
                            this.seat_map = doc2[0];
                            // finished
                            console.log('pre-load is finished! key: ' + this.activity_key);
                            current_activity[this.activity_key].status = -1;
                            lock.release('cache' + this.activity_key);
                            this.restore_from_file();
                        }.bind(this));
                    } else { // finished
                        console.log('pre-load is finished! key: ' + this.activity_key);
                        current_activity[this.activity_key].status = -1;
                        lock.release('cache' + this.activity_key);
                        this.restore_from_file();
                    }
                }.bind(this));
        }.bind(this));
    };
    // TODO: add a timer every 1 hour to save files.
    this.book_start_event = function () {
        console.log(this.activity_key);
        lock.acquire('cache' + this.activity_key, function () {
            console.log(this.activity_key + ' started!');
            current_activity[this.activity_key].status = 0;
            lock.release('cache' + this.activity_key);
            this.save_to_file();
            this.save_file_timer = later.setInterval(function() {
                this.save_to_file();
            }.bind(this), later.parse.recur().every(31).minute().after(1).minute(), this);
        }.bind(this));
    };
    this.save_to_file = function () {
        lock.acquire('cache' + this.activity_key, function() {
            if (current_activity[this.activity_key] && current_activity[this.activity_key].status >= -1) {
                var data = JSON.stringify(
                    {'remain_tickets': this.activity_info.remain_tickets,
                     'user_map': this.user_map,
                     'seat_map': this.seat_map,
                     'status': current_activity[this.activity_key].status
                    });
                lock.release('cache' + this.activity_key);
                var filepath = snapshot_path + this.activity_info._id + '.tmp';
                fs.writeFile(filepath, data, function(err) {
                    if (err) {
                        //TODO handle bad saved files
                        console.log('Error saving snapshot. key=' + this.activity_key);
                    }
                }.bind(this));
            } else {
                lock.release('cache' + this.activity_key);
            }
        }.bind(this));
    };
    this.restore_from_file = function () {
        lock.acquire('cache' + this.activity_key, function() {
            if (current_activity[this.activity_key] && current_activity[this.activity_key].status >= -1) {
                var filepath = snapshot_path + this.activity_info._id + '.tmp';
                fs.readFile(filepath, function(err, rawdata) {
                    if (err) {
                        console.log('Snapshot file read failed. key=' + this.activity_key);
                    } else {
                        data = JSON.parse(rawdata);
                        this.activity_info.remain_tickets = data['remain_tickets'];
                        this.user_map = data['user_map'];
                        this.seat_map = data['seat_map'];
                        current_activity[this.activity_key].status = data['status'];
                    }
                    lock.release('cache' + this.activity_key);
                    this.restore_events();
                }.bind(this));
            } else {
                lock.release('cache' + this.activity_key);
            }
        }.bind(this));
    };

    this.restore_events = function () {
        if (current_activity[this.activity_key].status == -1 && moment.parseInt(this.activity_info.book_start).isBefore()) {
            this.book_start_event();
        }
        if (current_activity[this.activity_key].status == 0 && moment.parseInt(this.activity_info.book_end).isBefore()) {
            this.book_end_event();
        }
        if (current_activity[this.activity_key].status == 1 && moment.parseInt(this.activity_info.book_end).add(1, 'h').isBefore()) {
            this.save_to_db();
        }
    };

    // TODO: disable the time which saved files.
    this.book_end_event = function () {
        lock.acquire('cache' + this.activity_key, function () {
            if (current_activity[this.activity_key].status == 0) {
                current_activity[this.activity_key].status = 1;
            } else {
                console.log('error on ending the activity. key: ' + this.activity_key);
            }
            lock.release('cache' + this.activity_key);
            this.save_to_file();
            if (this.save_file_timer === null) {
                this.save_file_timer = later.setInterval(function() {
                    this.save_to_file();
                }.bind(this), later.parse.recur().every(31).minute().after(1).minute(), this);
            }
        }.bind(this));
    };
    this.save_to_db = function () {
        if (this.save_file_timer != null) {
            this.save_file_timer.clear();
            this.save_file_timer = null;
        }
        lock.acquire('cache' + this.activity_key, function () {
            if (current_activity[this.activity_key].status == 1) {
                current_activity[this.activity_key].status = 2;
            } else {
                console.log('error on save back. key: ' + this.activity_key);
                lock.release('cache' + this.activity_key);
                return;
            }
            var save_item_num = this.all_ticket_num - this.activity_info.remain_tickets + 1;
            if (this.activity_info.need_seat() != 0) { // save sear data.
                save_item_num++;
                db[SEAT_DB].update({
                    activity: this.activity_info._id
                }, this.seat_map, {multi: false}, function() {
                    save_item_num--;
                    if (save_item_num == 0) { // finished all
                        var id = this.activity_info._id;
                        current_activity[this.activity_key] = null;
                        this.clear_activity();
                        all_activity[id] = null;
                        lock.release('cache' + this.activity_key);
                        this.save_to_file();
                    }
                }.bind(this));
            }
            db[ACTIVITY_DB].update({
                _id: this.activity_info._id
            }, this.activity_info, {multi: false}, function (err, result) {
                if (err || result.n == 0) {
                    console.log('error on save back. key: ' + this.activity_key);
                    return;
                }
                save_item_num--;
                if (save_item_num == 0) { // finished all
                    var id = this.activity_info._id;
                    current_activity[this.activity_key] = null;
                    this.clear_activity();
                    all_activity[id] = null;
                    lock.release('cache' + this.activity_key);
                    this.save_to_file();
                }
            }.bind(this));
            for (var stu_index in this.user_map) {
                var stu_tickets = this.user_map[stu_index].tickets;
                for (var tic_index in stu_tickets) {
                    db[TICKET_DB].insert(stu_tickets[tic_index], function () {
                        save_item_num--;
                        if (save_item_num == 0) { // finished all
                            var id = this.activity_info._id;
                            current_activity[this.activity_key] = null;
                            this.clear_activity();
                            all_activity[id] = null;
                            lock.release('cache' + this.activity_key);
                            this.save_to_file();
                        }
                    }.bind(this));
                }
            }
        }.bind(this));
    };
    this.clear_activity = function () {
        this.user_map = {};
        this.activity_info = {};
        this.seat_map = {};
        this.clear_timer();
    };

    this.set_time(book_start, book_end);
};

exports.activity_cache = activity_cache;
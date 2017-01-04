"use strict";

const fs = require('fs');
const db = require('./database');
const sheduler = require('./scheduler');
const notification = require('./notification');
const uuidV1 = require('uuid/v1');
const server = require('./server');
const io = server.io;


class Settings {
    constructor() {
        this.settings = {};

        // DB paths
        this.dPopups = 'dashboard.popups';
        this.dFeed = 'dashboard.feed';
        this.sTwitch = 'api.twitch.active';
        this.sYouTube = 'api.youtube.active';
        this.sStreamlabs = 'api.streamlabs.active';
        this.nGlobal = 'notification.active';
        this.nDuration = 'notification.duration';
        this.nFollows = 'api.twitch.types.follows';
        this.nSubscriptions = 'api.twitch.types.subscriptions';
        this.nHosts = 'api.twitch.types.hosts';
        this.nDonations = 'api.streamlabs.types.donations';
        this.template = 'notification.template.selected';
    }

    get data() {
        return this.settings;
    }

    set data(data) {
        db.settings.set(this[data.name], data.value).value();
    }

    update(callback) {
        this.settings = {
            notification: db.settings.get('notification').cloneDeep().value(),
            dashboard: db.settings.get('dashboard').value(),
            api: {
                twitch: db.settings.get('api.twitch').cloneDeep().value(),
                youtube: {
                    active: false
                },
                streamlabs: db.settings.get('api.streamlabs').cloneDeep().value()
            }
        };

        callback();
    }
}

class Stats {
    constructor() {
        this.miniQ = 0;
        this.stats = {};
    }

    get data() {
        return this.stats;
    }

    set data(value) {
        this.miniQ = value;
        this.update();
    }

    update() {
        this.stats = {
            qCount: this.miniQ +
                db.queue.get('follows.list').size().value() +
                db.queue.get('subs.list').size().value() +
                db.queue.get('hosts.list').size().value() +
                db.queue.get('donations.list').size().value(),
            feed: {
                list: db.stats.get('feed.list').value()
            },
            charts: {
                follows: db.stats.get('follows').value(),
                subs: db.stats.get('subs').value(),
                donations: db.stats.get('donations').value()
            }
        };
    }

    push(callback) {
        if (connected) {
            io.sockets.emit('stats', this.stats);
            callback();
        }

        callback();
    }
}

exports.getData = (callback) => {
    settings.update(() => {
        callback({
            settings: settings.data,
            stats: stats.data
        });
    });
};

const stats = new Stats();
const settings = new Settings();
stats.update();
exports.stats = stats;

//
//# SOCKET.IO
//
var connected = false;

io.on('connection', (socket) => {
    connected = true;

    socket.on('dashboard', (data) => {

        function callback() {
            socket.emit('dashboard', 'event', data);
        }

        if (data.name !== 'testNoti' && 'nCSS') {
            settings.data = data;
        }

        //* notifications
        if (data.name == 'nGlobal') {
            if (!data.value) {
                sheduler.stopInt();
            } else {
                sheduler.notifications();
            }
        }

        // misc
        if (data.name == 'testNoti') {
            let obj = {
                type: data.type,
                test: true
            };
            io.sockets.emit('notification', obj);
        } else if (data.name == 'nCSS') {
            let template = db.settings.get('notification.template.selected').value();
            fs.writeFile(`./views/templates/${template}/ressources/css/notification.css`, data.value, (err) => {
                if (err) console.log(err);
                console.log('saved!');
            });
        }

        callback(data);
    });

    socket.on('disconnect', () => {
        connected = false;
    });
});


//
// # Activity Feed
//
exports.feed = (id, data) => {

    var feed = db.stats.get('feed.list').value(),
        first = db.stats.get('feed.list').first().value(),
        date = new Date();

    if (feed.length === 15) {
        db.stats.get('feed.list').remove(first).value();
        if (connected) {
            var remove = {
                feed: {
                    remove: first.uuid
                }
            };
            io.sockets.emit('stats', remove);
        }
    }

    db.stats.get('feed.list').push({
        uuid: uuidV1(),
        uid: id,
        date: date,
        type: data.type,
        name: data.name,
        resubs: data.resubs,
        amount: data.amount,
        message: data.message,
        currency: data.currency,
        viwer: null
    }).value();
};
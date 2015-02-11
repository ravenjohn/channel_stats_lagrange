'use strict';

Object.prototype.toArray=function(){
    var arr = [];
    for( var i in this ) {
        if (this.hasOwnProperty(i)){
            arr.push(this[i]);
        }
    }
    return arr;
};

(function() {
var mysql   = require('anytv-node-mysql'),
    moment = require('moment'),
    Ipolate = require(__dirname + '/interpolate.js'),
    config  = {
        host        : '127.0.0.1',
        user        : 'root',
        password    : '',
        database    : 'master'
    },
    first,
    data = {},
    
    starter_than_start = function () {
          
        mysql.open(config)
            .query('SELECT channel_id FROM mcn_channels', function (err, result) {
                if (err) {
                    return console.log(err);
                }
                result.forEach(start);
            })
            .end();
    },

    start = function (a) {
        //get all data
        mysql.open(config)
            .query('SELECT * FROM channel_stats WHERE channel_id = ?'
                +' ORDER BY insert_date asc', a.channel_id, get_days)
            .end();
    },

    get_days = function (err, result) {
        first = result[0].insert_date;

        if (err) {
            console.log('Error getting limit');
        }

        //indices based on how many days from the first data
        result.forEach(function(row) {
            var date    = row.insert_date;
            data[moment.duration(moment(date).diff(moment(first))).asDays()] = row;
        });

        interpolate();
    },

    interpolate = function () {
        var i,
            values = {
                x: {
                    views: [],
                    comments: [],
                    subscribers: [],
                    videos: []
                },
                y: {
                    views: [],
                    comments: [],
                    subscribers: [],
                    videos: []
                }
            },
            days = Object.keys(data)
                .map(function(e) {
                    return +e;
                })
                .sort(function(a,b) {
                    return b-a;
                }),
            date,
            missing = [],
            ipolate = {},
            last_missing;

        last_missing = 0;
        missing = [];

        for(i = +days[0]; i > 0; i--) {
            if (!~days.indexOf(i)) {
                if (last_missing !== i+1) {
                    date = data[i+1].insert_date;

                    values.x.views = [i+1];
                    values.y.views = [data[i+1].views];

                    values.x.comments = [i+1];
                    values.y.comments = [data[i+1].comments];

                    values.x.subscribers = [i+1];
                    values.y.subscribers = [data[i+1].subscribers];

                    values.x.videos = [i+1];
                    values.y.videos = [data[i+1].videos];
                }

                missing.push(i);
                last_missing = +i;
            }

            if (last_missing === i+1) {
                values.x.views.push(i);
                values.y.views.push(data[i].views);

                values.x.comments.push(i);
                values.y.comments.push(data[i].comments);

                values.x.subscribers.push(i);
                values.y.subscribers.push(data[i].subscribers);

                values.x.videos.push(i);
                values.y.videos.push(data[i].videos);

                ipolate.views = new Ipolate(
                    values.x.views[0], values.y.views[0],
                    values.x.views[1], values.y.views[1]);

                ipolate.comments = new Ipolate(
                    values.x.comments[0], values.y.comments[0],
                    values.x.comments[1], values.y.comments[1]);

                ipolate.subscribers = new Ipolate(
                    values.x.subscribers[0], values.y.subscribers[0],
                    values.x.subscribers[1], values.y.subscribers[1]);

                ipolate.videos = new Ipolate(
                    values.x.videos[0], values.y.videos[0],
                    values.x.videos[1], values.y.videos[1]);

                missing.forEach(function(e) {
                    data[e] = {};
                    data[e].channel_id = process.argv[2];
                    data[e].views = parseInt(ipolate.views.valueOf(e));
                    data[e].comments = parseInt(ipolate.comments.valueOf(e));
                    data[e].subscribers = parseInt(ipolate.subscribers.valueOf(e));
                    data[e].videos = parseInt(ipolate.videos.valueOf(e));
                    data[e].insert_date = moment(first).add(e, 'days').format('YYYY-MM-DD');
                });

                missing = [];
            }
        }

        var final_data = to_array(data);

        mysql.open(config)
            .query('INSERT IGNORE INTO channel_stats '
                    +'(channel_id, views, comments, subscribers, videos, insert_date) '
                    +'VALUES ?',
                [final_data],
                function (err, result) {
                    console.log('err', err);
                    console.log('result', result);

                    process.exit();
                })
            .end();
    },

    to_array = function (arr) {
       var keys = Object.keys(arr).filter(function(e) {
                return e==='0' || parseInt(e);
           }), i, ret = arr;

        if (Object.keys(arr).length === keys.length) {
            arr = arr.toArray();
        } else {
            return remove_indices(ret);
        }

        ret = [];

        for(i = 0; i < arr.length; i++) {
            ret.push(to_array(arr[i]));
        }

        return ret;
    },

    remove_indices = function (_obj) {
        var ret = [];

        for(var i in _obj) {
            if (i !== 'toArray') {
                ret.push(_obj[i]);
            }
        }

        return ret;
    },

    flatten = function (array) {
        var toreturn = [];

        if (array[0].length === 24) {
            toreturn.push(array);
            return toreturn;
        }

        array.forEach(function(item) {
            if (Array.isArray(item)) {
                toreturn = toreturn.concat(flatten(item));
                return;
            }

            toreturn = toreturn.concat(item);
        });

        return toreturn;
    };

starter_than_start();
})();

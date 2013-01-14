
var twitter = require('../lib/twitter');
var ProgressBar = require('progress');
var cache = require('../lib/cache');

module.exports = function () {
  var command = arguments[arguments.length - 1];

  if (command.offline) {
    var posts = cache.get('timeline');
    var messages = cache.get('dms');
    var friends = (function () {
      var ids = cache.get('friends_ids');
      var user_info = cache.get('user_info');
      try {
        return ids.reduce(function (friends, id) {
          if (!user_info[id]) throw new Error('Missing user info');
          friends[id] = user_info[id];
          return friends;
        }, {});
      } catch (e) {
        return null;
      }
    })();

    if (!posts || !messages || !friends) {
      console.error('Not enough data to work offline, please run "stats --cache-dms" at least once');
      process.exit(1);
    }

    analyze(friends, messages, posts);
    return;
  }

  console.error('Connecting to Twitter…');
  console.error();
  twitter(function (err, me) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.error('@%s (#%s) following %d account(s)', me.screen_name, me.id, me.friends_count);
    console.error('  I will now read your timeline and your direct messages, and then be able');
    console.error('  to tell you who you could remove to improve your productivity :)');
    if (cache.enabled) {
      console.error('  Note: timeline posts will be cached locally');
      console.error('        for privacy reasons direct messages are not cached');
      console.error('        unless you provided option "--cache-dms"')
    }
    console.error();
    process.stdout.write('');

    start(this, me);
  });

  function start (t, me) {
    extract_friends_list(t, me, function (err, friends) {
      if (err) throw err;
      extract_direct_messages(t, me, function (err, messages) {
        if (err) throw err;
        extract_timeline(t, me, function (err, posts) {
          if (err) throw err;
          analyze(friends, messages, posts);
        });
      });
    });
  }

  function extract_friends_list (t, me, cb) {
    var progress = new ProgressBar('Extracting ' + rpad('Friends List', 20) + '  [:bar] :percent', {
      complete: "⋅",
      incomplete: " ",
      width: 40,
      total: 1
    });
    progress.tick(0);
    var user_info = cache.get('user_info', {});
    t.getFriendsIds(me.id, function (res) {
      if (res instanceof Error) {
        console.error();
        return cb(res);
      }
      cache.set('friends_ids', res, true);
      progress.total = res.length;
      progress.tick(0);
      var friends = {};
      (function next () {
        var ids = res.splice(0, 50);
        var done = function () {
          ids.forEach(function (id) {
            friends[id] = user_info[id];
          });
          progress.tick(ids.length);
          if (res.length == 0) {
            progress.tick(progress.total);
            cb(null, friends);
          } else {
            next();
          }
        }
        var req_ids = ids.filter(function (id) {
          return !user_info[id];
        });
        if (req_ids.length) {
          t.post('/users/lookup.json', {user_id:req_ids.map(String).join(',')}, function (res) {
            if (res instanceof Error) {
              console.error();
              return cb(res);
            }
            res.forEach(function (user) {
              user_info[user.id_str] = user;
            });
            cache.set('user_info', user_info, true);
            done();
          });
        } else {
          done();
        }
      })();
    });
  }

  function extract_stream (get_stream, label, count, total, cache_key, cb) {
    var progress = new ProgressBar('Extracting ' + rpad(label, 20) + '  [:bar] :percent', {
      complete: "⋅",
      incomplete: " ",
      width: 40,
      total: total
    });
    progress.tick(0);

    var posts = cache.get(cache_key, []);

    var next = function () {
      var options = {count: count};
      if (posts.length > 0) {
        options.max_id = posts[posts.length - 1].id_str;
      }
      get_stream(options, function (res) {
        if (res instanceof Error) {
          console.error();
          return cb(err);
        }
        if (posts.length > 0) res = res.slice(0, -1);
        if (res.length == 0 || res[0].id_str == options.max_id) {
          // Done
          progress.tick(progress.total);
        } else {
          // Save and go on
          posts = posts.concat(res);
          if (cache_key) cache.set(cache_key, posts, true);
          progress.tick(res.length);
        }
        // Next step
        process.nextTick(function () {
          if (progress.complete) {
            progress.tick(progress.total);
            console.error();
            cb(null, posts);
          } else {
            next();
          }
        });
      });
    };

    progress.tick(0);
    process.nextTick(next);
  }

  function extract_direct_messages (t, me, cb) {
    var cache_key = command.cacheDms ? 'dms' : null;
    extract_stream(t.getDirectMessages.bind(t), 'Direct Messages', 50, 200, cache_key, cb);
  }

  function extract_timeline (t, me, cb) {
    extract_stream(t.getHomeTimeline.bind(t), 'Home Timeline', 100, 1000, 'timeline', cb);
  }

  function analyze (friends, messages, posts) {
    console.error();
    if (!command.offline) {
      console.error('Note: at this point, all data (except direct messages unless you');
      console.error('      provided options "--cache-dms") is cached.');
      console.error('      You can run "stats --offline" to return directly to this screen');
      console.error();
    }
    console.error('Analyzing data…');

    // Timelapse
    var end = new Date(posts[0].created_at).getTime();
    var start = new Date(posts[posts.length - 1].created_at).getTime();
    var timelapse = (end - start) / 1000;

    // The posters
    var posters = Object.keys(friends).map(function (id) {
      var nb = posts.filter(function (post) {
        return post.user.id == id;
      }).length;
      return {
        id: id,
        screen_name: friends[id].screen_name,
        nbPosts: nb,
        hourly: 3600 * nb / timelapse
      };
    });
    posters.sort(function (p1, p2) {
      return p2.nbPosts - p1.nbPosts;
    });

    (function loop () {
      console.error();
      console.error('What do you want to do with your data?');
      command.choose([
        'Global statistics',
        'Who is filling my timeline?',
        'Who is inactive?',
        'Who do I really care?',
        'Quit'
      ], function (i) {
        switch (i) {
          case 0: global_stats(); break;
          case 1: wip(); break;
          case 2: wip(); break;
          case 3: wip(); break;
          case 4: quit(); break;
        }
        loop();
      });
    })();

    function global_stats () {
      console.error();
      console.error('Global statistics:');
      console.error();
      console.error('  You receive ~ %d messages daily, do you feel overwhelmed?',
        Math.round((24 * posts.length) / (timelapse / 3600)));
      console.error('  The 20% top posters in your timeline produce %d%% of total',
        Math.round(100*posters.slice(0, Math.ceil(posters.length/5)).reduce(function (total, p) { return total + p.nbPosts }, 0) / posts.length));
      console.error('  Amongst your %d friends, %d%% did not post any message during the last %d hours.',
        posters.length,
        Math.round(100 * posters.filter(function (p) { return p.nbPosts == 0 }).length / posters.length),
        Math.round(timelapse/3600));
    }

    function wip () {
      console.error();
      console.error('Not Implemented Yet');
    }

    function quit () {
      console.error();
      console.error('Good bye!');
      process.exit(0);
    }
  }
}

function rpad (s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

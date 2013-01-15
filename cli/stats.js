
var twitter = require('../lib/twitter');
var ProgressBar = require('progress');
var Table = require('cli-table');
var cache = require('../lib/cache');
var color = require('../lib/color');

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
    console.error(color.success('@%s (#%s) following %d account(s)'), me.screen_name, me.id, me.friends_count);
    console.error();
    console.error('  I will now read your timeline and your direct messages, and then be able');
    console.error('  to tell you who you could remove to improve your productivity :)');
    if (cache.enabled) {
      console.error('  Note: timeline posts will be cached locally');
      console.error('        for privacy reasons direct messages are not cached');
      console.error('        ' + color.bold('unless you provided option "--cache-dms"'));
    }
    console.error();

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
      cache.set('friends_ids', res);
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
            console.error();
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
            cache.set('user_info', user_info);
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
          if (cache_key) cache.set(cache_key, posts);
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
      console.error('      You can run "' + color.bold('stats --offline') + '" to return directly to this screen');
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
      console.error();
      console.error(color.title('What do you want to do with your data?'));
      command.choose([
        color.bold('Global statistics'),
        color.bold('Who is filling my timeline?'),
        color.bold('Who is inactive?'),
        color.bold('Who do I really care?'),
        color.warning.bold('Quit')
      ], function (i) {
        console.error();
        console.error();
        switch (i) {
          case 0: global_stats(); break;
          case 1: top_posters(); break;
          case 2: inactive_posters(); break;
          case 3: top_interactions(); break;
          case 4: quit(); break;
        }
        loop();
      });
    })();

    function global_stats () {
      console.error();
      console.error(color.title('Global statistics') + ':');
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

    function top_posters () {
      console.error();
      console.error(color.title('Here are the 20% top posters of your timeline') + ':');
      console.error();
      console.error('If you want to read less, you should start here.');
      console.error();

      var table = new Table({
        head: ['#', 'id', '@screen_name', 'nb posts']
      });
      var i = 1;
      posters.slice(0, Math.ceil(posters.length/5)).filter(function (p) {
        return p.nbPosts > 0;
      }).forEach(function (p) {
        table.push([String(i++), p.id, '@' + p.screen_name, p.nbPosts]);
      });
      console.error(table.toString());
    }

    function inactive_posters () {
      console.error();
      console.error(color.title('Here are your "friends" who did not post anything recently') + ':');
      console.error();
      console.error('There may be inactive users in the list, if you want to clean');
      console.error('up your friends list, that may be a good start.');
      console.error();

      var table = new Table({
        head: ['#', 'id', '@screen_name', 'nb posts']
      });
      var i = 1;
      posters.filter(function (p) {
        return p.nbPosts == 0;
      }).forEach(function (p) {
        table.push([String(i++), p.id, '@' + p.screen_name, p.nbPosts]);
      });
      console.error(table.toString());
    }

    function top_interactions () {
      console.error();
      console.error(color.warning.bold('Not implemented yet, sorry :('));
      console.error();
      console.error('Next version will check who you mention or are mentionned by');
      console.error('and who sent/received direct messages, to detect your real');
      console.error('acquaintance in that mess. That should help a lot!');
    }

    function quit () {
      console.error();
      console.error(color.success('Good bye!'));
      process.exit(0);
    }
  }
}

function rpad (s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

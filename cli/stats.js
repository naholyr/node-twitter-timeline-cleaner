
var twitter = require('../lib/twitter');
var ProgressBar = require('progress');
var Table = require('cli-table');
var cache = require('../lib/cache');
var color = require('../lib/color');
var async = require('async');

ProgressBar.prototype.finish = function () {
  this.tick(this.total - this.curr); // update display
  this.tick(this.total); // force complete
};

module.exports = function () {
  var command = arguments[arguments.length - 1];

  if (command.offline) {
    var home_posts = cache.get('home_timeline');
    var user_posts = cache.get('user_timeline');
    var messages = cache.get('direct_messages');
    var mentions = cache.get('mentions');
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

    if (!home_posts || !user_posts || !friends || !mentions) {
      console.error('Not enough data to work offline, please run "stats" at least once');
      process.exit(1);
    }

    if (!messages) {
      console.error(color.warning('No direct messages data: stats will ignore DMs (run "stats --cache-dms" to cache DMs)'));
    }

    analyze(friends, messages, home_posts, user_posts, mentions);
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
    async.series([
      extract_friends_list.bind(this, t, me),
      extract_direct_messages.bind(this, t, me),
      extract_home_timeline.bind(this, t, me),
      extract_user_timeline.bind(this, t, me),
      extract_mentions.bind(this, t, me)
    ], function (err, results) {
      if (err) throw err;
      analyze(results[0], results[1], results[2], results[3], results[4]);
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
            progress.finish();
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
              user_info[user.id_str] = user_data(user);
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

  function user_data (user) {
    return {
      id:           user.id_str || user.id,
      url:          user.url,
      screen_name:  user.screen_name,
      name:         user.name,
      following:    user.following
    };
  }

  function post_data (post) {
    var user = post.user || post.sender;
    return {
      created_at:       post.created_at,
      user:             user ? user_data(user) : null,
      id:               post.id_str || post.id,
      text:             post.text,
      reply_status_id:  post.in_reply_to_status_id_str || post.in_reply_to_status_id,
      reply_user_id:    post.in_reply_to_user_id_str || post.in_reply_to_user_id,
      mentions:         (function (user_mentions) {
        if (!user_mentions || !user_mentions.length) {
          return null;
        }
        var res = {};
        user_mentions.forEach(function (u) {
          res[u.id_str || u.id] = {
            id: u.id_str || u.id,
            screen_name: u.screen_name,
            name: u.name
          };
        });
        return res;
      })(post.entities && post.entities.user_mentions)
    };
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
      var options = {count: count, include_entities: 1};
      if (posts.length > 0) {
        options.max_id = posts[posts.length - 1].id_str;
      }
      get_stream(options, function (res) {
        if (res instanceof Error) {
          console.error();
          return cb(res);
        }
        if (posts.length > 0) res = res.slice(0, -1);
        if (res.length == 0 || res[0].id_str == options.max_id) {
          // Done
          progress.finish();
        } else {
          // Save and go on
          posts.forEach(function (p) {
            if (p.entities && p.entities.user_mentions) {
              console.error(p);
              process.exit(3);
            }
          });
          posts = posts.concat(res.map(post_data));
          if (cache_key) cache.set(cache_key, posts);
          progress.tick(res.length);
        }
        // Next step
        process.nextTick(function () {
          if (progress.complete) {
            progress.finish();
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
    var cache_key = command.cacheDms ? 'direct_messages' : null;
    extract_stream(t.getDirectMessages.bind(t), 'Direct Messages', 50, 200, cache_key, cb);
  }

  function extract_home_timeline (t, me, cb) {
    extract_stream(t.getHomeTimeline.bind(t), 'Home Timeline', 100, 800, 'home_timeline', cb);
  }

  function extract_user_timeline (t, me, cb) {
    extract_stream(t.getUserTimeline.bind(t), 'User Timeline', 100, 800, 'user_timeline', cb);
  }

  function extract_mentions (t, me, cb) {
    extract_stream(t.getMentions.bind(t), 'Mentions', 100, 800, 'mentions', cb);
  }

  function analyze (friends, messages, home_posts, user_posts, mentions) {
    console.error();
    if (!command.offline) {
      console.error('Note: at this point, all data (except direct messages unless you');
      console.error('      provided options "--cache-dms") is cached.');
      console.error('      You can run "' + color.bold('stats --offline') + '" to return directly to this screen');
      console.error();
    }
    console.error('Analyzing data…');

    // Time lapses
    var home_end = new Date(home_posts[0].created_at).getTime();
    var home_start = new Date(home_posts[home_posts.length - 1].created_at).getTime();
    var home_timelapse = (home_end - home_start) / 1000;
    var user_end = new Date(user_posts[0].created_at).getTime();
    var user_start = new Date(user_posts[user_posts.length - 1].created_at).getTime();
    var user_timelapse = (user_end - user_start) / 1000;
    var mentions_end = new Date(mentions[0].created_at).getTime();
    var mentions_start = new Date(mentions[mentions.length - 1].created_at).getTime();
    var mentions_timelapse = (mentions_end - mentions_start) / 1000;

    // The posters
    var posters = Object.keys(friends).map(function (id) {
      var nb = home_posts.filter(function (post) {
        return post.user.id == id;
      }).length;
      return {
        id: id,
        screen_name: friends[id].screen_name,
        nbPosts: nb,
        hourly: 3600 * nb / home_timelapse
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
        Math.round((24 * home_posts.length) / (home_timelapse / 3600)));
      console.error('  You post ~ %d messages daily',
        Math.round((24 * user_posts.length) / (user_timelapse / 3600)));
      console.error('  You receive ~ %d mentions daily',
        Math.round((24 * mentions.length) / (mentions_timelapse / 3600)));
      console.error('  The 20% top posters in your timeline produce %d%% of total',
        Math.round(100*posters.slice(0, Math.ceil(posters.length/5)).reduce(function (total, p) { return total + p.nbPosts }, 0) / home_posts.length));
      console.error('  Amongst your %d friends, %d%% did not post any message during the last %d hours.',
        posters.length,
        Math.round(100 * posters.filter(function (p) { return p.nbPosts == 0 }).length / posters.length),
        Math.round(home_timelapse/3600));
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

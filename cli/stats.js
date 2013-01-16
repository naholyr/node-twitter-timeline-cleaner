
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
    var messages = cache.get('direct_messages', []);
    var messages_sent = cache.get('direct_messages_sent', []);
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

    var enough_data = true;
    if (!Array.isArray(home_posts) || home_posts.length == 0) enough_data = false;
    if (!Array.isArray(user_posts)) enough_data = false;
    if (!Array.isArray(mentions)) enough_data = false;
    if (!friends || friends.constructor !== Object || Object.keys(friends).length == 0) enough_data = false;

    if (!enough_data) {
      console.error('Not enough data to work offline, please run "stats" at least once');
      process.exit(1);
    }

    if (!messages) {
      console.error(color.warning('No direct messages data: stats will ignore DMs (run "stats --cache-dms" to cache DMs)'));
    }

    analyze(friends, messages, messages_sent, home_posts, user_posts, mentions);
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
      console.error('  Note: fetched data will be cached locally');
      console.error('        for privacy reasons that ' + color.bold('DOES NOT') + ' include texts of messages');
      console.error('        if you do not want to cache DMs, add option "--no-cache-dms"');
    }
    console.error();

    start(this, me);
  });

  function start (t, me) {
    async.series([
      extract_friends_list.bind(this, t, me),
      extract_direct_messages.bind(this, t, me),
      extract_direct_messages_sent.bind(this, t, me),
      extract_home_timeline.bind(this, t, me),
      extract_user_timeline.bind(this, t, me),
      extract_mentions.bind(this, t, me)
    ], function (err, results) {
      if (err) throw err;
      analyze(results[0], results[1], results[2], results[3], results[4], results[5]);
    });
  }

  function extract_friends_list (t, me, cb) {
    var progress = new ProgressBar('Extracting ' + rpad('Friends List', 20) + '  [:bar] :percent', {
      complete: "⋅",
      incomplete: " ",
      width: 20,
      total: 1
    });
    progress.tick(0);
    var user_info = cache.get('user_info', {});
    t.getFriendsIds(me.id, function (res) {
      if (res instanceof Error) {
        console.error();
        return cb(res);
      }
      cache.set('friends_ids', res.slice());
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
            console.error('  Total %d friend(s)', Object.keys(friends).length);
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

  function post_data (me, post) {
    var user = post.user;
    if (!user && post.sender && post.sender.id != me.id) {
      user = post.sender;
    } else if (!user && post.recipient && post.recipient.id != me.id) {
      user = post.recipient;
    }
    return {
      created_at:       post.created_at,
      user:             user ? user_data(user) : null,
      id:               post.id_str || post.id,
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

  function extract_stream (me, get_stream, label, count, total, cache_key, cb) {
    var progress = new ProgressBar('Extracting ' + rpad(label, 20) + '  [:bar] :percent', {
      complete: "⋅",
      incomplete: " ",
      width: 20,
      total: total
    });
    progress.tick(0);

    var posts = [];
    var old_posts = cache.get(cache_key, []);
    var since_id = old_posts.length ? old_posts[0].id : null;
    var max_id = null;

    var next = function () {
      var options = {count: count, include_entities: 1};
      if (max_id) {
        options.max_id = max_id;
      }
      if (since_id) {
        options.since_id = since_id;
      }
      get_stream(options, function (res) {
        if (res instanceof Error) {
          console.error();
          return cb(res);
        }
        // First result = max_id
        if (max_id) res.splice(0, 1);
        if (res.length == 0) {
          // Done
          progress.finish();
        } else {
          max_id = res[res.length - 1].id;
          // Save and go on
          posts.forEach(function (p) {
            if (p.entities && p.entities.user_mentions) {
              process.exit(3);
            }
          });
          posts = posts.concat(res.map(post_data.bind(this, me)));
          progress.tick(res.length);
        }
        // Next step
        process.nextTick(function () {
          if (progress.complete) {
            progress.finish();
            posts = posts.concat(old_posts);
            if (cache_key) cache.set(cache_key, posts);
            console.error();
            console.error('  Fetched %d new post(s), Total %d post(s)', posts.length - old_posts.length, posts.length);
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
    extract_stream(me, t.getDirectMessages.bind(t), 'Direct Messages', 50, 500, cache_key, cb);
  }

  function extract_direct_messages_sent (t, me, cb) {
    var cache_key = command.cacheDms ? 'direct_messages_sent' : null;
    extract_stream(me, t.getDirectMessagesSent.bind(t), 'Direct Messages Sent', 50, 500, cache_key, cb);
  }

  function extract_home_timeline (t, me, cb) {
    extract_stream(me, t.getHomeTimeline.bind(t), 'Home Timeline', 100, 1000, 'home_timeline', cb);
  }

  function extract_user_timeline (t, me, cb) {
    extract_stream(me, t.getUserTimeline.bind(t), 'User Timeline', 100, 1000, 'user_timeline', cb);
  }

  function extract_mentions (t, me, cb) {
    extract_stream(me, t.getMentions.bind(t), 'Mentions', 100, 800, 'mentions', cb);
  }

  function analyze (friends, messages, messages_sent, home_posts, user_posts, mentions) {
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

    // Users statistics
    var posters = Object.keys(friends).map(function (id) {
      var nb = home_posts.filter(function (post) {
        return post.user.id == id;
      }).length;
      return {
        id: id,
        screen_name: friends[id].screen_name,
        nb_posts: nb,
        mention_to_me: mentions.reduce(function (total, m) {
          if (m.user && m.user.id == id) total++;
          return total;
        }, 0),
        mention_by_me: user_posts.reduce(function (total, p) {
          if (p.mentions && p.mentions[id]) total++;
          return total;
        }, 0),
        dm_to_me: messages.reduce(function (total, m) {
          if (m.user && m.user.id == id) total++;
          return total;
        }, 0),
        dm_by_me: messages_sent.reduce(function (total, m) {
          if (m.user && m.user.id == id) total++;
          return total;
        }, 0)
      };
    });
    posters.sort(function (p1, p2) {
      return p2.nb_posts - p1.nb_posts;
    });

    console.error();
    console.error(color.success('  Ready!'));
    console.error(color.error('  Remember that this data is only a fraction of your real activity'));
    console.error('  For example, data is based on only %d messages from your timeline', home_posts.length);

    (function loop () {
      console.error();
      console.error();
      console.error(color.title('What do you want to do with your data?'));
      command.choose([
        color.bold('Global statistics'),
        color.bold('Let me tell you who you should unfollow!'),
        color.bold('Who is filling your timeline?'),
        color.bold('Who is inactive?'),
        color.bold('Who do you really care?'),
        color.warning.bold('Quit')
      ], function (i) {
        console.error();
        console.error();
        switch (i) {
          case 0: global_stats(); break;
          case 1: smart_guess(); break;
          case 2: top_posters(); break;
          case 3: inactive_posters(); break;
          case 4: top_interactions(); break;
          case 5: quit(); break;
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
        Math.round(100*posters.slice(0, Math.ceil(posters.length/5)).reduce(function (total, p) { return total + p.nb_posts }, 0) / home_posts.length));
      console.error('  Amongst your %d friends, %d%% did not post any message during the last %d hours.',
        posters.length,
        Math.round(100 * posters.filter(function (p) { return p.nb_posts == 0 }).length / posters.length),
        Math.round(home_timelapse/3600));
    }

    function top_posters () {
      console.error();
      console.error(color.title('Here are the 20% top posters of your timeline') + ':');
      console.error();
      console.error('If you want to read less, you should start here.');
      console.error();

      var table = new Table({
        head: ['#', 'id', '@screen_name', 'nb posts', 'mentions', 'DMs']
      });
      var i = 1;
      posters.slice(0, Math.ceil(posters.length/5)).filter(function (p) {
        return p.nb_posts > 0;
      }).forEach(function (p) {
        table.push([
          String(i++),
          String(p.id),
          '@' + p.screen_name,
          p.nb_posts,
          String(p.mention_by_me) + '↑ ' + String(p.mention_to_me) + '↓',
          String(p.dm_by_me) + '↑ ' + String(p.dm_to_me) + '↓'
        ]);
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
        head: ['#', 'id', '@screen_name']
      });
      var i = 1;
      posters.filter(function (p) {
        return p.nb_posts == 0 && p.dm_by_me == 0 && p.dm_to_me == 0 && p.mention_by_me == 0 && p.mention_to_me == 0;
      }).forEach(function (p) {
        table.push([String(i++), String(p.id), '@' + p.screen_name]);
      });
      console.error(table.toString());
    }

    function top_interactions () {
      console.error();
      console.error(color.title('Here are the users you interact with the most') + ':');
      console.error();
      console.error('  You should already know them, and probably don\'t want to unfollow them');
      console.error();

      var table = new Table({
        head: ['#', 'id', '@screen_name', 'nb posts', 'mentions', 'DMs', 'score (*)']
      });
      var i = 1;
      posters
        .slice() // clone
        .filter(function has_interaction (u) {
          return u.dm_to_me > 0 || u.dm_by_me > 0 || u.mention_to_me > 0 || u.mention_by_me > 0;
        })
        .map(function add_score (u) {
          var score = 0;
          // Mentions (to me = 1, from me = 2)
          score += 1 * u.mention_to_me;
          score += 2 * u.mention_by_me;
          // DMs (to me = 3, from me = 5)
          score += 3 * u.dm_to_me;
          score += 5 * u.dm_by_me;
          u.score = score;
          return u;
        })
        .sort(function cmp_score (u1, u2) {
          return u2.score - u1.score;
        })
        .forEach(function (u) {
          table.push([
            String(i++),
            String(u.id),
            '@' + u.screen_name,
            u.nb_posts,
            String(u.mention_by_me) + '↑ ' + String(u.mention_to_me) + '↓',
            String(u.dm_by_me) + '↑ ' + String(u.dm_to_me) + '↓',
            String(u.score)
          ]);
      });

      i--;
      console.error(color.bold('  You had direct interaction with %d/%d (') + color.success('%d%%') + color.bold(') of your friends'), i, posters.length, Math.round(100 * i / posters.length));
      console.error(table.toString());

      console.error();
      console.error('(*) How "score" is calculated?');
      console.error('  The general idea is that DM > mention, and you → user > user → you');
      console.error('  * A DM sent to you gives 3 points');
      console.error('  * A DM sent by you gives 5 points');
      console.error('  * A mention sent to you gives 1 points');
      console.error('  * A mention sent by you gives 2 points');
      console.error('  Yes, you could not agree. This is an *information*, use it the way you like');
      console.error();
    }

    function smart_guess () {
      console.error();
      console.error(color.warning.bold('Not implemented yet, sorry :('));
      console.error();
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


var twitter = require('../lib/twitter');
var ProgressBar = require('progress');
var cache = require('../lib/cache');

module.exports = function () {
  var command = arguments[arguments.length - 1];

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
    t.getFriendsIds(me.id, function (res) {
      progress.tick(1);
      console.error();
      var err = (res instanceof Error) ? res : null;
      var list = err ? null : res;
      if (!err) cache.set('friends', list);
      cb(err, list);
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
    console.error('Analyzing data…');

    console.error('  Detect who is filling your timeline: ');
    var posters = friends.map(function (id) {
      return {
        id: id,
        nbPosts: posts.filter(function (post) {
          return post.user.id == id;
        }).length
      };
    });
    posters.sort(function (p1, p2) {
      return p2.nbPosts - p1.nbPosts;
    });
    console.error(posters);

    console.error('TODO analyze');
  }
}

function rpad (s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

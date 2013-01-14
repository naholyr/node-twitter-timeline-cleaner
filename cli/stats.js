
var twitter = require('../lib/twitter');
var ProgressBar = require('progress');

module.exports = function () {
  twitter(function (err, me) {
/*
    this.rateLimitStatus(function (res) {
      console.error(res);
    });
*/
/*
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.error('@%s (#%s):', me.screen_name, me.id);
    console.error('  following %s account(s)', me.friends_count);
    var progress = new ProgressBar('  extracting ~1000 latest messages from your timeline [:bar] :percent :etas', {
      complete: "⋅",
      incomplete: " ",
      width: 20,
      total: 1000
    });
    progress.tick(0);
    var t = this;
    var posts = [];

    var done = function () {
      console.error('NB POSTS', posts.length);
      progress.tick(progress.total);
      console.error('TODO: analyze timeline');
    };

    var next = function () {
      var options = {count: 200};
      if (posts.length > 0) {
        options.max_id = posts[posts.length - 1].id_str;
      }
      console.error(options);
      t.getHomeTimeline(options, function (res) {
        if (res instanceof Error) throw res;
        console.error('COUNT', res.length, 'FIRST', res[0].id_str, 'LAST', res[res.length-1].id_str);
        if (posts.length > 0) res = res.slice(0, -1);

        console.error('COUNT', res.length, 'LAST', res[res.length-1].id_str);
        posts = posts.concat(res);
        progress.tick(res.length);
        process.nextTick(function () {
          if (progress.complete) {
            done();
          } else {
            next();
          }
        });
      });
    };

    progress.tick(0);
    process.nextTick(next);
*/
  });
}


var twitter = require('../lib/twitter');
var ProgressBar = require('progress');

module.exports = function () {
  twitter(function (err, me) {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    this.rateLimitStatus(function (res) {
      if (res instanceof Error) {
        console.error(err);
        process.exit(1);
      }
      console.log('Rate limits:');
      console.log('  General (hourly): %s/%d remaining (reset at %s)', pad(res.remaining_hits, 3), res.hourly_limit, res.reset_time);
      console.log('  Photo (daily):    %s/%d remaining (reset at %s)', pad(res.photos.remaining_hits, 3), res.photos.daily_limit, res.photos.reset_time);
    });
  });
}

function pad (s, n) {
  s = String(s);
  while (s.length < n) s = ' ' + s;
  return s;
}

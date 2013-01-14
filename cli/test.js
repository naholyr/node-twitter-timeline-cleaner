
var twitter = require('../lib/twitter');
var color = require('../lib/color');

module.exports = function () {
  twitter(function (err, me) {
    if (err) {
      console.error(color.error('Error: ' + String(err)));
      process.exit(1);
    }
    console.error(color.success('Connection successful: @%s'), me.screen_name);
    process.exit(0);
  });
};

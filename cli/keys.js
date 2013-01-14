
var twitter = require('../lib/twitter');
var config = require('../lib/config');

module.exports = function () {
  config.load();
  var command = arguments[arguments.length - 1];
  if (command.key) {
    config.data.consumer_key = command.key;
  }
  if (command.secret) {
    config.data.consumer_secret = command.secret;
  }
  if (!command.check) {
    console.error('App\'s credentials validation has been skipped.');
    save();
  } else {
    twitter(function (err, t) {
      if (err) {
        console.error();
        console.error('Error %s: %s', err.statusCode, err.data || String(err));
        console.error('Check your consumer key and/or secret!');
        console.error('You new configuration HAS NOT been saved.');
        console.error();
        process.exit(1);
      }
      console.log('App\'s credentials have been validated.');
      save();
    });
  }
  function save () {
    if (config.data.access_token_key || config.data.access_token_secret) {
      delete config.data.access_token_key;
      delete config.data.access_token_secret;
      console.log('Your access tokens have been removed.');
    }
    config.save();
    console.log('Configuration has been saved in "%s"', config.file);
  }
}

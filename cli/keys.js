
var Twitter = require('twitter');
var config = require('../lib/config');
var color = require('../lib/color');

module.exports = function () {
  config.load();
  var command = arguments[arguments.length - 1];
  if (!command.key && !command.secret && !command.resetAccess) {
    console.error();
    console.error(color.error('  Error: option (--key, --secret, or --reset-access) required'));
    command.help();
    process.exit(0);
  }
  if (command.key) {
    config.data.consumer_key = command.key;
  }
  if (command.secret) {
    config.data.consumer_secret = command.secret;
  }
  if (!command.check) {
    console.error(color.warning('App\'s credentials validation has been skipped.'));
    save();
  } else {
    (new Twitter({
      consumer_key: config.data.consumer_key,
      consumer_secret: config.data.consumer_secret
    })).oauth.getOAuthRequestToken(function (err) {
      if (err) {
        console.error();
        console.error(color.error('Error %s: %s'), err.statusCode, err.data || String(err));
        console.error('Check your consumer key and/or secret!');
        console.error('You new configuration ' + color.bold('HAS NOT') + ' been saved.');
        console.error();
        process.exit(1);
      }
      console.log(color.success('App\'s credentials have been validated.'));
      save();
    });
  }
  function save () {
    if (config.data.access_token_key || config.data.access_token_secret) {
      delete config.data.access_token_key;
      delete config.data.access_token_secret;
      console.log(color.warning('Your access tokens have been removed.'));
    }
    config.save();
    console.log(color.success('Configuration has been saved in "%s"'), config.file);
    console.log('Run "' + command.parent._name + ' test" to try connection');
  }
}

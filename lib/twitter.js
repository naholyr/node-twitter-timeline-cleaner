var Twitter = require('twitter');

var config = require('./config');
var program = require ('commander');

module.exports = function (cb) {
  config.load();

  var command = this instanceof program.Command ? this : program;

  if (!config.data.consumer_key || !config.data.consumer_secret) {
    return cb(new Error('App\'s credentials not configured'));
  }

  var t = new Twitter(config.data);

  if (config.data.access_token_key && config.data.access_token_secret) {
    t.verifyCredentials(function (err) {
      if (err instanceof Error) return cb(err);
      return cb(null, t);
    });
    return;
  }

  console.error('Credentials information incomplete: you have to authorize app first.');
  t.oauth.getOAuthRequestToken(function (err, oauth_token, oauth_secret) {
    if (err) return cb(err);
    console.error('Visit https://twitter.com/oauth/authorize?oauth_token=%s', oauth_token);
    console.error('Once you confirm authentication, you will be granted a PIN number.');
    program.prompt('Please enter this PIN number: ', function (pin) {
      t.oauth.getOAuthAccessToken(oauth_token, oauth_secret, pin, function (err, token, secret) {
        if (err) {
          if (parseInt(err.statusCode) == 401) {
            err.message = 'The PIN number you have entered is incorrect';
          }
          return cb(err);
        }
        config.data.access_token_key = token;
        config.data.access_token_secret = secret;
        try {
          config.save();
        } catch (e) {
          err = e;
        }
        cb(err, t);
      });
    });
  });
}

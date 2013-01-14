var twitter = require('twitter');

var config = require('./config');

module.exports = function (options, cb) {
  if (typeof options === 'function') {
    cb = options;
    config.load();
    options = config.data;
  }

  var t = new twitter(options);
  t.oauth.getOAuthRequestToken(function (err, token, secret, auth_url, params) {
    cb(err, t);
  });
}


/*

t.getDirectMessages(function () {
  console.error(arguments);
});





console.error(t.oauth);

t.oauth.getOAuthRequestToken(function (err, token, secret, auth_url, params) {
  console.error(arguments);
});
/*
self.oauth.getOAuthRequestToken(
      function(error, oauth_token, oauth_token_secret, oauth_authorize_url, params) {
        if ( error ) {
          // FIXME: do something more intelligent
          return next(500);
        } else {
          cookies.set(self.options.cookie, JSON.stringify({
            oauth_token: oauth_token,
            oauth_token_secret: oauth_token_secret
          }), self.options.cookie_options);
          res.writeHead(302, {
            'Location': self.options.authorize_url + '?'
              + querystring.stringify({oauth_token: oauth_token})
          });
          res.end();
          return;
        }
      });

var x = {
    consumer_key: 'OiDU6XJcOvEBjq3BBncMRw',
    consumer_secret: 'zMWayH7fIGiTumqtDqfwY5Jqym8ocGx1AuNtMoBadg',
    access_token_key: 'STATE YOUR NAME',
    access_token_secret: 'STATE YOUR NAME'
}
*/


var twitter = require('../lib/twitter');
var config = require('../lib/config');

module.exports = function () {
  twitter(keys, function (err, t) {
    console.error(err);
    throw new Error('TODO');
  })
}

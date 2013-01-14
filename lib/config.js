/**

App credentials have to be stored somewhere. TTytter said it better than me:
# yes, this is plaintext. obfuscation would be ludicrously easy to crack,
# and there is no way to hide them effectively or fully in a Perl script.
# so be a good neighbour and leave this the fark alone, okay? stealing
# credentials is mean and inconvenient to users. this is blessed by
# arrangement with Twitter. don't be a d*ck. thanks for your cooperation

If you care about security, you will want to use your own:
Run "ttc help keys" for more information

*/

var path = require('path');
var fs = require('fs');

var home_directory = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

var config = module.exports = {
  data: {
    access_token_key: null,
    access_token_secret: null,
    consumer_key: "OiDU6XJcOvEBjq3BBncMRw",
    consumer_secret: "zMWayH7fIGiTumqtDqfwY5Jqym8ocGx1AuNtMoBadg"
  },
  file: home_directory ? path.join(home_directory, '.ttc.json') : null,
  load: load,
  save: save,
  loaded: false
};

function load (force) {
  if (!config.file) return false;
  if (config.loaded && !force) return false;

  var user_config;
  try {
    user_config = require(config.file);
  } catch (e) {
    if (e.code != 'MODULE_NOT_FOUND') {
      throw e;
    }
  }

  if (!user_config) return false;

  for (var option in user_config) {
    if (user_config.hasOwnProperty(option)) {
      config.data[option] = user_config[option];
    }
  }

  return true;
}

function save () {
  if (!config.file) throw new Error('Config file could not be guessed');
  fs.writeFileSync(config.file, JSON.stringify(config.data, null, '  '));
}

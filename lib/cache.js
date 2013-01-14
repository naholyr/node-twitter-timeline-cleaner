var path = require('path');
var fs = require('fs');

var home_directory = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

// Cannot guess home directory: disable cache
if (!home_directory) {
  module.exports = {
    enabled: false,
    get: function () {},
    set: function () {},
    clear: function () {}
  };
  return;
}

var cache_file = path.join(home_directory, '.ttc.cache');

var cache_data;
try {
  cache_data = JSON.parse(fs.readFileSync(cache_file));
} catch (e) {
  cache_data = {};
}

module.exports = {
  enabled: true,
  get: function (key, default_value) {
    if (!this.enabled) return default_value;
    return cache_data[String(key)] || default_value;
  },
  set: function (key, value, save) {
    if (!this.enabled) return;
    cache_data[String(key)] = value;
    if (save) this.save();
  },
  clear: function (key, save) {
    if (!this.enabled) return;
    delete cache_data[key];
    if (save) this.save();
  },
  save: function () {
    if (!this.enabled) return;
    fs.writeFileSync(cache_file, JSON.stringify(cache_data));
  }
};

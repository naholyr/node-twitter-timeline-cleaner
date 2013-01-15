
var fs = require('fs');

var Command = require('commander').Command;
var color = require('../lib/color');
var cache = require('../lib/cache');
var Table = require('cli-table');

module.exports = function () {
  var command = arguments[arguments.length - 1];

  if (command.info) {
    console.error();
    console.error(color.title('Cache information:'));
    console.error();

    var file = cache.file;
    console.error('  Path: %s', file);
    var stat = fs.statSync(file);
    console.error('  Size: %d Kb', Math.round(stat.size / 1024));
    var table = new Table(['Key', 'Size']);
    cache.keys().forEach(function (k) {
      var s = JSON.stringify(cache.get(k)).length;
      table.push([k, Math.round(s/1024) + ' Kb']);
    });
    console.error(table.toString());
  }

  if (command.reset) {
    console.error();
    console.error(color.title('Reset cache:'));
    console.error();
    console.error('  You\'re about to clear local cache');
    console.error('  Note: your cache contains some history, so we can work on more data.');
    console.error(color.warning('  next stats will be limited to ~800 messages'));
    console.error();
    command.prompt(color.bold('Are you sure you want to reset your cache [y|N]') + ': ', function (c) {
      console.error();
      if (!c.match(/^(Y|YES|1)$/i)) {
        console.error(color.error('  Cancelled by user'));
      } else {
        cache.reset();
        console.error(color.success('  Cache cleared'));
      }
      process.exit(0);
    });
  }

  else if (command.remove) {
    console.error();
    console.error(color.title('Remove cache key:'));
    console.error();
    console.error('  You\'re about to delete a key from your local cache');
    console.error(color.warning('  You should continue only if you know what you\'re doing'));
    console.error('  If you have unexplained bugs and try to fix it, maybe you should reset the whole cache');
    console.error();

    var data = cache.get(command.remove);
    if (!data) {
      console.error(color.error('Key "' + command.remove + '" not found.'));
      process.exit(1);
    } else {
      console.error(color.title('Key information:'));
      console.error();
      console.error('  Name: %s', command.remove);
      console.error('  Size: %s Kb', Math.round(JSON.stringify(data).length / 1024));
      console.error();
    }

    command.prompt(color.bold('Are you sure you want to clear key "' + command.remove + '" [y|N]') + ': ', function (c) {
      console.error();
      if (!c.match(/^(Y|YES|1)$/i)) {
        console.error(color.error('  Cancelled by user'));
        process.exit(127);
      } else {
        cache.clear(command.remove);
        console.error(color.success('  Key removed from cache'));
        process.exit(0);
      }
    });
  }

  if (!command.reset && !command.remove) {
    // no prompt: exit now
    process.exit(0);
  }
}


var Command = require('commander').Command;

var package = require('./package.json');
var config = require('./lib/config');
var cache = require('./lib/cache');

module.exports = (new Command)
  .version(package.version)
  .description('Twitter Timeline Cleaner')
  .option('--config <file>', 'Custom configuration file', config.file)
  .option('--no-cache', 'Disable cache')
  .on('config', function (file) {
    config.file = file;
  })
  .on('cache', function (enabled) {
    cache.enabled = !!enabled;
  })
  .usage('[ttc_options] <command> [command_options]')
  // Help
  .command('help')
    .description('Help for specified command')
    .usage('<command_name>')
    .action(require('./cli/help'))
    .parent
  // Stats
  .command('stats')
    .description('Show statistics about your timeline')
    .option('--no-cache-dms', 'Cache direct messages')
    .option('--offline', 'Do not connect to Twitter: work from cache data only')
    .action(require('./cli/stats'))
    .parent
  // Check status
  .command('status')
    .description('Show app\'s status (i.e. rate limit)')
    .action(require('./cli/status'))
    .parent
  // Security
  .command('keys')
    .description('Update app\'s credentials to use your own (browse https://dev.twitter.com/apps/new to create it)')
    .usage('<options>')
    .option('--reset-access', 'Reset your access token (always enabled if key/secret is provided)')
    .option('--key <consumer_key>', 'Consumer key')
    .option('--secret <consumer_secret>', 'Consumer secret')
    .option('--no-store', 'Do not update user configuration')
    .option('--no-check', 'Do not check credentials')
    .action(require('./cli/keys'))
    .parent
  // Test connection
  .command('test')
    .description('Test connection to Twitter')
    .action(require('./cli/test'))
    .parent
  // Cache management
  .command('cache')
    .description('Manage your local cache')
    .option('--no-info', 'Skip information table')
    .option('--reset', 'Reset local cache')
    .option('--remove <key>', 'Reset local cache')
    .action(require('./cli/cache'))
    .parent

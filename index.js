
var Command = require('commander').Command;

var package = require('./package.json');
var config = require('./lib/config');


module.exports = (new Command)
  .version(package.version)
  .description('Twitter Timeline Cleaner')
  .option('-c, --config <file>', 'Custom configuration file', config.file)
  .on('config', function (file) {
    config.file = file;
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
    .action(require('./cli/stats'))
    .parent
  // Security
  .command('keys')
    .description('Update app\'s credentials to use your own (browse https://dev.twitter.com/apps/new to create it)')
    .usage('--key <…> --secret <…> [options]')
    .option('--key <consumer_key>', 'Consumer key')
    .option('--secret <consumer_secret>', 'Consumer secret')
    .option('--no-store', 'Do not update user configuration')
    .option('--no-check', 'Do not check credentials')
    .action(require('./cli/keys'))
    .parent

var package = require('./package.json');

module.exports = require('commander')
  .version(package.version)
  .description('Twitter Timeline Cleaner')
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

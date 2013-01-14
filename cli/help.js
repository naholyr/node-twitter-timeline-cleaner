
var Command = require('commander').Command;
var color = require('../lib/color');

module.exports = function (name, command) {
  if (arguments.length !== 2) {
    arguments[arguments.length - 1].help();
  }
  var task = command.parent.commands.filter(function (task) {
    return task._name === name;
  })[0];
  if (!task) {
    console.error();
    console.error(color.error('  Command "%s", unknown'), name);
    console.error();
    console.error('  Note: Run "%s" with no option to list existing commands', command.parent._name);
    command.help();
  }
  console.error();
  console.error(color.title('  %s %s') + ':', task.parent._name, task._name)
  console.error(color.bold('    %s'), task.description());
  task.help();
}

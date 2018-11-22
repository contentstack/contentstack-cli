/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/*!
 * Module dependencies
 */

var prompt = require('prompt');
var os = require('os');
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var log = console.log;
var success = chalk.green;
var error = chalk.red;
var info = chalk.cyan;

var helper = require('./helper');

/**
 * Create contentstack-express framework plugin
 */
var Plugin = function(name) {
  try {
    var dir = path.join(process.cwd(), 'plugins');
    var match = (name && typeof name == 'string') ? name.match(
      /^[a-zA-Z0-9\-_]+$/g) : null;
    if (match && match.length) {
      name = name.trim().toLowerCase();
      if (fs.existsSync(dir)) {
        var _path = path.join(dir, name);
        log(info(`Creating Contentstack plugin at ${_path}`));
        prompt.message = '';
        prompt.delimiter = '>';
        (function createPlugin(path, name) {
          helper.emptyDirectory(path, function(err, empty) {
            if (err) {
              helper.abort(err);
            } else if (empty) {
              createPluginAt(path, name);
            } else {
              prompt.get([{
                name: 'confirm',
                description: 'Destination is not empty, continue? (Yes/No):',
                message: 'Please provide confirmation.',
                required: true,
                conform: function(value) {
                  value = value.toLowerCase();
                  return (value == 'yes' || value == 'no');
                },
                before: function(value) {
                  return value.toLowerCase();
                }
              }], function(error, result) {
                if (error) {
                  throw error;
                }
                var ok = (result.confirm == 'yes') ? true : false;
                if (ok) {
                  process.stdin.destroy();
                  return createPluginAt(path, name);
                }
                return helper.abort('aborting setup..');
              });
            }
          });
        })(_path, name);
      } else {
        helper.abort('This command should be run from your application folder, where \'plugins\' folder exists.');
      }
    } else {
      helper.abort('Plugin name is not valid. Only \'alphabets\', \'numbers\', \'hyphens\' and \'underscores\' are allowed.');
    }
  } catch (err) {
    log(error(`Errorred while creating plugin!\n${err.message || err}`));
  }
};

var eol = 'win32' === os.platform() ? '\r\n' : '\n';

var pluginTemplate = function (_name, pluginName) {
  return ['/*!',
    ' * '+_name,
    ' */',
    '',
    ' "use strict";',
    '',
    '/*!',
    ' * Module dependencies',
    ' */',
    'var contentstack =  require(\'contentstack-express\');',
    '',
    'module.exports = function ' + pluginName + '() {',
    '',
    '   /*',
    '    * ' + pluginName + '.options provides the options provided in the configuration.',
    '    */',
    '',
    '   var options = ' + pluginName + '.options;',
    '',
    '   /*',
    '    * @templateExtends',
    '    * @Description: Allows to extend the template engine functionality such as adding filters, macros etc.',
    '    * @Parameter: engine - template engine object',
    '    * @Example: using Nunjucks',
    '           ' + pluginName + '.templateExtends = function(engine) {',
    '               // engine loader, setting filters etc.',
    '               engine.getEnvironment().addFilter("shorten", function(str, count) {',
    '                   return str.slice(0, count || 5);',
    '               });',
    '           };',
    '    * @Usage: template file',
    '           A message for you: {{ message | shorten }}',
    '    */',
    '   ' + pluginName + '.templateExtends = function(engine) {',
    '   };',
    '',
    '   /*',
    '    * @serverExtends',
    '    * @Description: Allows to extend the server capabilities by adding a new or modifing the existing routes/middlewares.',
    '    * @Parameters: app, contentstack express instance.',
    '    * @Example:',
    '           ' + pluginName + '.serverExtends = function(app) {',
    '               app',
    '                   .use(function(req, res, next){',
    '                       // your code goes here',
    '                       next();',
    '                   });',
    ' ',
    '               app',
    '                   .extends()',
    '                   .get(\'/test\', function(req, res, next){',
    '                       // your code goes here',
    '                       next();',
    '                   });',
    '           };',
    '    */',
    '   ' + pluginName + '.serverExtends = function(app) {',
    '   };',
    '  ',
    '   /*',
    '    * @beforePublish',
    '    * @Description: This function is triggered when the publish event occurs.',
    '    * @Parameters: data - contains published entry, it\'s content_type and language.',
    '    * @Parameters: next - call this function to pass control to the next subsequent "beforePublish" hook.',
    '    *              It is important to call the next() function, it will affect the publish process,',
    '    *              the entry will get stuck to "in-prgoress" state.',
    '    * @Example:',
    '           ' + pluginName + '.beforePublish = function(data, next) {',
    '               *',
    '               * var entry = data.entry;',
    '               * var contentType = data.contentType;',
    '               * var language = data.language;',
    '               *',
    '           };',
    '    */',
    '   ' + pluginName + '.beforePublish = function (data, next) {',
    '       next();',
    '   };',
    '  ',
    '   /*',
    '    * @beforeUnpublish',
    '    * @Description: This function is triggered when the unpublish or delete event occurs.',
    '    * @Parameters: data - contains un-published entry, it\'s content_type and language.',
    '    * @Parameters: next - call this function to pass control to the next subsequent "beforeUnpublish" hook.',
    '    *              It is important to call the next() function, it will affect the unpublish process,',
    '    *              the entry will get stuck to "in-prgoress" state.',
    '    * @Example:',
    '           ' + pluginName + '.beforeUnpublish = function(data, next) {',
    '               *',
    '               * var entry = data.entry;',
    '               * var contentType = data.contentType;',
    '               * var language = data.language;',
    '               *',
    '           };',
    '    */',
    '   '+ pluginName + '.beforeUnpublish = function (data, next) {',
    '       next();',
    '   };',
    '};'
  ].join(eol);
};

/**
 * Contentstack express application package.json details
 * @param  {String} name : Name of the application
 */
var packageJSON = function(name) {
  return [
    '{', '  "name": "' + name + '",', '  "version": "0.0.1",',
    '  "main": "index.js"', '}'
  ].join(eol);
};

/**
 * Create plugin at destination path
 * @param  {String} path : Destination path
 * @param  {String} name : Name of the plugin
 */
var createPluginAt = function(path, name) {
  log(info(`Creating plugin '${name}' at '${path}'`));
  helper.mkdir(path, function() {
    helper.write(path + '/index.js', pluginTemplate(name, pluginName(name)));
    helper.write(path + '/package.json', packageJSON(name));
    log(success('================================================'));
    log(success('Please add your plugin in config to activate it.'));
    log(success('================================================'));
  });
};

/**
 * Sanitize plugin name
 * @param  {String} _plugin : Plugin name to be sanitized
 * @return {String}         : Sanitized plugin name
 */
function pluginName(_plugin) {
  var subNames = _plugin.replace(/-/g, '_').split('_');
  var name = '';
  name = subNames.reduce(function(previous, current) {
    if (current) {
      previous += current.charAt(0).toUpperCase() + current.slice(1);
    }
    return previous;
  }, '');
  return name;
}

module.exports = Plugin;

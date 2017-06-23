/*!
 * contentstack-cli
 * copyright (c) Built.io Contentstack
 * MIT Licensed
 */

'use strict';

/*!
 * Module dependencies
 */

var prompt = require('prompt'),
    os = require('os'),
    fs = require('fs'),
    path = require('path'),
    config = require('./config').config(),
    mkdirp = require('mkdirp');

/*
* Application
* */
var helper = require('./helper');

var Plugin = function (name) {
    try {
        var dir = path.join(process.cwd(), 'plugins'),
            match = (name && typeof name == "string") ? name.match(/^[a-zA-Z0-9\-_]+$/g) : null;
        if (match && match.length) {
            name = name.trim().toLowerCase();
            if (fs.existsSync(dir)) {
                var _path = path.join(dir, name);
                console.log('Creating Built.io Contentstack plugin at : ' + _path);
                prompt.message = "";
                prompt.delimiter = "";
                (function createPlugin(path, name) {
                    helper.emptyDirectory(path, function (err, empty) {
                        if(err){
                            helper.abort(err);
                        }else if (empty) {
                            createPluginAt(path, name);
                        } else {
                            prompt.get([{
                                name: 'confirm',
                                description: 'Destination is not empty, continue? (Yes/No):',
                                message: 'Please provide confirmation.',
                                required: true,
                                conform: function (value) {
                                    value = value.toLowerCase();
                                    return ( value == "yes" || value == "no" );
                                },
                                before: function (value) {
                                    return value.toLowerCase();
                                }
                            }], function (err, result) {
                                if(err) throw err;
                                var ok = (result.confirm == "yes") ? true : false;
                                if (ok) {
                                    process.stdin.destroy();
                                    createPluginAt(path, name);
                                } else {
                                    helper.abort('aborting');
                                }
                            });
                        }
                    });
                })(_path, name);
            } else {
                helper.abort("This command should be run from your application folder, where plugins folder exists.");
            }
        } else {
            helper.abort("Plugin name is not valid. Only Alphabets, Numbers, Hyphens and Underscores are allowed.");
        }
    } catch (err) {
        console.error("Error in plugin: ", err.stack);
    }
}

var eol = 'win32' == os.platform() ? '\r\n' : '\n';

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
        'module.exports = function '+pluginName+'() {',
        '',
        '   /*',
        '    * '+pluginName+'.options provides the options provided in the configuration.',
        '    */',
        '',
        '   var options = '+pluginName+'.options;',
        '',
        '   /*',
        '    * @templateExtends',
        '    * @Description: Allows to extend the template engine functionality such as adding filters, macros etc.',
        '    * @Parameter: engine - template engine object',
        '    * @Example: using Nunjucks',
        '           '+pluginName+'.templateExtends = function(engine) {',
        '               // engine loader, setting filters etc.',
        '               engine.getEnvironment().addFilter("shorten", function(str, count) {',
        '                   return str.slice(0, count || 5);',
        '               });',
        '           };',
        '    * @Usage: template file',
        '           A message for you: {{ message | shorten }}',
        '    */',
        '   '+pluginName+'.templateExtends = function(engine) {',
        '   };',
        '',
        '   /*',
        '    * @serverExtends',
        '    * @Description: Allows to extend the server capabilities by adding a new or modifing the existing routes/middlewares.',
        '    * @Parameters: app, contentstack express instance.',
        '    * @Example:',
        '           '+pluginName+'.serverExtends = function(app) {',
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
        '   '+pluginName+'.serverExtends = function(app) {',
        '   };',
        '  ',
        '   /*',
        '    * @beforePublish',
        '    * @Description: This function is triggered when the publish event occurs.',
        '    * @Parameters: data - contains published asset, entry, it\'s content_type and language.',
        '    * @Parameters: next - call this function to pass control to the next subsequent "beforePublish" hook.',
        '    *              It is important to call the next() function, it will affect the publish process,',
        '    *              the entry will get stuck to "in-prgoress" state.',
        '    * @Example:',
        '           '+pluginName+'.beforePublish = function(data, next) {',
        '               *',
        '               * var entry = data.entry;',
        '               * var contentType = data.contentType;',
        '               * var language = data.language;',
        '               *',
        '           };',
        '    */',
        '   '+pluginName+'.beforePublish = function (data, next) {',
        '       next();',
        '   };',
        '  ',
        '   /*',
        '    * @beforeUnpublish',
        '    * @Description: This function is triggered when the unpublish or delete event occurs.',
        '    * @Parameters: data - contains un-published asset, entry, it\'s content_type and language.',
        '    * @Parameters: next - call this function to pass control to the next subsequent "beforeUnpublish" hook.',
        '    *              It is important to call the next() function, it will affect the unpublish process,',
        '    *              the entry will get stuck to "in-prgoress" state.',
        '    * @Example:',
        '           '+pluginName+'.beforeUnpublish = function(data, next) {',
        '               *',
        '               * var entry = data.entry;',
        '               * var contentType = data.contentType;',
        '               * var language = data.language;',
        '               *',
        '           };',
        '    */',
        '   '+pluginName+'.beforeUnpublish = function (data, next) {',
        '       next();',
        '   };',
        '};'
    ].join(eol);
};

var packageJSON = function (_name) {
    return [
        '{'
        , '  "name": "' + _name + '",'
        , '  "version": "0.0.1",'
        , '  "main": "index.js"'
        , '}'
    ].join(eol);
};

var createPluginAt = function (path, name) {
    console.log("Creating '" + name + "' plugin.");
    helper.mkdir(path, function () {
        helper.write(path + '/index.js', pluginTemplate(name, pluginName(name)));
        helper.write(path + '/package.json', packageJSON(name));
        console.info('================================================');
        console.info('Please add your plugin in config to activate it.');
        console.info('================================================');
    });
}

function pluginName(_plugin) {
    var subNames = _plugin.replace(/\-/g, '_').split('_'),
        name = "";
    name = subNames.reduce(function(previous, current, index) {
        if(current) previous+=current.charAt(0).toUpperCase() + current.slice(1);
        return previous;
    }, "");
    return name;
};

module.exports = Plugin;

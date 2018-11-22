#!/usr/bin/env node
/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/*!
 * Module dependencies
 */
var domain = require('domain'),
    program = require('commander'),
    path = require('path'),
    helper = require('./../lib/helper');

/*
* Application defined variables
* */
var messages = [
        '\t     \x1b[33m**'
        , '   \x1b[33m***'
        , ' \x1b[33m****'
        , '\x1b[33m***** \x1b[31m**'
        , ' \x1b[33m****  \x1b[31m***        Contentstack'
        , '   \x1b[33m***  \x1b[31m****'
        , '     \x1b[33m** \x1b[31m*****'
        , '        \x1b[31m****'
        , '       \x1b[31m***'
        , '      \x1b[31m**'
    ].join("\n\t"),
    pkg = require('./../package.json');

function list(val) {
    return ((val && val.length) ? val.split(',').map(String) : undefined);
}

function getDefaultOptions (opts, events) {
    var opt = {};
    for(var key in events) {
        opt[key] = updateDefaultOption(opts, key);
    }
    return opt;
}

function updateDefaultOption (opts, key) {
    if(~['content_types', 'skip_content_types'].indexOf(key) && opts[key] === true) {
        opts[key] = [];
    } else if('backup' === key && opts[key] === true) {
        opts[key] = 'yes';
    } else if('type' === key && opts[key] === true) {
        opts[key] = 'all';
    } else if('language' === key && opts[key] === true) {
        opts[key] = 'en-us';
    } else if('datetime' === key && opts[key] === true) {
        opts[key] = new Date('1970').toISOString();
    }
    return opts[key];
}

function optionConversion(options) {
    var _options = {
        environment: options.env,
        language: options.lang
    };
    options.language = options._events.language = true;
    options.environment = options._events.environment = _options.environment;
    delete options.env;
    delete options.lang;
    delete options._events.env;
    delete options._events.lang;
    return _options;
}
// printing the Contentstack Animation
console.log('\n'+messages+'\x1b[0m\n');
console.log('\x1b[31m Note: This version of Contentstack cli can be used only for v3 stacks. Use cli v1.x, for v2 stacks.\x1b[0m\n');

program
    .version(pkg.version || "0.1.x");

program
    .command('connect [directory] [api_key] [access_token] [template]')
    .option('-d, --dir <directory>', 'Enter the name of "Directory"')
    .option('-a, --api_key <api_key>', 'Enter the stack "API KEY" to connect')
    .option('-c, --token <access_token>', 'Enter the "Access Token" relative to "API KEY"')
    .option('-t, --template [template]', 'Enter the template', 'basic')
    .description('Connect to an existing stack in Contentstack.')
    .action(function(directory, api_key, access_token, template, options) {
        setImmediate(function () {
            //creating the domain to execute in safe mode
            var context = domain.create();
            // error handling in domain
            context.on('error', errorHandler);

            // running the connect in domain
            context.run(function() {
                try {
                    var connect = require('../lib/connect');
                } catch (error) {
                    console.error(error)
                }
                var args = {
                    directory: directory || options.dir,
                    api_key: api_key || options.api_key,
                    access_token: access_token || options.token,
                    template: 'basic' || options.template
                };
                new connect(args);
            });
        });
    });

program
    .command('plugin create')
    .alias('plugin create')
    .description('Create a new plugin in the current application')
    .action(function (path, directory) {
        setImmediate(function() {
            var context = domain.create();

            // error handling in domain
            context.on('error', errorHandler);

            // running the plugin in domain
            context.run(function() {
                var plugin = require('./../lib/plugin');
                new plugin(directory);
            });
        });
    });

program
    .command('sync')
    .option('-e, --env <environment>', 'Enter the environment of which the content needs to be synchronized', undefined)
    .option('-t, --type [type]', 'Enter a type of content to include in publishing [content_types/assets/all]', /(content_types|assets|all)/, undefined)
    .option('-l, --lang [language]', 'Enter the language of which the content needs to be synchronized', undefined)
    .option('-c, --content_types [content_types]', 'Enter the content types to be included in synchronization (comma(",") seperated)', list, undefined)
    .option('-s, --skip_content_types [skip_content_types]', 'Enter the content types to be excluded from synchronization (comma(",") seperated)', list, undefined)
    .option('-d, --datetime [datetime]', 'Enter start date in ISO String format. Content published after this date will be synchronized (skip for all content)', undefined)
    .option('-b, --backup [backup]', 'Enter backup option', /(yes|no|y|n)/i, undefined)
    .description('Synchronize the previously published entries in the current application')
    .action(function (options) {
        setImmediate(function() {
            var context = domain.create();

            // error handling in domain
            context.on('error', errorHandler);

            // running the synchronization in domain
            context.run(function() {
                var _options = optionConversion(options);
                _options = helper.merge(getDefaultOptions(options, options._events), _options);
                var sync = require('./../lib/sync');
                new sync(_options);
            });
        });
    });

/*
 * command for bulk publish
 * */

program
    .command('publish')
    .alias('bulk-publish')
    .option('-u, --username <username>', 'Email id registered on Contentstack', undefined)
    .option('-p, --password <password>', 'Password', undefined)
    .option('-e, --env <environment>', 'Environment/s where you want to publish (comma(",") seperated)', list, undefined)
    .option('-b, --backup [backup]', 'Enter backup option', /(yes|no|y|n)/i, undefined)
    .option('-t, --type [type]', 'Enter a type of content to include in publishing [content_types/assets/all]', /(content_types|assets|all)/, undefined)
    .option('-c, --content_types [content_types]', 'Enter the content types to be included (comma(",") seperated)', list, undefined)
    .option('-s, --skip_content_types [skip_content_types]', 'Enter the content types to be excluded (comma(",") seperated)', list, undefined)
    .option('-l, --lang [language]', 'Enter the language where content should be published', undefined)
    .description('Publish content-types/assets/both on specified environment/s')
    .action(function (options) {
        setImmediate(function() {
            var context = domain.create();

            // error handling in domain
            context.on('error', errorHandler);
            // running the synchronization in domain
            context.run(function() {
                var _options = optionConversion(options);
                _options = helper.merge(getDefaultOptions(options, options._events), _options);
                try {
                    var publish = require('./../lib/publish');
                } catch (error) {
                    console.error(error)
                }
                new publish('publish', _options);
            });
        });
    });

/*
 * command for bulk unpublish
 * */

program
    .command('unpublish')
    .alias('bulk-unpublish')
    .option('-u, --username <username>', 'Email id registered on Contentstack', undefined)
    .option('-p, --password <password>', 'Password', undefined)
    .option('-e, --env <environment>', 'Environment/s where you want to unpublish (comma(",") seperated)', list, undefined)
    .option('-b, --backup [backup]', 'Enter backup option', /(yes|no|y|n)/i, undefined)
    .option('-t, --type [type]', 'Enter a type of content to include in unpublishing [content_types/assets/all]', /(content_types|assets|all)/, undefined)
    .option('-c, --content_types [content_types]', 'Enter the content types to be included (comma(",") seperated)', list, undefined)
    .option('-s, --skip_content_types [skip_content_types]', 'Enter the content types to be excluded (comma(",") seperated)', list, undefined)
    .option('-l, --lang [language]', 'Enter the language where content should be unpublished', undefined)
    .description('Unpublish content-types/assets/both on specified environment/s')
    .action(function (options) {
        setImmediate(function() {
            var context = domain.create();

            // error handling in domain
            context.on('error', errorHandler);

            // running the synchronization in domain
            context.run(function() {
                var _options = optionConversion(options);
                _options = helper.merge(getDefaultOptions(options, options._events), _options);
                var unpublish = require('./../lib/publish');
                new unpublish('unpublish', _options);
            });
        });
    });

// parse the input arguments
program.parse(process.argv);

// show help by default if no args
if (program.args.length == 0) {
    var message = [
        'Contentstack Command Line Interface '+pkg.version
        , '\nUsage: contentstack [command]'
        , '\nCommands:'
        , '    connect            Connect to an existing stack in Contentstack'
        , '    sync               Synchronize the previously published entries in the current application'
        , '    publish            Publish content-types/assets/both on specified environment'
        , '    unpublish          Unpublish content-types/assets/both on specified environment'
        , '    plugin create      Create the new plugin in the current application'
        , '\nOptions:'
        , '    -h, --help     output usage information'
        , '    -V, --version  output the version number'
        , '\nDocumentation can be found at https://contentstackdocs.built.io/'
    ].join('\n');
    process.exit(1);
}
/*
* Error Handler to handle the domain level error
* */
function errorHandler(err) {
    console.error(err.message);
}

process.on('uncaughtException', function(err) {
    console.error('Caught exception: ', err.message);
    process.exit(0);
});

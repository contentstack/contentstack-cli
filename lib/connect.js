/*!
 * contentstack-cli
 * copyright (c) Built.io Contentstack
 * MIT Licensed
 */

'use strict';

/*!
 * Module dependencies
 */

var _path = require('path'),
    async = require('async'),
    prompt = require('prompt'),
    exec = require('child_process').exec,
    os = require('os'),
    _ = require('lodash'),
    pkg = require('./../package.json');

/*
 * Application variable
 * */
var utility = require('./utils'),
    utility = new utility(true),
    request = require('./request'),
    helper = require("./helper"),
    config = require('./config').getDefault(),
    api = config.get('contentstack'),
    inputs = {},
    port = 4000,
    regexp = new RegExp('[^a-zA-Z0-9_\-]', 'g');

/*
 *  Templates for creating files.
 */
var platform = os.platform(),
    eol = 'win32' == platform ? '\r\n' : '\n',
    storage = config.get('storage'),
    csVersion = "3.0.0";

var appTemplate = [
    'var contentstack = require("contentstack-express"),'
    , '    app = contentstack(),'
    , '    config = contentstack.config,'
    , '    server = config.get("server"),'
    , '    environment = config.get("environment"),'
    , '    port = process.env.PORT || config.get("port");'
    , ' '
    , '/**'
    , '* start the application'
    , '*/'
    , ''
    , 'app.listen(port, function() {'
    , '    console.log("Server(%s) is running on \'%s\' environment over %d port", server, environment, port);'
    , '});'
].join(eol);

var packageJSON = function () {
    var _startCommand = '';
    (inputs.selected_environment && inputs.selected_environment != "development") ? (platform == 'win32') ? _startCommand += 'set NODE_ENV=' + inputs.selected_environment + '&&' : _startCommand += 'NODE_ENV=' + inputs.selected_environment + ' ' : '';
    (inputs.selected_server && inputs.selected_server != "default") ? (platform == 'win32') ? _startCommand += 'set SERVER=' + inputs.selected_server + '&&' : _startCommand += 'SERVER=' + inputs.selected_server + ' ' : '';
    _startCommand += 'node app.js';
    return [
        '{'
        , '    "name": "' + inputs.site_title + '",'
        , '    "version": "0.0.1",'
        , '    "dependencies": {'
        , '        "contentstack-express": "^' + csVersion + '"'
        , '    },'
        , '    "scripts": {'
        , '        "start": "' + _startCommand + '"'
        , '    }'
        , '}'
    ].join(eol);
};

var configTemplate = function () {
    return [
        'module.exports = exports = {'
        , '    port: "' + port + '",'
        , '    theme: "' + inputs.template + '",'
        , '    languages: ['
        , '        {'
        , '            "code": "' + inputs.site_master_language + '",'
        , '            "relative_url_prefix": "/"'
        , '        }'
        , '    ],'
        , '    plugins: {},'
        , '    contentstack: {'
        , '        api_key: "' + inputs.api_key.trim() + '",'
        , '        access_token: "' + inputs.access_token.trim() + '"'
        , '    }'
        , '};'
    ].join(eol);
};

var layoutHTML = [
    '<!DOCTYPE HTML>'
    , '<html>'
    , '<head>'
    , '    <title>{{entry.title}}</title>'
    , '    <link type="text/css" rel="stylesheet" href="/static/css/style.css">'
    , '    <script type="text/javascript" src="/static/js/script.js"></script>'
    , '</head>'
    , '<body>'
    , '    {% include "partials/header.html" %}'
    , ''
    , '    {% block content %}{% endblock %}'
    , ''
    , '    {% include "partials/footer.html" %}'
    , '</body>'
    , '</html>'
].join(eol);

var headerHTML = [
    '{# If you have a "Content Type" for header in Built.io Contentstack then use get() view helper to retrieve header entry. #}'
    , '{# e.g. set header = get("header_content_type_id") #}'
    , '{# And then render header values using the {{header.field_name}} #}'
].join(eol);

var footerHTML = [
    '{# If you have a "Content Type" for footer in Built.io Contentstack then use get() view helper to retrieve footer entry. #}'
    , '{# e.g. set footer = get("footer_content_type_id") #}'
    , '{# And then render footer values using the {{footer.field_name}} #}'
].join(eol);

var sampleCSS = [
    'html{background-color:#e6e9e9}'
    , 'body{margin:0 auto;padding:2em 2em 4em;max-width:800px;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5em;color:#545454;background-color:#fff;box-shadow:0 0 2px rgba(0,0,0,.06)}'
    , 'a{color:#0083e8}'
    , 'b,strong{font-weight:600}'
    , 'img{background:0 0;border:10px solid rgba(0,0,0,.12);border-radius:4px;display:block;max-width:95%}'
    , '.group-field{padding: 20px 20px 0 20px; border-bottom: 1px solid #d9dbdb; word-wrap: break-word;}'
    , '.group-field:last-child{border-bottom: 0;}'
    , '.key{font-weight: bold}'
    , '.field{margin-bottom: 20px;}'
    , 'p{margin: 0;}'
].join(eol);

var createApplicationAt = function () {
    var path = inputs.directory.replace(regexp, '-'),
        skeleton = inputs.template;

    console.log("\n\x1b[36mCreating a " + skeleton + " theme...\n");
    helper.mkdir(path, function () {
        helper.write(path + '/app.js', appTemplate);
        helper.write(path + '/package.json', packageJSON());
        helper.write(path + '/.gitignore', ['_logs/', '_content/', 'node_modules/'].join(eol));
        helper.mkdir(path + '/config', function () {
            helper.write(path + '/config/all.js', configTemplate());
        });
        if (storage.provider.toLowerCase() === 'filesystem') {
            helper.mkdir(path + storage.options.basedir.replace("./", "/"), function () {
            });
        }
        helper.mkdir(path + '/_logs', function () {
        });
        helper.mkdir(path + '/plugins', function () {
        });
        helper.mkdir(path + '/themes/' + skeleton, function () {
            helper.mkdir(path + '/themes/' + skeleton + '/public', function () {
                helper.mkdir(path + '/themes/' + skeleton + '/public/js', function () {
                    helper.write(path + '/themes/' + skeleton + '/public/js/script.js', '// add your code here');
                });
                helper.mkdir(path + '/themes/' + skeleton + '/public/css', function () {
                    helper.write(path + '/themes/' + skeleton + '/public/css/style.css', sampleCSS);
                });
            });
            helper.mkdir(path + '/themes/' + skeleton + '/templates', function () {
                helper.mkdir(path + '/themes/' + skeleton + '/templates/layouts', function () {
                    helper.write(path + '/themes/' + skeleton + '/templates/layouts/default.html', layoutHTML);
                });
                helper.mkdir(path + '/themes/' + skeleton + '/templates/partials', function () {
                    helper.write(path + '/themes/' + skeleton + '/templates/partials/header.html', headerHTML);
                    helper.write(path + '/themes/' + skeleton + '/templates/partials/footer.html', footerHTML);
                });
                helper.mkdir(path + '/themes/' + skeleton + '/templates/pages', function () {
                    // changing the directory to given path for npm install
                    var _chdir = _path.join(process.cwd(), path);
                    setTimeout(function () {
                        console.log('\n\x1b[36mRunning \x1b[33mnpm install \x1b[36min the directory \x1b[33m%s \x1b[36m[%s] to install the required dependencies. If this fails, try running the command yourself.', path, _chdir);
                        process.chdir(_chdir);
                        exec("npm install", function (error, stdout, stderr) {
                            console.log("\x1b[0m", stdout);
                            var nextSteps = [
                                {
                                    info: "Change directory to your site",
                                    cmd: "cd " + path
                                }, {
                                    info: "Run your site",
                                    cmd: "npm start"
                                }
                            ];
                            if (error !== null) {
                                console.error('\x1b[31m', error.message);
                                console.log("\x1b[0m");
                                nextSteps.splice(1, 0, {info: "Install required dependencies", cmd: "npm install"});
                            }
                            console.log("\x1b[36mNext steps:");
                            for (var i = 0, _i = nextSteps.length; i < _i; i++) {
                                console.log("\n\x1b[36m  %d. %s", (i + 1), nextSteps[i]['info']);
                                console.log("\x1b[33m     $ %s", nextSteps[i]['cmd']);
                            }
                            console.log("\n\x1b[0m");
                        });
                    }, 1000);
                });
            });
        });
    });
};

var Connect = function (args) {
    // initalise the object parameters with the arguments
    this.options = args || {};

    // initalise the headers
    this.headers = {
        "User-Agent": 'contentstack-cli/' + pkg.version
    };

    // merging the args to input
    _.merge(inputs, args);

    // initalise the connect process
    this.init();
};

Connect.prototype.init = function () {
    var self = this,
        _requests;
    prompt.start();
    prompt.message = "";
    prompt.delimiter = "";

    _requests = [
        // take stack input in case if it is not set
        function (_cb) {
            self.stackInput(_cb);
        },
        // take input of the directory
        function (_cb) {
            self.getDirectory(_cb);
        },
        // get environement from the specified stack
        function (_cb) {
            request({
                url: api.host + '/' + api.version + api.urls.environments,
                method: "POST",
                headers: self.headers,
                json: {
                    _method: "GET",
                    query: {
                        "deploy_content": true
                    }
                }
            })
                .then(function (body) {
                    if (body && body.environments) {
                        _cb(null, body.environments);
                    } else {
                        _cb(null, []);
                    }
                })
                .fail(function (error) {
                    _cb(error);
                });
        },
        // select environement from the specified
        function (environments, _cb) {
            if (environments && environments.length) {
                var _message = "\x1b[36mSelect publishing environment:";
                var environmentsLength = environments.length;
                for (var i = 0, _i = environmentsLength; i < _i; i++) {
                    if (environments[i]['servers'] && environments[i]['servers'].length == 1)
                        _message += "\x1b[36m\n(" + (i + 1) + ") " + environments[i]['name'] + " (" + environments[i]['servers'][0]['name'] + ")";
                    else
                        _message += "\x1b[36m\n(" + (i + 1) + ") " + environments[i]['name'];
                }
                _message += "\n";
                prompt.get([
                    utility.inputs.custom({
                        name: 'environment_select',
                        description: _message,
                        message: 'Please select valid option.'.red,
                        required: true,
                        conform: function (value) {
                            value = parseInt(value);
                            return (value > 0 && value <= environmentsLength);
                        }
                    })
                ], function (err, result) {
                    if (!err && result) {
                        _.merge(inputs, result);
                        inputs.selected_environment = environments[parseInt(inputs.environment_select) - 1]['name'];
                        inputs.environments = environments;
                        _cb(null, 1);
                    } else {
                        _cb(err);
                    }
                });
            } else {
                console.info('\x1b[33m\nNo publishing environment exists on %s.', helper.url, 'Please create one.');
                _cb(null, 2);
            }
        },
        // based on environment selection
        function (result, _cb) {
            switch (result) {
                case 1:
                    var _servers = inputs.environments[parseInt(inputs.environment_select) - 1]['servers'];
                    if (_servers && _servers.length > 1) {
                        var _serverMessage = "\x1b[36mThe environment \"" + inputs.selected_environment + "\" has multiple servers. Please select one.";
                        for (var i = 0, _i = _servers.length; i < _i; i++) {
                            _serverMessage += "\x1b[36m\n(" + (i + 1) + ") " + _servers[i]['name'];
                        }
                        _serverMessage += "\nChoose: ";
                        prompt.get([
                            utility.inputs.custom({
                                name: 'environment_server_select',
                                description: _serverMessage,
                                message: 'Please select valid option.'.red,
                                required: true,
                                conform: function (value) {
                                    value = parseInt(value);
                                    return (value > 0 && value <= _servers.length);
                                }
                            })
                        ], function (err, serverResult) {
                            if (!err && serverResult) {
                                _.merge(inputs, serverResult);
                                inputs.selected_server = _servers[parseInt(inputs.environment_server_select) - 1]['name'];
                                _cb();
                            } else {
                                _cb(err);
                            }
                        });
                    } else {
                        inputs.selected_server = _servers.pop()['name'];
                        _cb();
                    }
                    break;
                case 2:
                    _cb();
                    break;
            }
        }
    ];

    async.waterfall(_requests, function (err) {
        if (!err) {
            createApplicationAt();
        } else {
            console.log("Error : ", err.message);
        }
    });
};

/*
 * Get directory input from the user
 * */
Connect.prototype.getDirectory = function (done) {
    var self = this;
    inputs.directory = (inputs.directory) ? inputs.directory.toLowerCase() : inputs.directory;
    function checkDirectory() {
        helper.emptyDirectory(inputs.directory, function (err, empty) {
            if (err) {
                console.error('\n\x1b[31m', err.message, '\x1b[0m');
                inputs.directory = null;
                self.getDirectory(done);
            } else if (empty) {
                //creating the stack at given path
                done();
            } else {
                prompt.get([
                    utility.inputs.custom({
                        name: 'confirm',
                        description: '\x1b[36mThe folder "' + inputs.directory + '" already exists. Overwrite (Yes/No)?:',
                        message: 'Please provide confirmation.',
                        required: true,
                        conform: function (value) {
                            value = value.toLowerCase();
                            return (value == "yes" || value == "no");
                        },
                        before: function (value) {
                            return value.toLowerCase();
                        }
                    })
                ], function (err, result) {
                    if (!err && result) {
                        var ok = (result.confirm == "yes");
                        if (ok) {
                            done();
                        } else {
                            //if user don't want to override ask new directory name
                            inputs.directory = null;
                            self.getDirectory(done);
                        }
                    } else {
                        done(err);
                    }
                });
            }
        });
    }

    if (inputs.directory) {
        checkDirectory();
    } else {
        prompt.get([
            utility.inputs.custom({
                name: 'directory',
                description: 'Enter name of the directory to contain the project:',
                message: 'Please enter the name of the directory to contain the project.',
                required: true,
                default: inputs.site_title
            })
        ], function (err, result) {
            if (!err && result) {
                _.merge(inputs, result);
                checkDirectory();
            } else {
                done(err);
            }
        });
    }
};

/*
 * Get the stack validation
 * */
Connect.prototype.stackInput = function (done) {
    var self = this;

    function checkSite() {
        process.stdout.write('\x1b[33m\nValidating the stack...\x1b[0m');
        request({
            url: api.host + '/' + api.version + api.urls.stacks,
            method: "GET",
            headers: self.headers,
            qs: {
                "include_discrete_variables": true
            },
            json: true
        })
            .then(function (body) {
                if (body && body.stack) {
                    if (body.stack.discrete_variables && body.stack.discrete_variables._version && body.stack.discrete_variables._version >= 3) {
                        inputs.site_title = body.stack.name.toLowerCase().replace(regexp, '-');
                        inputs['site_master_language'] = body.stack.master_locale;
                        console.log('\x1b[33m Done.');
                        done();
                    } else {
                        console.log("\x1b[31m\nThe " + body.stack.name + " stack is currently on version 2 which is not supported by contentstack-express version 3. \nKindly contact support-contentstack@built.io for upgrading your Stack to version 3.\x1b[0m");
                        process.exit(0);
                    }
                } else {
                    console.log('\x1b[31m\nApi key or access token is not valid. Please retry.\x1b[0m');
                    self.options.api_key = null;
                    self.options.access_token = null;
                    self.stackInput(done);
                }
            })
            .fail(function (error) {
                console.log('\x1b[31m\nApi key or access token is not valid, Please retry.\x1b[0m');
                self.options.api_key = null;
                self.options.access_token = null;
                self.stackInput(done);
            });
    }

    if (!(self.options.api_key && self.options.access_token)) {
        prompt.get([
            utility.inputs.custom({
                name: 'api_key',
                description: 'Enter your stack api key:',
                message: 'Please enter your stack api key.',
                required: true
            }),
            utility.inputs.custom({
                name: 'access_token',
                description: 'Enter your stack access token:',
                message: 'Please enter your stack access token.',
                required: true
            })
        ], function (err, result) {
            if (!err && result) {
                _.merge(inputs, result);
                self.headers.api_key = inputs.api_key.trim();
                self.headers.access_token = inputs.access_token.trim();
                checkSite();
            } else {
                done(err);
            }
        });
    } else {
        self.headers.api_key = inputs.api_key = self.options.api_key.trim();
        self.headers.access_token = inputs.access_token = self.options.access_token.trim();
        checkSite();
    }
};

module.exports = Connect;

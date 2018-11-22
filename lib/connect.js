/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/*!
 * Module dependencies
 */

var _path = require('path');
var async = require('async');
var prompt = require('prompt');
var chalk = require('chalk');
var exec = require('child_process').exec;
var os = require('os');
var _ = require('lodash');
var pkg = require('../package.json');

var log = console.log;
var success = chalk.green;
var error = chalk.red;
var warning = chalk.yellow;
var info = chalk.cyan;

/*!
 * Application variable
 */
var utility = require('./utils');
utility = new utility(true);
var request = require('./request');
var helper = require('./helper');
var config = require('./config').getDefault();
var api = config.get('contentstack');
var inputs = {};
var port = 4000;
var regexp = new RegExp('[^a-zA-Z0-9_-]', 'g');

/*!
 * Templates for creating files.
 */
var platform = os.platform();
var eol = 'win32' == platform ? '\r\n' : '\n';
var storage = config.get('storage');
var csVersion = '3.1.9';

var appTemplate = [
  'var contentstack = require("contentstack-express"),'
  , '  app = contentstack(),'
  , '  config = contentstack.config,'
  , '  server = config.get("server"),'
  , '  environment = config.get("environment"),'
  , '  port = process.env.PORT || config.get("port");'
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
  (inputs.selected_environment && inputs.selected_environment != 'development') ? (platform == 'win32') ? _startCommand += 'set NODE_ENV=' + inputs.selected_environment + '&&' : _startCommand += 'NODE_ENV=' + inputs.selected_environment + ' ' : '';
  (inputs.selected_server && inputs.selected_server != 'default') ? (platform == 'win32') ? _startCommand += 'set SERVER=' + inputs.selected_server + '&&' : _startCommand += 'SERVER=' + inputs.selected_server + ' ' : '';
  _startCommand += 'node app.js';
  return [
    '{'
    , '  "name": "' + inputs.site_title + '",'
    , '  "version": "0.0.1",'
    , '  "dependencies": {'
    , '    "contentstack-express": "^' + csVersion + '"'
    , '  },'
    , '  "scripts": {'
    , '    "start": "' + _startCommand + '"'
    , '  }'
    , '}'
  ].join(eol);
};

var configTemplate = function () {
  return [
    'module.exports = exports = {'
    , '  port: "' + port + '",'
    , '  theme: "' + inputs.template + '",'
    , '  languages: ['
    , '    {'
    , '      "code": "' + inputs.site_master_language + '",'
    , '      "relative_url_prefix": "/"'
    , '    }'
    , '  ],'
    , '  plugins: {},'
    , '  contentstack: {'
    , '    api_key: "' + inputs.api_key.trim() + '",'
    , '    access_token: "' + inputs.access_token.trim() + '"'
    , '  }'
    , '};'
  ].join(eol);
};

var layoutHTML = [
  '<!DOCTYPE HTML>'
  , '<html>'
  , '<head>'
  , '  <title>{{entry.title}}</title>'
  , '  <link type="text/css" rel="stylesheet" href="/static/css/style.css">'
  , '  <script type="text/javascript" src="/static/js/script.js"></script>'
  , '</head>'
  , '<body>'
  , '  {% include "partials/header.html" %}'
  , ''
  , '  {% block content %}{% endblock %}'
  , ''
  , '  {% include "partials/footer.html" %}'
  , '</body>'
  , '</html>'
].join(eol);

var headerHTML = [
  '{# If you have a "Content Type" for header in Contentstack then use get() view helper to retrieve header entry. #}'
  , '{# e.g. set header = get("header_content_type_id") #}'
  , '{# And then render header values using the {{header.field_name}} #}'
].join(eol);

var footerHTML = [
  '{# If you have a "Content Type" for footer in Contentstack then use get() view helper to retrieve footer entry. #}'
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

var createApplicationAt = function() {
  var path = inputs.directory.replace(regexp, '-');
  var skeleton = inputs.template;
  log(info(`Creating a ${skeleton} theme...\n`));
  helper.mkdir(path, function() {
    helper.write(`${path}/app.js`, appTemplate);
    helper.write(`${path}/package.json`, packageJSON());
    helper.write(`${path}/.gitignore`, ['_logs/', '_content/',
      'node_modules/'
    ].join(eol));
    helper.mkdir(`${path}/config`, function() {
      helper.write(`${path}/config/all.js`, configTemplate());
    });
    if (storage.provider.toLowerCase() === 'filesystem') {
      helper.mkdir(path + storage.options.basedir.replace('./', '/'),
        function() {});
    }
    helper.mkdir(path + '/_logs', function() {});
    helper.mkdir(path + '/plugins', function() {});
    helper.mkdir(path + '/themes/' + skeleton, function() {
      helper.mkdir(path + '/themes/' + skeleton + '/public', function() {
        helper.mkdir(path + '/themes/' + skeleton + '/public/js',
          function() {
            helper.write(path + '/themes/' + skeleton +
              '/public/js/script.js', '// add your code here'
            );
          });
        helper.mkdir(path + '/themes/' + skeleton + '/public/css',
          function() {
            helper.write(path + '/themes/' + skeleton +
              '/public/css/style.css', sampleCSS);
          });
      });
      helper.mkdir(path + '/themes/' + skeleton + '/templates',
        function() {
          helper.mkdir(path + '/themes/' + skeleton +
            '/templates/layouts',
          function() {
            helper.write(path + '/themes/' + skeleton +
                '/templates/layouts/default.html', layoutHTML);
          });
          helper.mkdir(path + '/themes/' + skeleton +
            '/templates/partials',
          function() {
            helper.write(path + '/themes/' + skeleton +
                '/templates/partials/header.html', headerHTML);
            helper.write(path + '/themes/' + skeleton +
                '/templates/partials/footer.html', footerHTML);
          });
          helper.mkdir(path + '/themes/' + skeleton +
            '/templates/pages',
          function() {
            // changing the directory to given path for npm install
            var _chdir = _path.join(process.cwd(), path);
            setTimeout(function() {
              log(info(
                `Running 'npm install' at ${path}. ${_chdir} to install the required dependencies.\nIf this fails, try running the command yourself.`));
              process.chdir(_chdir);
              exec('npm install', function(error, stdout) {
                log(info(`${stdout}`));
                var nextSteps = [{
                  info: 'Change directory to your site',
                  cmd: `cd ${path}`
                }, {
                  info: 'Run your site',
                  cmd: 'npm start'
                }];
                if (error !== null) {
                  log(error(error.message));
                  nextSteps.splice(1, 0, {
                    info: 'Install required dependencies',
                    cmd: 'npm install'
                  });
                }
                log(chalk.magenta('Next steps:'));
                for (var i = 0, _i = nextSteps.length; i < _i; i++) {
                  log(chalk.magenta(`${i + 1}. ${nextSteps[i]['info']}`));
                  log(chalk.magenta(` \$ ${nextSteps[i]['cmd']}`));
                }
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
    'X-User-Agent': `contentstack-cli/${pkg.version}`
  };
  // merging the args to input
  _.merge(inputs, args);
  // initalise the connect process
  this.init();
};

/**
 * Initialize contentstack connect process
 * @return {Null} validates against a contentstack stack and creates an application framework
 */
Connect.prototype.init = function() {
  var self = this;
  var _requests;
  prompt.start();
  prompt.message = '';
  prompt.delimiter = '>';
  _requests = [
    // take stack input in case if it is not set
    function(_cb) {
      return self.stackInput(_cb);
    },
    // take input of the directory
    function(_cb) {
      return self.getDirectory(_cb);
    },
    // get environement from the specified stack
    function(_cb) {
      return request({
        uri: `${api.host}/${api.version}${api.urls.environments}?deploy_content=true`,
        headers: self.headers
      }, function(error, body) {
        if (error) {
          return _cb(error);
        } else if (body && body.environments) {
          return _cb(null, body.environments);
        }
        return _cb(null, []);
      });
    },
    // select environement from the specified
    function(environments, _cb) {
      if (environments && environments.length) {
        var _message = '\x1b[36mSelect publishing environment:';
        var environmentsLength = environments.length;
        for (var i = 0, _i = environmentsLength; i < _i; i++) {
          if (environments[i]['servers'] && environments[i]['servers'].length == 1) {
            _message += `\n(${(i + 1)}) ${environments[i]['name']} (${environments[i]['servers'][0]['name']})`;
          } else {
            _message += `\n(${(i + 1)}) ${environments[i]['name']}`;
          }
        }
        _message += '\n';
        prompt.get([
          utility.inputs.custom({
            name: 'environment_select',
            description: _message,
            message: 'Please select valid option.'.red,
            required: true,
            conform: function(value) {
              value = parseInt(value);
              return (value > 0 && value <= environmentsLength);
            }
          })
        ], function(error, result) {
          if (error) {
            return _cb(error);
          }
          _.merge(inputs, result);
          inputs.selected_environment = environments[parseInt(inputs.environment_select) - 1]['name'];
          inputs.environments = environments;
          return _cb(null, 1);
        });
      } else {
        log(warning(`No publishing environment exists on ${helper.url}.\nKindly create one`));
        return _cb(null, 2);
      }
    },
    // based on environment selection
    function(result, _cb) {
      switch (result) {
      case 1:
        var selection = inputs.environments[parseInt(inputs.environment_select) - 1];
        var _servers = selection['servers'];
        if (_servers && _servers.length === 0) {
          return _cb(new Error(`Environment '${selection.name}' does not have 'deploy server' option enabled!`));
        } else if (_servers && _servers.length > 1) {
          var _serverMessage = `The environment '${inputs.selected_environment}' has multiple servers.\nPlease select one.`;
          for (var i = 0, _i = _servers.length; i < _i; i++) {
            _serverMessage += `\n(${(i + 1)}) ${_servers[i]['name']}`;
          }
          _serverMessage += '\nChoose: ';
          prompt.get([
            utility.inputs.custom({
              name: 'environment_server_select',
              description: _serverMessage,
              message: 'Please select valid option.'.red,
              required: true,
              conform: function(value) {
                value = parseInt(value);
                return (value > 0 && value <= _servers.length);
              }
            })
          ], function(error, serverResult) {
            if (error) {
              return _cb(error);
            }
            _.merge(inputs, serverResult);
            inputs.selected_server = _servers[parseInt(inputs.environment_server_select) - 1]['name'];
            return _cb(null);
          });
        } else {
          inputs.selected_server = _servers.pop()['name'];
          return _cb();
        }
        break;
      case 2:
        return _cb(null);
      default:
        break;
      }
    }
  ];
  async.waterfall(_requests, function(error) {
    if (error) {
      throw error;
    }
    createApplicationAt();
  });
};

/**
 * Get directory from the user
 * @param  {Function} done : callback function
 * @return {Null}          : null
 */
Connect.prototype.getDirectory = function(done) {
  var self = this;
  inputs.directory = (inputs.directory) ? inputs.directory.toLowerCase() :
    inputs.directory;

  function checkDirectory() {
    helper.emptyDirectory(inputs.directory, function(err, empty) {
      if (err) {
        log(error(err));
        inputs.directory = null;
        return self.getDirectory(done);
      } else if (empty) {
        //creating the stack at given path
        return done(null);
      }
      return prompt.get([
        utility.inputs.custom({
          name: 'confirm',
          description: `\x1b[36mThe folder '${inputs.directory}' already exists. Overwrite (Yes/No)?:`,
          message: 'Please provide confirmation.',
          required: true,
          conform: function(value) {
            value = value.toLowerCase();
            return (value == 'yes' || value == 'no');
          },
          before: function(value) {
            return value.toLowerCase();
          }
        })
      ], function(error, result) {
        if (error) {
          return done(error);
        } else if (result.confirm === 'yes') {
          return done(null);
        }
        inputs.directory = null;
        return self.getDirectory(done);
      });
    });
  }
  if (inputs.directory) {
    return checkDirectory();
  } else {
    prompt.get([
      utility.inputs.custom({
        name: 'directory',
        description: 'Enter name of the directory to contain the project:',
        message: 'Please enter the name of the directory to contain the project.',
        required: true,
        default: inputs.site_title
      })
    ], function(error, result) {
      if (error) {
        return done(error);
      }
      _.merge(inputs, result);
      return checkDirectory();
    });
  }
};

/*
 * Get the stack validation
 * */
Connect.prototype.stackInput = function(done) {
  var self = this;

  function checkSite() {
    log(info('Validating stack..'));
    return request({
      url: `${api.host}/${api.version}${api.urls.stacks}`,
      qs: {
        include_discrete_variables: true
      },
      headers: self.headers,
      json: true
    }, function(error, body) {
      if (error) {
        return done(error);
      } else if (body && body.stack) {
        if (body.stack.discrete_variables && body.stack.discrete_variables
          ._version && parseInt(body.stack.discrete_variables._version) !==
          'NaN' && parseInt(body.stack.discrete_variables._version) >= 3) {
          inputs.site_title = body.stack.name.toLowerCase().replace(
            regexp, '-');
          inputs['site_master_language'] = body.stack.master_locale;
          log(success('Stack validated successfully!'));
          return done();
        } else {
          log(error(`${body.stack.name} stack is v2 and is not supported by contentstack-express.`));
          log(error('Kindly contact support@contentstack.com for upgrading your stack'));
          process.exit(0);
        }
      }
      log(error('API key or ACCESS_TOKEN is invalid!'));
      self.options.api_key = null;
      self.options.access_token = null;
      return self.stackInput(done);
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
    ], function(error, result) {
      if (error) {
        return done(error);
      }
      _.merge(inputs, result);
      self.headers.api_key = inputs.api_key.trim();
      self.headers.access_token = inputs.access_token.trim();
      return checkSite();
    });
  } else {
    self.headers.api_key = inputs.api_key = self.options.api_key.trim();
    self.headers.access_token = inputs.access_token = self.options.access_token
      .trim();
    return checkSite();
  }
};

module.exports = Connect;

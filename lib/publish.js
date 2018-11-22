/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */
var prompt = require('prompt');
var request = require('request');
var _ = require('lodash');
var debug = require('debug')('publish:general');
var debug_assets = require('debug')('publish:asset');
var debug_entries = require('debug')('publish:entry');
var chalk = require('chalk');
var async = require('async');
var pkg = require('../package');

/*
 * Application variables
 * */
var utility = require('./utils');
var config = require('./config').config();
var helper = require('./helper');
utility = new utility();
var inputs = {};
var api = config.get('contentstack');
var headers = {
  api_key: api.api_key,
  'X-User-Agent': `contentstack-cli/${pkg.version}`
};
var ORG_RATE_LIMIT = api.ORG_RATE_LIMIT || 5;
var bound = 100;
var backup;
var log = console.log;
var success = chalk.green;
var error = chalk.red;
var warning = chalk.yellow;
var info = chalk.cyan;

/**
 * Get stack's master locale
 * @param  {Function} fn : Error first callback
 * @return {Object}      : Return stack's master locale
 */
function getStackMasterLocale(fn) {
  return utility.getStack(undefined, function(error, body) {
    if (error) {
      return fn(error);
    } else if (body && body.stack) {
      if (body.stack.discrete_variables && body.stack.discrete_variables._version && body.stack.discrete_variables._version >= 3) {
        return fn(null, body.stack.master_locale);
      }
      return fn(`${body.stack.name} is on v2 which is not supported by contentstack-express.\nKindly contact 'support@contentstack.com' to upgrade stack to v3`);
    }
    return fn('Stack \'api_key\' or \'access_token\' is invalid');
  });
}

/**
 * Prompt & verify publish details
 * @param  {String} _event  : Action to be performed on the content types/assets
 * @param  {Object} options : Additional details to perform the above action
 */
function Publish(_event, options) {
  this.totalEntryCount = 0;
  this.totalAssetCount = 0;
  var self = this;
  // Callback function that fetches the stack's master locale
  return getStackMasterLocale(function(error, masterLocale) {
    if (error) {
      throw new Error(`Something went wrong while fetching stack details\n${error.message || error}`);
    }
    var schema = {
      username: {
        name: 'username',
        description: 'Enter your email id:',
        message: 'Please enter the email id with which you are registered with the cms.',
        required: true
      },
      password: {
        name: 'password',
        description: 'Enter your password:',
        message: 'Please enter the password associated with this email id.',
        required: true,
        hidden: true
      },
      environment: {
        name: 'environment',
        description: 'Enter the environment name:',
        message: 'Please enter the name by which the environment is identified in Settings >> Environments.',
        required: true,
        before: function(value) {
          return (value) ? value.toLowerCase().split(',') : value;
        }
      },
      type: {
        name: 'type',
        description: '\nInput types that you would like to publish: content_types|assets|all\nPress ENTER to select \'all\' content types:',
        required: false,
        conform: function(value) {
          return (value === 'content_types' || value === 'assets' || value === 'all');
        },
        before: function(value) {
          return (value) ? value.toLowerCase() : value;
        }
      },
      content_types: {
        name: 'content_types',
        description: `\nEnter specific content types to ${_event}.\nPress ENTER to select \'all\' content types:`,
        required: false,
        ask: function() {
          return (prompt && prompt.history('type').value !== 'assets');
        },
        before: function(val) {
          return (val != '') ? val.split(',') || [] : [];
        }
      },
      skip_content_types: {
        name: 'skip_content_types',
        description: `\nEnter the specific content types to be skipped for ${_event}\nPress ENTER for not skipping any content types:`,
        required: false,
        ask: function() {
          return (prompt && prompt.history('type').value !== 'assets');
        },
        before: function(val) {
          return (val != '') ? val.split(',') || [] : [];
        }
      },
      language: {
        name: 'language',
        description: `\nEnter the code of the language that you want to ${_event} from (default: '${masterLocale}'):`,
        required: false
      }
    };
    try {
      prompt.message = prompt.delimiter = '';
      prompt.start();
      var _params = [];
      inputs.event = _event;
      // deleting the backup
      backup = utility.matchConfirm(options.backup);
      delete options.backup;
      for (var key in schema) {
        if (key === 'type' && options[key] && options[key] === 'assets') {
          delete schema.content_types;
          delete schema.skip_content_types;
          delete options.content_types;
          delete options.skip_content_types;
          inputs[key] = options[key];
        } else if (typeof options[key] === 'undefined') {
          _params.push(schema[key]);
        } else {
          inputs[key] = options[key];
        }
      }
      prompt.get(_params, function(err, result) {
        if (err) {
          debug(`Errorred while processing cli-publish params\n${err.message || err}`);
          debug(`Retrying ${_event}`);
          return Publish(_event, options);
        }
        _.merge(inputs, result);
        // setting the default values
        inputs.type = inputs.type || 'all';
        inputs.language = (inputs.language) ? inputs.language.trim() : masterLocale;
        inputs.languages = (inputs.language) ? inputs.language : masterLocale;
        if (inputs.type === 'assets') {
          delete inputs.content_types;
          delete inputs.skip_content_types;
        }
        return self.init();
      });
    } catch (error) {
      throw new Error(`Errorred while prompting cli-publish details\n${error.message || error}`);
    }
  });
}

/**
 * Initialize the content 'publishing' process
 */
Publish.prototype.init = function() {
  try {
    var self = this;
    inputs.environment_ids = [];
    async.waterfall([
      function(cb) {
        //proceed after confirmation
        return helper.confirm(config, inputs.language, backup, cb);
      },
      // function(cb) {
      //   // login into cms, to get authtoken
      //   api.credentials = {
      //     user: {
      //       email: inputs.username,
      //       password: inputs.password
      //     }
      //   };
      //   return utility.login(api.credentials, function(err, body) {
      //     if (err) {
      //       return cb(err);
      //     } else if (body && body.user && body.user.authtoken) {
      //       return cb(null, body.user.authtoken);
      //     }
      //     log(error(`Something went wrong while logging in..`));
      //     return cb(body);
      //   });
      // },
      function( /*authtoken, */ cb) {
        // headers.authtoken = authtoken;
        headers.authtoken = '***REMOVED***';
        // get environment names from Contentstack
        return request({
          uri: `${api.host}/${api.version}${api.urls.environments}?$in=${inputs.environment.toString()}`,
          headers: headers,
          method: 'GET',
          json: true
        }, function(error, response) {
          if (error) {
            return cb(error);
          } else if (response && response.body.environments && response.body.environments.length) {
            inputs.environment_ids = _.map(response.body.environments, 'uid');
            return cb(null, null);
          }
          return cb(response.body);
        });
      },
      function(environments, cb) {
        //checking the mode of publishing content_types/assets/both
        switch (inputs.type) {
        case 'content_types':
          self.content_types(cb);
          break;
        case 'assets':
          self.assets(cb);
          break;
        default:
          async.series([
            function(_cb) {
              self.assets(_cb);
            },
            function(_cb) {
              self.content_types(_cb);
            }], cb);
          break;
        }
      }
    ], function(err) {
      if (err) {
        log(error(`Errorred in bulk ${inputs.event}ing on ${inputs.environment} environment.`));
        process.exit(1);
      }
      log(success(`Bulk ${inputs.event}ing finished on ${inputs.environment} environment.`));
      process.exit(0);
      return;
    });
  } catch (err) {
    log(error(`Errorred in bulk ${inputs.event}ing`));
    log(error(err));
    return;
  }
};

/**
 * Fetch content type's entries, and send them for publishing
 * @param  {Object}   content_types : Content type object
 * @param  {Function} callback      : Error first callback
 * @return {Function}               : Error first callback
 */
Publish.prototype.loadEntries = function(contentTypes, callback) {
  var self = this;
  return async.eachLimit(contentTypes, 1, function (contentType, cb) {
    return utility.getEntries(contentType.uid, inputs.language, {}, [], null, function(error, entries) {
      if (error) {
        return cb(error);
      }
      entries = entries || [];
      log(success(`A total of ${entries.length} were found in '${contentType.title}' content type`));
      log(info(`Sending ${contentType.title} content type entries for publish`));
      // TODO: Important
      return self.publishEntries(entries, contentType, inputs.language, cb);
    });
  }, function (error) {
    if (error) {
      return callback(error);
    }
    return callback(null, null);
  });
};

/**
 * Get content types
 * @param  {Function} callback : Error fist callback
 * @return {Function}          : Error fist callback
 */
Publish.prototype.content_types = function(callback) {
  var self = this;
  utility.getContentTypes(function(error, content_types) {
    if (error) {
      return callback(error);
    } else if (content_types && content_types.length) {
      log(success(`A total of ${content_types.length} content types were found`));
      var content_types_bucket = [];
      var content_type_uid = _.map(content_types, 'uid');
      // remove content types, that are to be skipped from all
      var filtered_content_type_uids = _.difference(content_type_uid, inputs.skip_content_types);
      // filter to only common content types, that have been input against filtered content types
      if (inputs.content_types && inputs.content_types.length) {
        filtered_content_type_uids = _.intersection(inputs.content_types, filtered_content_type_uids);
      }
      filtered_content_type_uids = _.uniq(filtered_content_type_uids);
      for (var i = 0; i < filtered_content_type_uids.length; i++) {
        var idx = _.findIndex(content_types, {
          uid: filtered_content_type_uids[i]
        });
        if (~idx && content_types[idx]) {
          content_types_bucket.push({
            title: content_types[idx]['title'],
            entry_title_field: (content_types[idx]['options'] && content_types[idx]['options']['title']) ? content_types[idx]['options']['title'] : 'title',
            uid: content_types[idx]['uid']
          });
        }
      }
      log(info('Sending content types to load and publish entries'));
      return self.loadEntries(content_types_bucket, callback);
    }
    return callback(null, null);
  });
};

/**
 * Send entries to publish
 * @param  {Object} entries         : Entries to be sent for publishing
 * @param  {Object} content_type    : Content type of the entries
 * @param  {String} language        : Language on which entry is to be published
 * @param  {Function} finalCallback : Fn to be called on completion
 * @return {Function}               : Error first callback
 */
Publish.prototype.publishEntries = function(entries, content_type, language, finalCallback) {
  var self = this;
  return async.eachLimit(entries, ORG_RATE_LIMIT,function(entry, cb) {
    var entry_id = (entry._metadata) ? entry._metadata.uid : entry.uid;
    var _options = {
      url: `${api.host}/${api.version}${api.urls.content_types}${content_type.uid}${api.urls.entries}${entry_id}/${inputs.event}`,
      headers: headers,
      method: 'POST',
      json: {
        entry: {
          title: entry[content_type.entry_title_field] || entry_id,
          entry_uid: entry_id,
          environments: inputs.environment,
          locale: entry.locale
        },
        content_type: {
          title: content_type.title,
          uid: content_type.uid
        },
        locale: inputs.languages
      }
    };
    return request(_options, function(error, body) {
      if (error) {
        return cb(error);
      }
      self.totalEntryCount++;
      return cb(null, body);
    });
  }, function (error) {
    if (error) {
      return finalCallback(error);
    }
    log(success(`Content type ${content_type.title} with ${self.totalEntryCount} entries was published successfully!`));
    return finalCallback(null, null);
  });
};
/**
 * Fetch and publish assets
 * @param  {Function} callback : Fn to be called on completion
 * @return {Function}          : Error first callback
 */
Publish.prototype.assets = function(callback) {
  var self = this;
  var requestAssets = {
    uri: `${api.host}/${api.version}${api.urls.assets}?only[BASE]=uid&only[BASE]=title`,
    qs: {
      include_count: true,
      limit: bound,
      skip: 0,
      desc: 'updated_at'
    },
    headers: headers,
    json: true
  };
  return utility.getAssets(requestAssets, [], function(error, assets) {
    if (error) {
      return callback(error);
    } else if (assets.length) {
      return self.publishAssets(assets, callback);
    }
    return callback(null, 'No assets were found in the stack!');
  });
};

/**
 * Send assets for publishing
 * @param  {Object} assets          : Assets to be sent for publishing
 * @param  {Function} finalCallback : Fn to be called when asset publishing is completed
 * @return {Function}               : Error first callback
 */
Publish.prototype.publishAssets = function(assets, finalCallback) {
  var assetPublishCount = 0;
  var assetFailedPublishCount = 0;
  return async.eachLimit(assets, ORG_RATE_LIMIT, function(asset, cb) {
    debug_assets(`Sending asset ${asset.title}: ${asset.uid} sent for publishing`);
    return request({
      uri: `${api.host}/${api.version}${api.urls.assets}${asset.uid}/${inputs.event}`,
      method: 'POST',
      headers: headers,
      json: {
        asset: {
          locales: (Array.isArray(inputs.languages)) ? inputs.languages : [inputs.languages],
          environments: (Array.isArray(inputs.environment)) ? inputs.environment : [inputs.environment]
        }
      }
    }, function(error) {
      if (error) {
        assetFailedPublishCount++;
        log(success(`Errorred while publishing ${asset.title}: ${asset.uid}!`));
        log(warning(error));
        return cb();
      }
      assetPublishCount++;
      debug_assets(`Asset ${asset.title}: ${asset.uid} sent for publishing successfully!`);
      return cb();
    });
  }, function(error) {
    if (error) {
      return finalCallback(error);
    }
    log(success(`${assetPublishCount} assets were sent for publishing successfully!`));
    log(success(`${assetFailedPublishCount} assets failed to be published`));
    return finalCallback(null);
  });
};

module.exports = Publish;
/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/**
 * Module Dependencies.
 */
var util = require('util');
var _ = require('lodash');
var prompt = require('prompt');
var debug = require('debug')('sync');
var async = require('async');
var chalk = require('chalk');
var EventEmitter = require('events').EventEmitter;

// Console logging
var log = console.log;
var success = chalk.green;
var error = chalk.red;
var warning = chalk.yellow;
var info = chalk.cyan;

// Application utility
var utility = require('./utils');
var helper = require('./helper');
var configurations = require('./config');
var config = configurations.config();
var sync = configurations.sync();
var languages = config.get('languages');
var api = config.get('contentstack');
var backup, bound = 100, inProgress;

utility = new utility();
prompt.message = '>';
prompt.delimeter = '';

/**
 * Cotentnstack sync
 */
function BulkSync(args) {
  log(warning('Bulk sync is in experimental mode!'));
  var self = this;
  this.q = [];
  inProgress = false;
  this._options = args || {};
  // Inherit methods from EventEmitter
  EventEmitter.call(this);
  // Remove memory-leak warning about max listeners
  this.setMaxListeners(0);
  // expose prototypes
  this.initialise = _.bind(this.initialise, this);
  // initalise the Synchronize command
  this.initialise(args, function (err) {
    if (err) {
      log('Content sync failed with errors');
      log(error(err));
      process.exit(1);
    }
    log(success('Content sync initialization completed successfully!\n'));
  });
  // proceed next queue if present
  var next = function() {
    if (self.q.length > 0) {
      var entryData = self.q.shift();
      self.sync.start(entryData);
    } else {
      inProgress = false;
      log(success('Cotentnstack \'SYNC\' completed successfully!!'));
    }
  };
  // start sync-utility
  this.sync = new sync(next, true);
  next.bind(this.sync);
}

// let sync inherit EventEmitter class
util.inherits(BulkSync, EventEmitter);

module.exports = BulkSync;

/**
 * Initialize the sync process
 * @param  {Object} cmdInputs [description]
 */
BulkSync.prototype.initialise = function(cmdInputs, cb) {
  try {
    var self = this;
    var inputs = [];
    var fn;
    self.inputs = {};
    backup = utility.matchConfirm(cmdInputs['backup']);
    delete cmdInputs['backup'];
    if (cmdInputs.type === 'assets') {
      delete self._options.content_types;
      delete self._options.skip_content_types;
      delete cmdInputs.content_types;
      delete cmdInputs.skip_content_types;
    }
    return utility.getStack(null, function(err, body) {
      if (err) {
        log(error('Failed while fetching stack details'));
        return cb(err);
      } else if (!body || !body.stack) {
        return cb('API_KEY or ACCESS_TOKEN is not valid. Please retry.');
      }
      if (body.stack.discrete_variables && body.stack.discrete_variables._version && body.stack.discrete_variables._version >= 3) {
        var masterLocale = body.stack.master_locale;
        for (var key in cmdInputs) {
          if (key && typeof self._options[key] === 'undefined') {
            switch (key) {
            case 'type':
              fn = utility.inputCustom(utility.inputs.type());
              break;
            case 'environment':
              fn = utility.inputEnvironment(utility.inputs.environment());
              break;
            case 'language':
              fn = utility.inputCustom(utility.inputs.language(masterLocale));
              break;
            case 'content_types':
              fn = utility.inputCustom(utility.inputs.content_types());
              break;
            case 'skip_content_types':
              fn = utility.inputCustom(utility.inputs.content_types({
                name: 'skip_content_types',
                description: 'Enter content types uids to be skipped. Enter them as \',\' comma seperated strings\nPress ENTER for not skipping any content types:'
              }));
              break;
            case 'datetime':
              fn = utility.inputCustom(utility.inputs.custom({
                name: 'datetime',
                format: 'date-time',
                description: 'Enter date-time(ISO String Format) from where you want to synchronize your data\nPress ENTER if you would like to sync from the beginning:',
                conform: function(input) {
                  if (Date.parse(input) != 'NaN') {
                    return true;
                  }
                  return false;
                },
                before: function(input) {
                  if (input && Date.parse(input) !== 'NaN') {
                    return new Date(input).toISOString();
                  }
                  return input;
                }
              }));
              break;
            }
            if (fn) {
              inputs.push(fn);
            }
          } else {
            if (key === 'environment' && self._options[key]) {
              inputs.push((function(environment) {
                return function(callback) {
                  return utility.getEnvironment(environment, callback);
                };
              }(self._options[key])));
            } else {
              self.inputs[key] = self._options[key];
            }
          }
        }
        return async.series(inputs, function(err, result) {
          try {
            if (err) {
              return cb(err);
            }
            for (var i = 0, total = result.length; i < total; i++) {
              if (result[i] && typeof result[i] == 'object') {
                for (var key in result[i]) {
                  self.inputs[key] = result[i][key];
                }
              }
            }
            return helper.confirm(config, self.inputs.language, backup, function(err) {
              if (err) {
                log(error('Getting client confirmation failed'));
                return cb(err);
              }
              switch (self.inputs.type) {
              case 'assets':
                return self.assets(cb);
              case 'content_types':
                return self.entry(cb);
              default:
                async.series([
                  function(fn) {
                    return self.assets(fn);
                  },
                  function(fn) {
                    return self.entry(fn);
                  }
                ], function(err) {
                  if (err) {
                    log(error(`Content sync failed\n${err.message || err}`));
                    return cb(err);
                  }
                  log('Contents synced successfully!');
                  return cb(null, null);
                });
              }
            });
          } catch (err) {
            log(error('Sync init error'));
            return cb(err);
          }
        });
      }
      return cb(`${body.stack.name} is on v2 which is not supported by contentstack-express.\nKindly contact 'support@contentstack.com' to upgrade stack to v3`);
    });
  } catch (err) {
    log(error(`Content sync error\n${err.message || err}`));
    return cb(err);
  }
};

/**
 * Iterate over content types and fetch content type entries
 * @param  {String} contentTypes    : Content type uid
 * @param  {Function} finalCallback : Error first callback
 * @return {Object}                 : Entries collection
 */
BulkSync.prototype.loadEntries = function(contentTypes, finalCallback) {
  var self = this;
  var query = {};
  if (self.inputs.datetime) {
    query = {
      updated_at: {
        $gte: self.inputs.datetime
      }
    };
  }
  return async.eachLimit(contentTypes, 1, function(contentType, cb) {
    return utility.getEntries(contentType.uid, self.inputs.language, query, [], self.inputs.environment.name, function(error, entries) {
      if (error) {
        return cb(error);
      } else if (entries.length === 0) {
        log(warning(`No entries were found in '${contentType.uid}' content type`));
        return cb();
      }
      return self.bulkSyncEntries(entries, contentType, cb);
    });
  }, function(error) {
    if (error) {
      return finalCallback(error);
    }
    return finalCallback(null, null);
  });
};

/**
 * Load data
 * @param  {Function} finalCallback : Error first callback
 * @return {Function}               : Error first callback
 */
BulkSync.prototype.entry = function(finalCallback) {
  var self = this;
  // calculating the content_types to be used
  if (self.inputs.content_types.length) {
    self.inputs.content_types = _.difference(self.inputs.content_types, self.inputs.skip_content_types);
    return self.loadEntries(self.inputs.content_types, finalCallback);
  }
  return utility.getContentTypesExperimental(function(err, contentTypes) {
    if (err) {
      log(error('Content type retrieval error'));
      return finalCallback(err);
    } else if (contentTypes.length) {
      // if (self.inputs.skip_content_types.length) {
      //   contentTypes = _.map(contentTypes, function(contentType) {
      //     return self.inputs.skip_content_types.indexOf(contentType.uid) === -1;
      //   });
      //   contentTypes = _.compact(contentTypes);
      // }
      // if (self.inputs.content_types) {
      //   contentTypes = _.map(contentTypes, function(contentType) {
      //     return self.inputs.content_types.indexOf(contentType.uid) !== -1;
      //   });
      //   contentTypes = _.compact(contentTypes);
      // }
      return self.loadEntries(contentTypes, finalCallback);
    }
    return finalCallback('No content types were found!');
  });
};

/**
 * Parse entries into standardized format
 * @param  {Object}   entries      : Entries collection
 * @param  {String}   content_type : Content type of the collection
 * @return {Function} fn           : Error first callback
 */
BulkSync.prototype.bulkSyncEntries = function(entries, contentType, fn) {
  try {
    debug(`Dumping ${entries.length} entries of ${contentType.uid} content type`);
    var self = this;
    var lang = _.findIndex(languages, {
      code: self.inputs.language
    });
    entries.forEach(function (entry) {
      self.q.push({
        message: {
          body: {
            object: {
              content_type: contentType,
              entry: entry,
              locale: [self.inputs.language],
              environment: [self.inputs.environment.uid],
              action: 'publish',
              type: 'entry'
            },
            restore: true,
            bulkSync: true
          }
        },
        lang: languages[lang]
      });
    });

    if (!inProgress) {
      var entryData = self.q.shift();
      log(success(`Started content sync for ${contentType} entries`));
      self.sync.start(entryData);
      inProgress = true;
    }
    return fn(null, null);
  } catch (e) {
    console.error(e);
    log(error(`Errorred in bulk-dumping of entries\n${e.message || e}`));
    return fn(e);
  }
};

/**
 * Fetch assets
 * @param  {Function} fn : Error first callback
 * @return {Object}      : Asset collection
 */
BulkSync.prototype.loadAssets = function(fn) {
  var self = this;
  var req = {
    uri: `${api.cdn || api.host}/${api.version}${api.urls.assets}`,
    method: 'GET',
    qs: {
      environment: self.inputs.environment.name,
      locale: self.inputs.language,
      skip: 0,
      limit: bound,
      include_count: true,
      only: {
        BASE: ['publish_details', 'filename', '_version']
      }
    }
  };
  if (this.inputs.datetime) {
    req.qs.query = {
      published_at: {
        $gte: self.inputs.datetime
      }
    };
  }
  // Returns filtered asset collection
  return utility.getAssets(req, [], fn);
};

/**
 * Parse assets into standardized format
 * @param  {Object} assets          : Asset json - data to be synced
 * @param  {Function} finalCallback : Error first callback
 * @return {Function}               : Asset sync status
 */
BulkSync.prototype.parseAssets = function(assets, finalCallback) {
  var self = this;
  var lang = _.findIndex(languages, {
    code: self.inputs.language
  });
  return finalCallback(null, null);
};

/**
 * Fetch assets and sync
 * @param  {Function} callback : Error first callback
 * @return {Function}          : Asset sync status
 */
BulkSync.prototype.assets = function(callback) {
  var self = this;
  return self.loadAssets(function(error, assets) {
    if (error) {
      return callback(error);
    } else if (assets.length === 0) {
      log(warning('No assets were found in the specified environment/stack'));
      return callback(null, null);
    }
    log(info(`${assets.length} assets were retrieved`));
    // Parse assets and send it for syncing
    return self.parseAssets(assets, callback);
  });
};
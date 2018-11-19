/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/*!
 * Module dependencies
 */
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var prompt = require('prompt');
var ncp = require('ncp').ncp;
var mkdirp = require('mkdirp');
var chalk = require('chalk');
var log = console.log;
var success = chalk.green;
var error = chalk.red;
var warning = chalk.yellow;
var info = chalk.cyan;

/**
 * Make directory
 * @param  {String} path : Path where the directory is to be made
 * @param  {String|Number} permission : Permission to the directory
 */
function mkdirAllSync(path, permission) {
  mkdirp.sync(path, permission);
};

function createDirectories(language) {
  if (!fs.existsSync(language.contentPath)) mkdirAllSync(language.contentPath,
    '0755');
  if (!fs.existsSync(language.assetsPath)) mkdirAllSync(language.assetsPath,
    '0755');
  if (!fs.existsSync(path.join(language.assetsPath, '__cms_assets.json'))) fs.writeFileSync(
    path.join(__path, '__cms_assets.json'), '{}');
};

var helper = exports;
exports.url = 'https://contentstack.com/';
exports.title = 'Contentstack';

/**
 * Confirm directory creation and backup from client
 * @param  {Object}   config     : Config object
 * @param  {String}   lang       : Language code
 * @param  {Boolean}   backup    : Is the language to be backed up?
 * @param  {Function} callback   : Callback fn
 * @return {Function}            : Call the fn once the process is completed
 */
exports.confirm = function(config, lang, backup, callback) {
  try {
    var languages = config.get('languages');
    var storagePath = config.get('path.storage');
    var language;
    if (languages && lang) {
      language = _.findIndex(languages, {
        code: lang
      });
      if (~language) {
        language = languages[language];
        helper.emptyDirectory(language.contentPath, function(empty) {
          if (empty) {
            createDirectories(language);
            return callback();
          } else {
            if (backup === undefined) {
              prompt.message = prompt.delimiter = '';
              prompt.get([{
                name: 'confirm',
                description: 'Do you want to create a backup of the existing content? (Yes/No):',
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
                process.stdin.destroy();
                if (ok) {
                  return helper.createBackupDir(storagePath, lang,
                    callback);
                }
                return callback(null);
              });
            } else if (backup === false) {
              return callback(null);
            }
            return helper.createBackupDir(storagePath, lang, callback);
          }
        });
      } else {
        throw new Error(`${lang} language code was not found!`);
      }
    } else {
      throw new Error(`Unable to resolve ${languages.toString()} && ${lang}`);
    }
  } catch (error) {
    log(error(`Errorred while confirming..\n${error.message || error}`));
    return callback(error.message || error);
  }
};

/**
 * Create content backup
 * @param  {String}   storagePath : Content storage location
 * @param  {String}   lang : Language code
 * @param  {Function} callback : Fn
 * @return {Function} : Callback fn
 */
exports.createBackupDir = function(storagePath, lang, callback) {
  console.log('Creating backup.....');
  var d = new Date();
  ncp(path.join(storagePath, lang), path.join(storagePath, lang, '..', d.getTime() +
    '_' + lang + '_backup'), function(error) {
    if (error) {
      log(error(
        `Failed to create backup, due to the following error\n${error.message || error}`
      ));
    }
    return callback();
  });
};

/**
 * Check if the directory is empty
 * @param  {String}   path : Path to check
 * @param  {Function} fn   : Callback fn
 * @return {Function}      : Call fn
 */
exports.emptyDirectory = function(path, fn) {
  fs.readdir(path, function(error, files) {
    if (error && 'ENOTDIR' == error.code) {
      return fn(new Error(
        `The name '${path}' is already used in this location.\nPlease use a different name.`
      ));
    } else if (error && 'ENOENT' !== error.code) {
      throw error;
    }
    return fn(null, !files || !files.length);
  });
};

/**
 * Make directory
 * @param  {String} path : Path where the directory is to be made
 * @param  {Function} fn : Callback fn
 * @return {Function}    : Call fn
 */
exports.mkdir = function(path, fn) {
  mkdirp(path, '0755', function(error) {
    if (error) {
      throw error;
    }
    log(success(`Created directory at ${path}`));
    return fn();
  });
};

/**
 * Write content at destination
 * @param  {String} path : Path to be written at
 * @param  {String} str  : Content to be written
 */
exports.write = function(path, str) {
  fs.writeFileSync(path, str);
  log(success(`Created ${path}`));
};

/**
 * Abort system setup
 * @param  {String} str : Content to be displayed on aborting
 */
exports.abort = function(str) {
  log(error(`Aborting setup.. ${str}`));
  process.exit(1);
};

/**
 * Copy properties
 * @param  {Object} source      [description]
 * @param  {Object} destination [description]
 * @return {Object}             [description]
 */
exports.merge = function(source, destination) {
  for (var key in destination) {
    source[key] = destination[key];
  }
  return source;
};
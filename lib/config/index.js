/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/**
 * Module Dependencies.
 */
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var resolve = require('resolve');
var folderPath;
var log = console.log;
var error = chalk.red;
/**
 * Load config from contentstack-express
 * @return {Object} contentstack-express config
 */
exports.config = function() {
  try {
    var frameworkPath, contentstack, rootPath = process.cwd();
    frameworkPath = resolve.sync('contentstack-express', {
      paths: [],
      basedir: rootPath
    });
    folderPath = frameworkPath.replace('contentstack.js', '');
    contentstack = require(frameworkPath);
    return contentstack.config;
  } catch (err) {
    log(error(
      `contentstack-express module could not be resolved!\n${err.message || err}`
    ));
    log(error(
      'Please run the command from the contentstack-express application directory'
    ));
    process.exit(0);
  }
};

/**
 * Load contentstack-express's sync module
 * @return {Module} contentstack-express's sync module
 */
exports.sync = function() {
  if (folderPath && fs.existsSync(folderPath)) {
    folderPath = path.join(folderPath, 'lib', 'sync', 'sync.js');
    if (folderPath && fs.existsSync(folderPath)) {
      return require(folderPath);
    }
  }
  return;
};

/**
 * Get default config
 * @return {Object} default config
 */
exports.getDefault = function() {
  var config = require('./default');
  var _config = {
    get: function(key) {
      var _value = key.split('.').reduce(function(prev, crnt) {
        if (prev && prev[crnt]) return prev[crnt];
        return;
      }, config);
      return _value;
    }
  };
  return _config;
};

/**
 * Get contentstack-express's package.json file
 * @return {Object} package.json file
 */
exports.package = function() {
  if (folderPath && fs.existsSync(folderPath)) {
    folderPath = path.join(folderPath, 'package.json');
    if (folderPath && fs.existsSync(folderPath)) {
      return require(folderPath);
    }
  }
  return;
};
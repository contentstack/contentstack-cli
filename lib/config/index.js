/*!
 * contentstack-cli
 * copyright (c) Built.io Contentstack
 * MIT Licensed
 */

'use strict';

/**
 * Module Dependencies.
 */
var fs = require('fs'),
    path = require('path'),
    resolve = require('resolve'),
    folderPath;

exports.config = function() {
    try {
        var frameworkPath, contentstack, config, rootPath = process.cwd();
        frameworkPath = resolve.sync('contentstack-express', {paths: [], basedir: rootPath});
        folderPath = frameworkPath.replace('contentstack.js', '');
        contentstack = require(frameworkPath);
        return contentstack.config;
    } catch (error) {
        console.error("contentstack-express is not installed.", error.message);
        console.error("Please run the command from the Built.io Contentstack Application folder.");
        process.exit(0);
    }
};

exports.sync = function() {
    if(folderPath && fs.existsSync(folderPath)) {
        folderPath = path.join(folderPath, 'lib', 'sync', 'sync.js');
        if(folderPath && fs.existsSync(folderPath)) {
            return require(folderPath);
        }
    }
    return ;
}

exports.getDefault = function() {
    var config = require('./default');
    var _config = {
        get: function(key) {
            var _value = key.split('.').reduce(function(prev, crnt) {
                if(prev && prev[crnt]) return prev[crnt];
                return;
            }, config);
            return _value;
        }
    };

    return _config;
};

exports.package = function() {
    if(folderPath && fs.existsSync(folderPath)) {
        folderPath = path.join(folderPath, 'package.json');
        if(folderPath && fs.existsSync(folderPath)) {
            return require(folderPath);
        }
    }
    return ;
};

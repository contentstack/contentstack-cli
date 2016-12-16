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
    ncp = require('ncp').ncp,
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    fs = require('fs');

/*
 * Application variable
 * */
function mkdirAllSync(path, permission) {
    mkdirp.sync(path, permission);
};

function createDirectories(language) {
    if (!fs.existsSync(language.contentPath)) mkdirAllSync(language.contentPath, "0755");
    if (!fs.existsSync(language.assetsPath)) mkdirAllSync(language.assetsPath, "0755");
    if (!fs.existsSync(path.join(language.assetsPath, '__cms_assets.json'))) fs.writeFileSync(path.join(__path, '__cms_assets.json'), '{}');
};

var helper = exports;

exports.url = 'https://contentstack.built.io/';

exports.title = 'Built.io Contentstack';

exports.confirm = function(config, lang, backup, callback) {
    try {
        var languages = config.get('languages'),
            storagePath = config.get('path.storage'),
            language;

        if(languages && lang) {
            language = _.findIndex(languages, {"code": lang});
            if(~language) {
                language = languages[language];
                helper.emptyDirectory(language.contentPath, function (empty) {
                    if (empty) {
                        createDirectories(language);
                        callback();
                    } else {
                        if(backup === undefined) {
                            prompt.message = prompt.delimiter = "";
                            prompt.get([{
                                name: 'confirm',
                                description: 'Do you want to create a backup of the existing content? (Yes/No):',
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
                                process.stdin.destroy();
                                if (ok) {
                                    helper.createBackupDir(storagePath, lang, callback);
                                } else {
                                    callback();
                                }
                            });
                        } else if (backup === false) {
                            callback();
                        } else {
                            helper.createBackupDir(storagePath, lang, callback);
                        }
                    }
                });
            } else {
                throw new Error("Language code is incorrectly specified or is not present in the configuration file.");
            }
        } else {
            throw new Error("Language code is incorrectly specified or is not present in the configuration file.");
        }
    } catch (e) {
        console.error("Error in Confirm : ", e.stack);
        callback(e);
    }
};

exports.createBackupDir = function (storagePath, lang, callback) {
    console.log("Creating backup.....");
    var d = new Date();
    ncp(path.join(storagePath, lang), path.join(storagePath, lang, "..", d.getTime() + "_" + lang + "_backup"), function (err) {
        if (err) {
            console.error("Backup creation for path[%s] failed. Error: ", __path, err);
        }
        console.log("Backup created successfully.");
        callback();
    });
};

exports.emptyDirectory = function (path, fn) {
    fs.readdir(path, function (err, files) {
        if (err && 'ENOTDIR' == err.code) {
            fn(new Error('The name "'+path+'" is already used in this location. Please use a different name.'))
        }else if (err && 'ENOENT' != err.code) {
            throw err;
        }else{
            fn(null, !files || !files.length);
        }
    });
};

exports.mkdir = function (path, fn) {
    mkdirp(path, "0755", function (err) {
        if (err) {
            throw err;
        }
        console.log('   \u001b[36mcreated\u001b[0m : ' + path);
        fn && fn();
    });
};

exports.write = function (path, str) {
    fs.writeFile(path, str);
    console.log('   \x1b[36mcreated\x1b[0m : ' + path);
};

exports.abort = function (str) {
    console.error('\u001b[31m'+str+'\u001b[0m');
    process.exit(1);
};

exports.merge = function(source, destination) {
    for(var key in destination) source[key] = destination[key];
    return source;
};
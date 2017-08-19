/*!
 * contentstack-cli
 * copyright (c) Built.io Contentstack
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */
var prompt = require('prompt'),
    request = require('request'),
    _ = require("lodash"),
    Q = require("q"),
    async = require('async'),
    pkg = require('./../package.json');
/*
 * Application variables
 * */
var utility = require('./utils'),
    utility = new utility(),
    _request = require('./request'),
    config = require('./config').config(),
    helper = require('./helper');

var inputs = {},
    api = config.get('contentstack'),
    headers = {
        api_key: api.api_key,
        "X-User-Agent": 'contentstack-cli/' + pkg.version
    },
    bound = 100,
    backup;

var publish = function (_event, options) {
    this.totalEntryCount = 0;
    this.totalAssetCount = 0;
    var self = this;
    async.series([
        function (callback) {
            utility
                .getStack()
                .then(function (body) {
                    if (body && body.stack ) {
                        if(body.stack.discrete_variables && body.stack.discrete_variables._version && body.stack.discrete_variables._version >= 3) {
                            callback(null, body.stack.master_locale)
                        } else {
                            callback("\x1b[31mThe " + body.stack.name + " stack is currently on version 2 which is not supported by contentstack-express version 3. \nKindly contact support-contentstack@built.io for upgrading your Stack to version 3.\x1b[0m");
                        }
                    } else {
                        callback("\x1b[31mApi key or access token is not valid. Please retry.\x1b[0m");
                    }
                }, function (err) {
                    callback(err);
                });
        }
    ], function (err, masterLocale) {
        if(!err) {
            var schema = {
                username: {
                    name: "username",
                    description: 'Enter your email id:',
                    message: 'Please enter the email id with which you are registered with the cms.',
                    required: true
                },
                password: {
                    name: "password",
                    description: 'Enter your password:',
                    message: 'Please enter the password associated with this email id.',
                    required: true,
                    hidden: true
                },
                environment: {
                    name: "environment",
                    description: 'Enter the environment name:',
                    message: 'Please enter the name by which the environment is identified in Settings >> Environments.',
                    required: true,
                    before: function (value) {
                        return (value) ? value.toLowerCase().split(',') : value;
                    }
                },
                type: {
                    name: "type",
                    description: 'Send only content_types, only assets, or all content_types and assets ' + _event + 'ing for ? [content_types/assets/all] (default:all):',
                    required: false,
                    conform: function (value) {
                        return (value == "content_types" || value == "assets" || value == "all");
                    },
                    before: function (value) {
                        return (value) ? value.toLowerCase() : value;
                    }
                },
                content_types: {
                    name: "content_types",
                    description: 'Enter the specific content types ' + _event + ' (default: ""):',
                    required: false,
                    ask: function () {
                        return (prompt && prompt.history('type').value !== 'assets');
                    },
                    before: function (val) {
                        return (val != "") ? val.split(',') || [] : [];
                    }
                },
                skip_content_types: {
                    name: "skip_content_types",
                    description: 'Enter the specific content types to be skipped in ' + _event + ' (default: ""):',
                    required: false,
                    ask: function () {
                        return (prompt && prompt.history('type').value !== 'assets');
                    },
                    before: function (val) {
                        return (val != "") ? val.split(',') || [] : [];
                    }
                },
                language: {
                    name: "language",
                    description: 'Enter the code of the language that you want to ' + _event + ' from (default: "' + masterLocale + '"):',
                    required: false
                }
            };
            try {
                prompt.message = prompt.delimiter = "";
                prompt.start();
                var _params = [];
                inputs.event = _event;
                // deleting the backup
                backup = utility.matchConfirm(options.backup);
                delete options.backup;

                for (var key in schema) {
                    if (key === "type" && options[key] && options[key] === "assets") {
                        delete schema.content_types;
                        delete schema.skip_content_types;
                        delete options.content_types;
                        delete options.skip_content_types;
                        inputs[key] = options[key];
                    } else if (typeof options[key] === "undefined") {
                        _params.push(schema[key]);
                    } else {
                        inputs[key] = options[key];
                    }
                }
                prompt.get(_params, function (err, result) {
                    if (err) throw err;
                    _.merge(inputs, result);
                    // setting the default values
                    inputs.type = inputs.type || "all";
                    inputs.language = (inputs.language) ? inputs.language.trim() : masterLocale[0];
                    inputs.languages = (inputs.language) ? inputs.language : masterLocale[0];
                    if (inputs.type === "assets") {
                        delete inputs.content_types;
                        delete inputs.skip_content_types;
                    }
                    self.init();
                });
            } catch (err) {
                console.error('Error :', err.message || err);
            }
        } else {
            console.error('Error: ', err.message || err);
        }

    });

};

publish.prototype.init = function () {
    try {
        var self = this;
        inputs.environment_ids = [];
        async.waterfall([
            function (cb) {
                //proceed after confirmation
                helper.confirm(config, inputs.language, backup, cb);
            },
            function (cb) {
                // login into cms, to get authtoken
                api.credentials = {
                    user: {
                        email: inputs.username,
                        password: inputs.password
                    }
                };
                utility
                    .login(api.credentials)
                    .then(function (body) {
                        if (body && body.user && body.user.authtoken) {
                            cb(null, body.user);
                        } else {
                            cb(body);
                        }
                    })
                    .fail(function (err) {
                        cb(err);
                    });
            },
            function (user, cb) {
                headers.authtoken = user.authtoken;
                // get environment id from Built.io Contentstack
                _request({
                    url: api.host + '/' + api.version + api.urls.environments,
                    headers: headers,
                    method: "POST",
                    json: {
                        _method: "GET",
                        query: {
                            name: {
                                "$in": inputs.environment
                            }
                        }
                    }
                }).then(function (body) {
                    if (body && body.environments && body.environments.length) {
                        inputs.environment_ids = _.pluck(body.environments, "uid")
                        cb();
                    } else {
                        cb(new Error("Provided environments not found in the configured stack."));
                    }
                }).fail(function (error) {
                    cb(error);
                });

            },
            function (cb) {
                //checking the mode of publishing content_types/assets/both
                switch (inputs.type) {
                    case 'content_types':
                        self.content_types(cb);
                        break;
                    case 'assets':
                        self.assets(cb);
                        break;
                    default :
                        async.series([
                            function (_cb) {
                                self.assets(_cb);
                            },
                            function (_cb) {
                                self.content_types(_cb);
                            }], cb);
                        break;
                }
            }
        ], function (err) {
            if (err) {
                console.error('Error in bulk ' + inputs.event + 'ing.', (err.message || err));
            } else {
                console.info('\n\nBulk ' + inputs.event + 'ing finished on ' + inputs.environment + ' environment.');
                console.info('Total Asset : ' + self.totalAssetCount + '\nTotal Entries : ' + self.totalEntryCount);
            }
        });
    } catch (err) {
        console.error('Error in bulk ' + inputs.event + 'ing.', err);
    }
};

publish.prototype.content_types = function (callback) {
    var self = this;
    var _loadEntries = function (_content_types) {
        var _calls = [];
        for (var i = 0, total = _content_types.length; i < total; i++) {
            _calls.push(function (content_type) {
                return utility.getEntries(content_type['uid'], inputs.language, {}, [], null)
                    .then(function (entries) {
                        entries = entries || [];
                        console.log("Total %d entries of ContentType %s retrieved.", entries.length, content_type['title']);
                        return self.publishEntries(entries, content_type, inputs.language);
                    })
                    .fail(function (err) {
                        console.log("Error in retriveing entries of %s.", content_type['title'], err);
                    });
            }(_content_types[i]));
        }
        ;

        Q.all(_calls)
            .then(function () {
                callback();
            })
            .fail(function (error) {
                console.log("Load entries error: ", error.message);
                callback();
            });
    };

    utility
        .getContentTypes()
        .then(function (body) {
            if (body && body.content_types && body.content_types.length) {
                var _temp = _.pluck(body.content_types, "uid"),
                    _content_types,
                    __contentTypes = [];

                _content_types = _.difference(_temp, inputs.skip_content_types);

                // check if the specified content_types exists if then send them
                if (inputs.content_types && inputs.content_types.length) _content_types = _.intersection(inputs.content_types, _content_types);

                _content_types = _.uniq(_content_types);

                for (var i = 0; i < _content_types.length; i++) {
                    var idx = _.findIndex(body.content_types, {"uid": _content_types[i]});
                    if (~idx && body.content_types[idx]) {
                        __contentTypes.push({
                            title: body.content_types[idx]['title'],
                            entry_title_field: (body.content_types[idx]['options'] && body.content_types[idx]['options']['title']) ? body.content_types[idx]['options']['title'] : "title",
                            uid: body.content_types[idx]['uid']
                        });
                    }
                }
                console.log('Total ContentTypes : ', __contentTypes.length);
                _loadEntries(__contentTypes);
            } else {
                console.info("Content Types doesn't exists in the stack.");
                callback();
            }
        })
        .fail(function (error) {
            callback(error);
        });
};

publish.prototype.publishEntries = function (entries, content_type, language) {
    var self = this,
        _calls = [],
        deferred = Q.defer();
    for (var i = 0; i < entries.length; i++) {
        _calls.push(function (entry) {
            return (function (cb) {
                var entry_id = (entry['_metadata']) ? entry['_metadata']['uid'] : entry['uid'],
                    _options = {
                        url: api.host + '/' + api.version + api.urls.content_types + content_type['uid'] + api.urls.entries + entry_id + '/' + inputs.event,
                        headers: headers,
                        method: 'POST',
                        json: {
                            entry: {
                                title: entry[content_type["entry_title_field"]] || entry_id,
                                entry_uid: entry_id,
                                environments: inputs.environment,
                                locale: entry['locale']
                            },
                            content_type: {
                                title: content_type['title'],
                                uid: content_type['uid']
                            },
                            locale: inputs.languages
                        }
                    };
                request(_options, function (err, res, body) {
                    self.totalEntryCount++;
                    cb(null, body);
                });
            });
        }(entries[i]));
    }

    async.parallelLimit(_calls, 5, function (err, res) {
        if (err) {
            deferred.reject(err);
        } else {
            console.log("\nContentType : ", content_type['title'], "\tTotal Entries : ", res.length);
            deferred.resolve(res.length);
        }
    });
    return deferred.promise;
};

publish.prototype.assets = function (callback) {
    var self = this,
        option = {
            url: api.host + '/' + api.version + api.urls.assets,
            qs: {
                include_count: true,
                limit: bound,
                skip: 0,
                desc: 'updated_at'
            },
            headers: headers,
            json: true
        };

    var publishAsset = function (options, cb) {
        request(options, function (err, res, body) {
            if (!err) {
                self.totalAssetCount++;
            } else {
                console.error("Asset publishing/unpublishing failed ", {
                    error: err,
                    error_message: body,
                    UID: options.json.asset.entry.uid
                });
            }
            cb(err);
        });
    };

    var publishAssets = function (assets, _callback) {
        var _calls = [],
            languages = [];
        languages.push(inputs.languages)
        for (var i = 0, total = assets.length; i < total; i++) {
            _calls.push(function (asset) {
                return (function (cb) {
                    var options = {
                        url: api.host + '/' + api.version + api.urls.assets + asset.uid + '/' + inputs.event,
                        method: "POST",
                        headers: headers,
                        json: {
                            "asset": {
                                "entry": {
                                    "uid": asset['uid'],
                                    "title": asset['filename'] || asset['uid']
                                },
                                "locales": languages,
                                "environments": inputs.environment
                            }
                        }
                    };
                    publishAsset(options, cb);
                });
            }(assets[i]));
        }
        async.parallelLimit(_calls, 10, function (err, result) {
            _callback();
        });
    };

    var loadBatch = function (total, callback) {
        var index = 0,
            _calls = [];

        while (index < total) {
            _calls.push(function (offset, limit) {
                return (function (cb) {
                    var _options = {
                        url: api.host + '/' + api.version + api.urls.assets,
                        method: "GET",
                        headers: headers,
                        qs: {
                            skip: offset,
                            limit: limit,
                            asc: 'updated_at'
                        }
                    };
                    request(_options, function (err, res, body) {
                        if (!err && res.statusCode == 200) {
                            var _uploads = JSON.parse(body).assets;
                            publishAssets(_uploads, cb);
                        } else {
                            cb(body);
                        }
                    });
                });
            }(index, bound));
            index = index + bound;
        }
        console.log("Assets = ", total);
        async.series(_calls, function (err) {
            if (err)
                callback(err);
            else
                callback();
        });
    };

    request(option, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            var assetCount = body.count;
            loadBatch(assetCount, callback);
        } else {
            console.error('Asset count "Not Received", skipping assets ' + inputs.event + 'ing.');
            callback();
        }
    });
};

module.exports = publish;

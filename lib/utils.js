/*!
 * contentstack-cli
 * copyright (c) Built.io Contentstack
 * MIT Licensed
 */

 'use strict';

/**
 * Module Dependencies.
 */

 var Q = require('q'),
 _ = require('lodash'),
 prompt = require('prompt'),
 requests = require('request'),
 async = require('async'),
 pkg = require('./../package.json');

/*
 * Application defined variables
 * */
 var request = require('./request'),
 limit = 100,
 config, api;

 function Utility(skip) {
    if (!skip) {
        config = require('./config').config();
        api = config.get('contentstack');

        // setting the headers
        this.headers = {
            api_key: api.api_key,
            access_token: api.access_token,
            "X-User-Agent": 'contentstack-cli/' + pkg.version
        };
    }
}

/*
 * Get the entries from the provided ContentType from the configured stack
 * */
 Utility.prototype.getEntries = function (content_type, locale, _query, fields, environment) {
    var self = this,
    _getEntries,
    deferred = Q.defer(),
    _json = {
        _method: "GET",
        locale: locale,
        limit: limit,
        desc: "created_at",
        query: _query,
        only: {
            BASE: fields || []
        }
    };
    if(_.isString(environment)) _json['environment'] = environment;
    _getEntries = function (skip) {
        var options = {
            url: api.host + '/' + api.version + api.urls.content_types + content_type + api.urls.entries,
            headers: self.headers,
            method: "POST",
            json: _json
        };
        if (!skip) options.json.include_count = true;
        _json['skip'] = skip;
        return request(options);
    };

    _getEntries(0)
    .then(function (data) {
        var _calls = [];
        if (data && data.entries && data.count && data.count > limit) {
            for (var i = 1, total = Math.ceil(data.count / limit); i < total; i++) {
                _calls.push(_getEntries((limit * i), locale, _query))
            }
            Q.all(_calls)
            .then(function (entries) {
                entries = _.pluck(entries, "entries").reduce(function (prev, crnt) {
                    if (Array.isArray(crnt)) {
                        prev = prev.concat(crnt);
                    }
                    return prev;
                }, []);
                data.entries = data.entries.concat(entries);
                deferred.resolve(data.entries);
            });
        } else {
            deferred.resolve(data.entries);
        }
    })
    .fail(function (error) {
        console.error('Get Entries Error: ', JSON.stringify(error));
    });

    return deferred.promise;
};

/*
 * Get all the ContentTypes from the configured stack
 * */
 Utility.prototype.getContentTypes = function () {
    return request({
        url: api.host + '/' + api.version + api.urls.content_types,
        qs: {desc: "created_at"},
        headers: this.headers,
        method: "GET",
        json: true
    });
};

/*
 * Login the specified user in the system
 * */
 Utility.prototype.login = function (user) {
    return request({
        url: api.host + '/' + api.version + api.urls.session,
        headers: this.headers,
        method: "POST",
        json: user
    });
};

/*
 * Get the specified environment from the configured stack
 * */
 Utility.prototype.getEnvironment = function (environment) {
    return request({
        url: api.host + '/' + api.version + api.urls.environments + environment,
        headers: this.headers,
        method: "GET",
        json: true
    });
};
/*
 * Get all the Assets from the configured stack
 * */
 Utility.prototype.getAssets = function (options) {
    return request({
        method: "GET",
        url: api.host + '/' + api.version + api.urls.assets,
        qs: options,
        headers: this.headers,
        json: true
    });
};
/*
 * Get the specified environment from the configured stack
 * */
 Utility.prototype.getStack = function (headers) {
    return request({
        url: api.host + '/' + api.version + api.urls.stacks,
        headers: headers || this.headers,
        method: "GET",
        qs: {
            "include_discrete_variables" : true
        },
        json: true
    });
};

/*
 * Get the all environments from the configured stack
 * */
 Utility.prototype.getEnvironments = function (headers, query) {
    return request({
        url: api.host + '/' + api.version + api.urls.environments,
        qs: query || {},
        headers: headers || this.headers,
        method: "GET",
        json: true
    });
};

Utility.prototype.inputs = {
    type: function () {
        return {
            type: "string",
            name: "type",
            required: false,
            description: 'Send only content_types, only assets, or all content_types and assets for sync ?[content_types/assets/all] (default:all):',
            conform: function (value) {
                return (value == "content_types" || value == "assets" || value == "all");
            },
            before: function (value) {
                return (value) ? value.toLowerCase() : value;
            }
        }
    },
    content_types: function (opts) {
        return {
            type: "string",
            name: (opts && opts.name) ? opts.name : "content_types",
            required: false,
            description: (opts && opts.description) ? opts.description : "Enter the content types(hit return/enter for all or type \",\" comma seperated content type uids): ",
            ask: function () {
                return (prompt && prompt.history('type').value !== 'assets');
            },
            before: function (input) {
                if (input) {
                    return input.split(",");
                }
                return [];
            }
        }
    },
    environment: function () {
        return {
            type: "string",
            name: "environment",
            required: true,
            description: "Enter the environment: ",
            before: function (input) {
                return input.toLowerCase();
            }
        }
    },
    language: function (locale) {
        var masterLocale = (locale) ? locale : 'en-us';
        return {
            type: "string",
            name: "language",
            default: masterLocale,
            required: true,
            description: "Enter the language: ",
            before: function (input) {
                return input.trim().toLowerCase();
            },
            conform: function (input) {
                var languages = config.get('languages'),
                idx = _.findIndex(languages, {"code": input.trim()});
                return (idx > -1);
            }
        }
    },
    custom: function (opts) {
        opts = opts || {};
        var _temp = {
            type: (!opts.type) ? "string" : opts.type,
            format: opts.format || "string",
            name: opts.name || "",
            required: opts.required || false,
            default: opts.default || "",
            description: opts.description || "",
            message: opts.message || "",
            before: opts.before || function (input) {
                return input;
            },
            conform: opts.conform || function (input) {
                return true;
            }
        };
        return _temp;
    }
};

/*
 *  Input the environment from user and call on API
 * */
 Utility.prototype.inputEnvironment = function (option) {
    var self = this;

    // Setting these properties customizes the prompt.
    prompt.message = prompt.delimiter = "";
    prompt.start();

    return function (callback) {
        prompt.get([option], function (err, result) {
            if (err) throw err;
            self
            .getEnvironment(result[option.name])
            .then(function (result) {
                callback(null, result);
            })
            .fail(function (err) {
                callback(err);
            });
        });
    }
};

/*
 *  Input the custom type like content_type, language etc. from user
 * */
 Utility.prototype.inputCustom = function (option) {
    // Setting these properties customizes the prompt.
    prompt.message = prompt.delimiter = "";
    prompt.start();

    return function (callback) {
        prompt.get([option], function (err, result) {
            if (err) throw err;
            callback(null, result);
        });
    }
};

Utility.prototype.matchConfirm = function (confirm) {
    var regExp = new RegExp('(yes|y)', 'i');
    return (confirm) ? regExp.test(confirm) : undefined;
};

module.exports = Utility;

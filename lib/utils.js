/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

 'use strict';

/**
 * Module Dependencies.
 */
var _ = require('lodash');
var prompt = require('prompt');
var requests = require('request');
var async = require('async');
var pkg = require('../package');
var request = require('./request');
var limit = 100;
var config, api;

/**
 * Utility/helper methods
 * @param {Boolean} skip : Flag to load config/api details
 */
function Utility(skip) {
    if (!skip) {
        config = require('./config').config();
        api = config.get('contentstack');

        // setting the headers
        this.headers = {
            api_key: api.api_key,
            access_token: api.access_token,
            'X-User-Agent': 'contentstack-cli/' + pkg.version
        };
    }
}

/**
 * Iterative function that fetches entries from Contentstack
 * @param  {Object}   req     : Request object
 * @param  {Object}   bucket  : Entries collection, queried so far
 * @param  {Function} fn      : Callback function
 * @return {Object}           : Return entries collection
 */
Utility.prototype.request = function (req, bucket, key, fn) {
  var self = this;
  return request(req, function (error, body) {
    if (error) {
      return fn(error);
    } else if (typeof body.count === 'undefined') {
      // if there are no objects
      return fn(null, bucket);
    }
    bucket = bucket.concat(body[key]);
    req.qs.skip += limit;
    if (req.qs.skip > body.count) {
      return fn(null, bucket);
    }
    return self.request(req, entries, key, fn);
  });
};

/**
 * Get entries from servers
 * @param  {String}   content_type : Content type who's entries are to be fetched
 * @param  {String}   locale       : Locale from where the entries are to be fetched
 * @param  {Object}   _query       : Query filter
 * @param  {Object}   fields       : Fields expected in result
 * @param  {String}   environment  : Environment name
 * @param  {Function} fn           : Callback function
 * @return {Object}                : Return collection of entries, filtered on 'fields'
 */
Utility.prototype.getEntries = function(content_type, locale, _query, fields, environment, fn) {
  if (typeof api.cdn === 'cdn' && typeof api.host === 'string') {
    log(warning(`Querying content from origin server: ${api.host}.`));
    log(warning(`Add 'contentstack.cdn' to fetch data from Contentstack's delivery networks!`));
  }
  var uri = `${api.cdn || api.host}/${api.version}${api.urls.content_types}${content_type}${api.urls.entries}?locale=${locale}`;
  if (typeof environment === 'string') {
    uri += `&environment=${environment}`;
  }
  for (var i = 0; i < fields.length; i++) {
    uri += `&only[BASE]=${fields[i]}`;
  }
  var query = {
    uri: uri,
    method: 'GET',
    headers: self.headers,
    qs: {
      skip: 0,
      limit: limit,
      desc: 'created_at',
      include_count: true
    },
    json: true
  };
  return self.request(query, [], 'entries', fn);
};

/**
 * Get all content types present in the stack
 * @param  {Function} fn : Callback fn
 * @return {Object}      : Collection of content types fetched in the stack
 */
Utility.prototype.getContentTypes = function (fn) {
  if (typeof api.cdn === 'cdn' && typeof api.host === 'string') {
    log(warning(`Querying content from origin server: ${api.host}.`));
    log(warning(`Add 'contentstack.cdn' to fetch data from Contentstack's delivery networks!`));
  }
  var query = {
    uri: `${api.cdn || api.host}/${api.version}${api.urls.content_types}`,
    method: 'GET',
    headers: self.headers,
    qs: {
      skip: 0,
      limit: limit || 100,
    },
    json: true
  };
  return self.request(query, [], 'content_types', fn);
};

/**
 * API to login into Contentstack
 * @param  {[type]}   user [description]
 * @param  {Function} fn   [description]
 * @return {[type]}        [description]
 */
Utility.prototype.login = function (user, fn) {
  return request({
    uri: `${api.host}/${api.version}${api.urls.session}`,
    headers: this.headers,
    method: 'POST',
    json: user
  }, function (error, body) {
    if (error) {
      return fn(error);
    }
    return fn(null, body);
  });
};

/**
 * Get asset json from selected stack
 * @param  {Object}   req    : Asset request object
 * @param  {Object}   assets : Asset json, queried
 * @param  {Function} fn     : Error first callback function
 * @return {Object}          : Asset collection
 */
Utility.prototype.getAssets = function (req, assets, fn) {
    var self = this;
    return request(req, function(error, body) {
        if (error) {
            return fn(error);
        }
        req.qs.skip += 100;
        assets = assets.concat(body.assets);
        if (typeof body.count === 'undefined' || body.count < req.qs.skip) {
            return fn(null, assets);
        }
        return self.getAssets(req, assets, fn);
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

/**
 * Fetch stack details from Contentstack
 * @param  {String|Undefined}   headers : Header details
 * @param  {Function} fn                : Error first callback
 * @return {Function}                   : Error first callback
 */
Utility.prototype.getStack = function (headers, fn) {
    var self = this;
    return request({
        url: `${api.host}/${api.version}${api.urls.stacks}`,
        headers: headers || self.headers,
        method: 'GET',
        qs: {
            include_discrete_variables: true
        },
        json: true
    }, function (error, body) {
        if (error) {
            return fn(error);
        }
        return fn(error, body);
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

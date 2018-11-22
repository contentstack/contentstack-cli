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
var debug = require('debug')('util');
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
    if (typeof api.cdn === 'string' && typeof api.host === 'string') {
      debug(`Querying content from origin server: ${api.host}.`);
      debug('Add \'contentstack.cdn\' in express config to fetch data from Contentstack\'s delivery networks!');
    }
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
Utility.prototype.request = function(req, bucket, key, fn) {
  var self = this;
  return request(req, function(error, body) {
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
    return self.request(req, bucket, key, fn);
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
Utility.prototype.getEntries = function(content_type, locale, query, fields, environment, fn) {
  var uri = `${api.cdn || api.host}/${api.version}${api.urls.content_types}${content_type}${api.urls.entries}?locale=${locale}`;
  if (typeof environment === 'string') {
    uri += `&environment=${environment}`;
  }

  for (var i = 0; i < fields.length; i++) {
    uri += `&only[BASE]=${fields[i]}`;
  }
  var req = {
    uri: uri,
    method: 'GET',
    headers: this.headers,
    qs: {
      skip: 0,
      limit: limit,
      desc: 'created_at',
      include_count: true
    },
    json: true
  };

  if (typeof query === 'object' && Object.keys(query).length) {
    req.qs.query = query;
  }

  return this.request(req, [], 'entries', fn);
};

/**
 * Get all content types present in the stack
 * @param  {Function} fn : Callback fn
 * @return {Object}      : Collection of content types fetched in the stack
 */
Utility.prototype.getContentTypes = function(fn) {
  var query = {
    uri: `${api.cdn || api.host}/${api.version}${api.urls.content_types}`,
    method: 'GET',
    headers: this.headers,
    qs: {
      skip: 0,
      limit: limit || 100,
      include_count: true
    },
    json: true
  };
  return this.request(query, [], 'content_types', fn);
};

/**
 * API to login into Contentstack
 * @param  {Object}   user : User details such as email/pass
 * @param  {Function} fn   : Error first callback fn
 * @return {Object}        : Stack login details
 */
Utility.prototype.login = function(user, fn) {
  return request({
    uri: `${api.host}/${api.version}${api.urls.session}`,
    headers: this.headers,
    method: 'POST',
    json: user
  }, fn);
};

/**
 * Get asset json from selected stack
 * @param  {Object}   req    : Asset request object
 * @param  {Object}   assets : Asset json, queried
 * @param  {Function} fn     : Error first callback function
 * @return {Object}          : Asset collection
 */
Utility.prototype.getAssets = function(req, assets, fn) {
  var self = this;
  return request(req, function(error, body) {
    if (error) {
      return fn(error);
    }
    req.qs.skip += 100;
    assets = assets.concat(body.assets);
    if (typeof body.count === 'undefined' || req.qs.skip > body.count) {
      return fn(null, assets);
    }
    return self.getAssets(req, assets, fn);
  });
};

/**
 * Get environment details
 * @param  {String}   envName : Environment name
 * @param  {Function} fn      : Error first callback
 * @return {Object}           : Environment details
 */
Utility.prototype.getEnvironment = function(envName, fn) {
  if (typeof envName !== 'string' || typeof fn !== 'function') {
    throw new Error(`Invalid params for 'getEnvironment'!\n${JSON.stringify(arguments)}`);
  }
  return request({
    url: `${api.host}/${api.version}${api.urls.environments}${envName}`,
    headers: this.headers,
    method: 'GET',
    json: true
  }, fn);
};

/**
 * Fetch stack details from Contentstack
 * @param  {String|Undefined}   headers : Header details
 * @param  {Function} fn                : Error first callback
 * @return {Function}                   : Error first callback
 */
Utility.prototype.getStack = function(headers, fn) {
  return request({
    url: `${api.host}/${api.version}${api.urls.stacks}`,
    headers: headers || this.headers,
    method: 'GET',
    qs: {
      include_discrete_variables: true
    },
    json: true
  }, fn);
};

/**
 * Fetch environment details from Contentstack
 * @param  {String|Undefined}   headers : Header details
 * @param  {Object}             query   : Query filter
 * @param  {Function} fn                : Error first callback
 * @return {Function}                   : Error first callback
 */
Utility.prototype.getEnvironments = function(headers, query) {
  var fn;
  if (arguments[0] === 'function') {
    fn = arguments[0];
  } else if (arguments[1] === 'function') {
    fn = arguments[1];
  } else {
    fn = arguments[2];
  }
  return request({
    url: `${api.host}/${api.version}${api.urls.environments}`,
    qs: query || {},
    headers: headers || this.headers,
    method: 'GET',
    json: true
  }, fn);
};

/**
 * Prompt input skeleton
 * @type {Object}
 */
Utility.prototype.inputs = {
  type: function() {
    return {
      type: 'string',
      name: 'type',
      required: false,
      description: 'Input types that you would like to sync..\ncontent_types\nassets\nall\nBy default \'all\' will be selected',
      conform: function(value) {
        return (value == 'content_types' || value == 'assets' || value == 'all');
      },
      before: function(value) {
        return (value) ? value.toLowerCase() : value;
      }
    };
  },
  content_types: function(opts) {
    return {
      type: 'string',
      name: (opts && opts.name) ? opts.name : 'content_types',
      required: false,
      description: (opts && opts.description) ? opts.description : 'Enter the content types that you would like to process.\nElse press ENTER (This will select all content types)',
      ask: function() {
        return (prompt && prompt.history('type').value !== 'assets');
      },
      before: function(input) {
        if (input) {
          return input.split(',');
        }
        return [];
      }
    };
  },
  environment: function() {
    return {
      type: 'string',
      name: 'environment',
      required: true,
      description: 'Enter the environment name you would like to publish/unpublish Or sync',
      before: function(input) {
        return input.toLowerCase();
      }
    };
  },
  language: function(locale) {
    var masterLocale = (locale) ? locale : 'en-us';
    return {
      type: 'string',
      name: 'language',
      default: masterLocale,
      required: true,
      description: 'Enter the locale (language) that you would like to publish/unpublish Or sync',
      before: function(input) {
        return input.trim().toLowerCase();
      },
      conform: function(input) {
        var languages = config.get('languages'),
          idx = _.findIndex(languages, {
            'code': input.trim()
          });
        return (idx > -1);
      }
    };
  },
  custom: function(opts) {
    opts = opts || {};
    var _temp = {
      type: (!opts.type) ? 'string' : opts.type,
      format: opts.format || 'string',
      name: opts.name || '',
      required: opts.required || false,
      default: opts.default || '',
      description: opts.description || '',
      message: opts.message || '',
      before: opts.before || function(input) {
        return input;
      },
      conform: opts.conform || function() {
        return true;
      }
    };
    return _temp;
  }
};

/**
 * Get environment from client
 * @param  {Object} option : Options to select from
 * @return {Object}        : Client's choice
 */
Utility.prototype.inputEnvironment = function(option) {
  var self = this;
  prompt.message = '>';
  prompt.delimiter = '';
  prompt.start();
  return function(callback) {
    prompt.get([option], function(error, result) {
      if (error) {
        return callback(error);
      }
      return self.getEnvironment(result[option.name], callback);
    });
  };
};

/**
 * Get custom input from the user
 * @param  {Object} option : Options to choose from
 * @return {Object}        : Client's choice
 */
Utility.prototype.inputCustom = function(option) {
  prompt.message = '>';
  prompt.delimiter = '';
  prompt.start();
  return function(callback) {
    prompt.get([option], function(err, result) {
      if (err) throw err;
      callback(null, result);
    });
  };
};

/**
 * Match client's input
 * @param  {String} confirm : Client input
 * @return {Boolean}        : Return true, if match confirmed
 */
Utility.prototype.matchConfirm = function(confirm) {
  var regExp = new RegExp('(yes|y)', 'i');
  return (confirm) ? regExp.test(confirm) : undefined;
};

module.exports = Utility;
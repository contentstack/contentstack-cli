/*!
 * contentstack-cli
 * copyright (c) Contentstack
 * MIT Licensed
 */

'use strict';

/**
 * Module Dependencies.
 */
var request = require('request'),
    Q = require('q');

/*
 * Application defined variables
 * */

module.exports = function(options) {
    var deferred = Q.defer();
    options.method = options.method || "GET";
    request(options, function(err, response, body) {
        if(err || body.error_code || body.error_message) {
            deferred.reject(err || body);
        } else {
            deferred.resolve(body);
        }
    });
    return deferred.promise;
};

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
    Q = require('q'),
    util = require('util'),
    _ = require('lodash'),
    prompt = require('prompt'),
    async = require('async'),
    EventEmitter = require('events').EventEmitter;

var utility = require('./utils'),
    utility = new utility(),
    helper = require('./helper'),
    config = require('./config'),
    sync = config.sync(),
    config = config.config(),
    languages = config.get('languages'),
    q, isProgress, backup;
/*
 * Application defined variables
 * */

prompt.delimeter = "";

function Sync(args) {
    q = [];
    isProgress = false;

    this._options = args || {};
    // Inherit methods from EventEmitter
    EventEmitter.call(this);

    // Remove memory-leak warning about max listeners
    this.setMaxListeners(0);

    // expose prototypes
    this.initialise = _.bind(this.initialise, this);

    // initalise the Synchronize command
    this.initialise(args);

    // proceed next queue if present
    var next = function () {
        if (q.length > 0) {
            var entryData = q.shift();
            this.start(entryData);
            console.log("\nEntry info: " + JSON.stringify(entryData.message.body));
        } else {
            isProgress = false;
            console.log("=============== Synchronization requests completed successfully ===============");
        }
    };

    // start sync-utility
    this.sync = new sync(next, true);

    next.bind(this.sync);
};

util.inherits(Sync, EventEmitter);

module.exports = Sync;

/*
* Get the user inputs
* */
Sync.prototype.initialise = function(cmdInputs) {
    try {
        var self = this,
            inputs = [],
            fn;

        self.inputs = {};

        backup = utility.matchConfirm(cmdInputs['backup']);
        delete cmdInputs['backup'];

        for(var key in cmdInputs) {
            if(key && typeof self._options[key] === 'undefined') {
                switch (key) {
                    case 'environment':
                        fn = utility.inputEnvironment(utility.inputs.environment());
                        break;
                    case 'language':
                        fn = utility.inputCustom(utility.inputs.language());
                        break;
                    case 'content_types':
                        fn = utility.inputCustom(utility.inputs.content_types());
                        break;
                    case 'skip_content_types':
                        fn = utility.inputCustom(utility.inputs.content_types({name: "skip_content_types", description: "Enter the content types to be skipped(hit return/enter for none or type \",\" comma seperated content type uids): "}));
                        break;
                    case 'datetime':
                        fn = utility.inputCustom(utility.inputs.custom({name: "datetime", format: "date-time", description: "Enter the date-time(ISO String Format) from where you want to synchronize your data(hit return/enter for all data): ", conform: function(input) { if(Date.parse(input) != "NaN") { return true;} return false; }, before: function(input) { if(input && Date.parse(input) != "NaN") { return new Date(input).toISOString(); } return input; }}));
                        break;
                }
                if(fn) inputs.push(fn);
            } else {
                if(key === 'environment' && self._options[key]) {
                    inputs.push((function(environment){
                        return function (callback) {
                            utility
                                .getEnvironment(environment)
                                .then(function(result) {
                                    callback(null, result);
                                })
                                .fail(function(err) {
                                    callback(err);
                                });
                        }
                    }(self._options[key])));
                } else {
                    self.inputs[key] = self._options[key];
                }
            }
        }
        async
            .series(inputs, function(err, result) {
                try {
                    if(err) throw err;
                    for(var i = 0, total = result.length; i < total; i++) {
                        if(result[i] && typeof result[i] == "object") {
                            for(var key in result[i]) {
                                self.inputs[key] = result[i][key];
                            }
                        }
                    }
                    helper.confirm(config, self.inputs.language, backup, function(err) {
                        if(err) throw err;
                        self.loadData();
                    });
                } catch (err) {
                    console.error("Init Error : ", err);
                }
            });
    } catch(err) {
        console.error("Init Error : ", err);
    }
};

/*
* Load all the entries from the content_types
* */
Sync.prototype.loadData = function() {
    var self = this,
        _calls = [],
        _query =  {
            "_metadata.publish_details": {
                "$elemMatch": {
                    "environment": self.inputs.environment.uid,
                    "locale": self.inputs.language
                }
            }
        };

    if(self.inputs.datetime) _query["_metadata.publish_details"]["$elemMatch"]["time"] = {"$gte": self.inputs.datetime};

    var _loadEntries = function(_content_types) {
        for(var i = 0, total = _content_types.length; i < total; i++) {
            _calls.push(function(content_type) {
                return utility.getEntries(content_type, self.inputs.language, _query, ['_metadata'])
                    .then(function(entries) {
                        console.log("Total %d entries of ContentType %s retrieved.", entries.length, content_type);
                        return self.parseEntries(entries, content_type);
                    })
                    .fail(function(err) {
                        console.log("Error in retriveing entries: ", err, content_type);
                    });
            }(_content_types[i]));
        };
        Q.all(_calls)
            .then(function(entries) {
                entries = entries.reduce(function(prev, crnt) {
                    if(Array.isArray(crnt)) {
                        prev = prev.concat(crnt);
                    }
                    return prev;
                }, []);
                console.log("Total entries %d are synchronized.", entries.length);
            })
            .fail(function(error) {
                console.log("Synchronization error: ", error.message);
            });
    };

    // calculating the content_types to be used
    if(self.inputs.content_types.length) {
        self.inputs.content_types = _.difference(self.inputs.content_types, self.inputs.skip_content_types);
        _loadEntries(self.inputs.content_types);
    } else {
        utility
            .getContentTypes()
            .then(function(content_types) {
                if(content_types && content_types.content_types && content_types.content_types.length) {
                    content_types = _.difference(_.pluck(content_types.content_types, "uid"), self.inputs.skip_content_types);
                    _loadEntries(content_types);
                } else {
                    console.log("No ContentTypes found.");
                }
            }).fail(function(error) {
                console.log("ContentTypes retrieval error: ", error.message);
            });
    }
};

/*
 * Load all the parse Entries
 * */
Sync.prototype.parseEntries = function(entries, content_type) {
    try {
        var self = this;
        var deferred = Q.defer();
        console.log("Restoring %d entries of %s ContentType.", entries.length, content_type);
        for (var i = 0, total = entries.length; i < total; i++) {
            if(entries[i] && entries[i]['_metadata'] && entries[i]['_metadata']['publish_details']) {
                var idx = _.findIndex(entries[i]['_metadata']['publish_details'], {environment: self.inputs.environment.uid, locale: self.inputs.language});
                var _lang = _.findIndex(languages, {'code': self.inputs.language});
                if(~idx && ~_lang) {
                    q.push({
                        message: {
                            body:{
                                object: {
                                    form: {
                                        title: content_type,
                                        form_uid: content_type
                                    },
                                    entry: {
                                        title: entries[i]['title'] || entries[i]['_metadata']['uid'],
                                        locale: entries[i]['_metadata']['publish_details'][idx]['locale'] || "en-us",
                                        version: entries[i]['_metadata']['publish_details'][idx]['version'],
                                        entry_uid: entries[i]['_metadata']['uid']
                                    },
                                    locale: [self.inputs.language],
                                    environment: [self.inputs.environment.uid],
                                    action: "publish",
                                    type: "entry"
                                },
                                restore: true
                            }
                        },
                        lang: languages[_lang]
                    });
                    if (!isProgress) {
                        var entryData = q.shift();
                        self.sync.start(entryData);
                        isProgress = true;
                        console.log("=============== Started synchronizing content ===============");
                        console.log("Entry info: " + JSON.stringify(entryData.message.body));
                    }
                }
            }
        }
        deferred.resolve(entries);
        return deferred.promise;
    } catch (e) {
        console.error("Error " + e.message);
    }
};

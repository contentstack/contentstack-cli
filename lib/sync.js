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
 q, isProgress, backup, bound = 50;
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
 Sync.prototype.initialise = function (cmdInputs) {
 	try {
 		var self = this,
 		inputs = [],
 		fn;

 		self.inputs = {};

 		backup = utility.matchConfirm(cmdInputs['backup']);
 		delete cmdInputs['backup'];

 		async.series([
 			function (cb) {
 				utility
 				.getStack()
 				.then(function (body) {
 					if (body && body.stack) {
 						if (body.stack.discrete_variables && body.stack.discrete_variables._version && body.stack.discrete_variables._version >= 3) {
 							cb(null, body.stack.master_locale)
 						} else {
 							cb("\x1b[31mThe " + body.stack.name + " stack is currently on version 2 which is not supported by contentstack-express version 3. \nKindly contact support-contentstack@built.io for upgrading your Stack to version 3.\x1b[0m");
 						}
 					} else {
 						cb("\x1b[31mApi key or access token is not valid. Please retry.\x1b[0m");
 					}
 				}, function (err) {
 					cb(err);
 				});
 			}
 			], function (err, data) {
 				var masterLocale = (data && data.length) ? data[0] : 'en-us';
 				if (!err) {
 					for (var key in cmdInputs) {
 						if (key && typeof self._options[key] === 'undefined') {
 							switch (key) {
 								case 'type':
 								fn = utility.inputCustom(utility.inputs.type());
 								break;
 								case 'environment':
 								fn = utility.inputEnvironment(utility.inputs.environment());
 								break;
 								case 'language':
 								fn = utility.inputCustom(utility.inputs.language(masterLocale));
 								break;
 								case 'content_types':
 								fn = utility.inputCustom(utility.inputs.content_types());
 								break;
 								case 'skip_content_types':
 								fn = utility.inputCustom(utility.inputs.content_types({
 									name: "skip_content_types",
 									description: "Enter the content types to be skipped(hit return/enter for none or type \",\" comma seperated content type uids): "
 								}));
 								break;
 								case 'datetime':
 								fn = utility.inputCustom(utility.inputs.custom({
 									name: "datetime",
 									format: "date-time",
 									description: "Enter the date-time(ISO String Format) from where you want to synchronize your data(hit return/enter for all data): ",
 									conform: function (input) {
 										if (Date.parse(input) != "NaN") {
 											return true;
 										}
 										return false;
 									},
 									before: function (input) {
 										if (input && Date.parse(input) != "NaN") {
 											return new Date(input).toISOString();
 										}
 										return input;
 									}
 								}));
 								break;
 							}
 							if (fn) inputs.push(fn);
 						} else {
 							if (key === 'environment' && self._options[key]) {
 								inputs.push((function (environment) {
 									return function (callback) {
 										utility
 										.getEnvironment(environment)
 										.then(function (result) {
 											callback(null, result);
 										})
 										.fail(function (err) {
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
 					.series(inputs, function (err, result) {
 						try {
 							if (err) throw err;
 							for (var i = 0, total = result.length; i < total; i++) {
 								if (result[i] && typeof result[i] == "object") {
 									for (var key in result[i]) {
 										self.inputs[key] = result[i][key];
 									}
 								}
 							}
 							helper.confirm(config, self.inputs.language, backup, function (err) {
 								if (err) throw err;
 								async.waterfall([
 									function (cb) {
 										switch (self.inputs.type) {
 											case "assets":
 											self.assets(cb);
 											break;
 											case "content_types":
 											self.loadData();
 											break;
 											default:
 											async.series([
 												function (cb) {
 													self.assets(cb);
 												},
 												function (cb) {
 													self.loadData();
 												}
 												]);
 										}
 									}
 									], function (err, result) {
 									});
 							});
 						} catch (err) {
 							console.error("Init Error : ", err.message);
 						}
 					});
 				} else {
 					console.error("Init Error : ", err.message || err);
 				}
 			});
} catch (err) {
	console.error("Init Error : ", err.message);
}
};

/*
 * Load all the entries from the content_types
 * */
 Sync.prototype.loadData = function () {
 	var self = this,
 	_calls = [];
 	var _loadEntries = function (_content_types) {
 		for (var i = 0, total = _content_types.length; i < total; i++) {
 			_calls.push(function (content_type) {
 				return utility.getEntries(content_type, self.inputs.language, {}, ['publish_details', '_version'], self.inputs.environment.name)
 				.then(function (entries) {
 					var _entries = [];
 					if (self.inputs.datetime) {
 						for (var i = 0; i < entries.length; i++) {
                                // this is for the API Stack 3.1 with new response
                                if (!(entries[i]['publish_details'] instanceof Array) && typeof entries[i]['publish_details'] === "object") {
                                	entries[i]['publish_details']['version'] = entries[i]["_version"]
                                	entries[i]['publish_details'] = [entries[i]['publish_details']]
                                } 
                                _.findIndex(entries[i]['publish_details'], function (object) {
                                	if (object.locale === self.inputs.language && object.environment === self.inputs.environment.uid && object.time && object.time >= self.inputs.datetime) {
                                		_entries.push(entries[i]);
                                	}
                                });
                            }
                        } else {
                        	_entries = entries || [];
                        }
                        console.log("Total %d entries of ContentType %s retrieved.", _entries.length, content_type);
                        return self.parseEntries(_entries, content_type);
                    })
 				.fail(function (err) {
 					console.log("Error in retriveing entries: ", err, content_type);
 				});
 			}(_content_types[i]));
 		}
 		Q.all(_calls)
 		.then(function (entries) {
 			entries = entries.reduce(function (prev, crnt) {
 				if (Array.isArray(crnt)) {
 					prev = prev.concat(crnt);
 				}
 				return prev;
 			}, []);
 			console.log("Total entries %d are synchronized.", entries.length);
 		})
 		.fail(function (error) {
 			console.log("Synchronization error: ", error.message);
 		});
 	};

    // calculating the content_types to be used
    if (self.inputs.content_types.length) {
    	self.inputs.content_types = _.difference(self.inputs.content_types, self.inputs.skip_content_types);
    	_loadEntries(self.inputs.content_types);
    } else {
    	utility
    	.getContentTypes()
    	.then(function (content_types) {
    		if (content_types && content_types.content_types && content_types.content_types.length) {
    			content_types = _.difference(_.pluck(content_types.content_types, "uid"), self.inputs.skip_content_types);
    			_loadEntries(content_types);
    		} else {
    			console.log("No ContentTypes found.");
    		}
    	}).fail(function (error) {
    		console.log("ContentTypes retrieval error: ", JSON.stringify(error));
    	});
    }
};

/*
 * Load all the parse Entries
 * */
 Sync.prototype.parseEntries = function (entries, content_type) {
 	try {
 		var self = this;
 		var deferred = Q.defer();
 		console.log("Restoring %d entries of %s ContentType.", entries.length, content_type);
 		for (var i = 0, total = entries.length; i < total; i++) {
 			if (entries[i] && entries[i]['publish_details']) {
                 // this is for the API Stack 3.1 with new response
                 if (!(entries[i]['publish_details'] instanceof Array) && typeof entries[i]['publish_details'] === "object") {
                 	entries[i]['publish_details']['version'] = entries[i]["_version"]
                 	entries[i]['publish_details'] = [entries[i]['publish_details']]
                 } 
                 var idx = _.findIndex(entries[i]['publish_details'], {
                 	environment: self.inputs.environment.uid,
                 	locale: self.inputs.language
                 });
                 var _lang = _.findIndex(languages, {'code': self.inputs.language});
                 if (~idx && ~_lang) {
                 	q.push({
                 		message: {
                 			body: {
                 				object: {
                 					content_type: {
                 						title: content_type,
                 						uid: content_type
                 					},
                 					entry: {
                 						title: entries[i]['title'] || entries[i]['uid'],
                 						locale: entries[i]['publish_details'][idx]['locale'] || "en-us",
                 						version: entries[i]['publish_details'][idx]['version'],
                 						entry_uid: entries[i]['uid']
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
                 		console.log("=============== Started synchronizing content ===============");
                 		self.sync.start(entryData);
                 		isProgress = true;
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

/*
 * Load all the assets from the Stack
 * */
 Sync.prototype.assets = function (_callback) {
 	var self = this,
 	options = {
 		environment: self.inputs.environment.name,
 		locale: self.inputs.language,
 		skip: 0,
 		limit: bound,
 		include_count: true,
 		query: {
 			"publish_details.locale": self.inputs.language
 		},
 		only: {
 			BASE: ['publish_details', 'filename', '_version']
 		}
 	};

 	var loadBatch = function (total) {
 		var index = 0,
 		calls = [];
 		while (index < total) {
 			calls.push(function (skip, limit) {
 				return function (cb) {
 					options.skip = skip;
 					options.limit = limit;
 					delete options.include_count;
 					utility
 					.getAssets(options)
 					.then(function (body) {
 						if (body && body.assets && body.assets.length) {
 							cb(null, body.assets);
 						} else {
 							cb(body, null);
 						}
 					})
 				}
 			}(index, bound));
 			index = index + bound;
 		}

 		async.series(calls, function (err, data) {
 			var _calls = [];
 			if (!err && data && data.length) {
 				for (var i = 0; i < data.length; i++) {
 					_calls.push(function (assets) {
 						return function (_cb) {
 							var _assets;
 							if (self.inputs.datetime) {
 								_assets = [];
 								for (var i = 0; i < assets.length; i++) {
 									if (assets[i] && assets[i]['publish_details']) {
                                                 // this is for the API Stack 3.1 with new response
                                                 if (!(assets[i]['publish_details'] instanceof Array) && typeof assets[i]['publish_details'] === "object") {
                                                 	assets[i]['publish_details'] = [assets[i]['publish_details']]
                                                 }    
                                                 _.findIndex(assets[i]['publish_details'], function (object) {
                                                 	if (object.locale === self.inputs.language && object.environment === self.inputs.environment.uid && object.time && object.time >= self.inputs.datetime) {
                                                 		_assets.push(assets[i]);
                                                 	}
                                                 });
                                             }
                                         }
                                     }
                                     else {
                                     	_assets = assets;
                                     }
                                     publishAssets(_assets, _cb);
                                     _cb(null, _assets);
                                 }

                             }(data[i])
                             )
 				}
 				async.parallel(_calls, function (err, data) {
 					if (!err && data && data.length) {
 						var total = 0;
 						for (var i = 0; i < data.length; i++) {
 							total = total + data[i].length;
 						}
 						console.log("Assets = ", total);
 					}
 					_callback();
 				});
 			}
 			else {

 			}
 		}
 		)
 		;
 	};
 	var publishAssets = function (assets) {
 		try {
 			for (var i = 0; i < assets.length; i++) {
 				if (assets[i] && assets[i]['publish_details']) {
 					var _lang = _.findIndex(languages, {'code': self.inputs.language});
 					if (~_lang) {
 						var _entry = {
 							title: assets[i]['filename'] || assets[i]['uid'],
 							entry_uid: assets[i]['uid']
 						};
 						
 						if(assets[i]['_version']) _entry['version'] = assets[i]['_version'];

 						q.push({
 							message: {
 								body: {
 									object: {
 										entry: _entry,
 										locale: [self.inputs.language],
 										environment: [self.inputs.environment.uid],
 										action: "publish",
 										type: "asset"
 									},
 									restore: true
 								}
 							},
 							lang: languages[_lang]
 						});
 						if (!isProgress) {
 							var assetData = q.shift();
 							console.log("=============== Started synchronizing Assets ===============");
 							self.sync.start(assetData);
 							isProgress = true;
 							console.log("Asset info: " + JSON.stringify(assetData.message.body));
 						}
 					}
 				}
 			}
 		} catch (e) {
 			console.error("Asset publishing/unpublishing failed ", e.message);
 		}
 	};

 	utility
 	.getAssets(options)
 	.then(function (body) {
 		if (body && body.assets && body.assets.length) {
 			loadBatch(body.count);
 		} else {
 			console.error('Asset count "Not Received", skipping assets sync.');
 			_callback();
 		}
 	})
 	.fail(function (err) {
 		console.error("Asset publishing/unpublishing failed ", JSON.stringify(err));
 		_callback();
 	});
 };


/**
  Import utilities
  @ignore
*/

var Skematic = require('skematic');


/**
  Driver dependencies
*/

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;


/**
  Export adapter
*/

module.exports = new MongoAdapter();


/**
  The core module
*/

function MongoAdapter() {}


/**
  Prototype shorthand
*/

var adapter = MongoAdapter.prototype;


/**
  Enable additonal Adapter instantiation from adapter instances
*/

adapter.new = function () { return new MongoAdapter(); };


/**
  Internal reference to the DB connection
*/

adapter.CONNECTED = false;
adapter.db = {};


var _queue = [];
var _spawning = false;


/**
  Adapter configuration
*/

var cfg = adapter.config = {
  host: '127.0.0.1',
  port: '27017',
  db: 'test',
  username: '',
  password: '',
  delegate: null
};


/**
  Adapter interface
*/

adapter.exec = function (query, cb) {
  if (!cb) return false;
  if (!query.do || !query.on) return cb('Invalid query: requires .do and .on');

  if (!this.CONNECTED) {
    _queue.push({query:query, cb:cb});
    return _spawning ? null : this.connect(cb);
  }

  if (this[ query.do ]) return this[ query.do ](query, cb);
  else cb('Adapter does not implement action: ' + query.do);
};


/**
  Connects the adapter to a test MongoDB

  @param {Function} cb The adapter.exec callback to pass errors to on fail

  @see https://mongodb.github.io/node-mongodb-native/2.0/tutorials/connecting/
*/

adapter.connect = function (cb) {
  if (_spawning) return;

  var self = this;

  var url = 'mongodb://';
  if (cfg.username) url += cfg.username + ':' + cfg.password + '@';
  url += cfg.host + ':' + cfg.port + '/' + cfg.db;
  if (cfg.delegate) url += '?authSource=' + cfg.delegate;

  // STATE EVIL
  _spawning = true;

  MongoClient.connect( url, function(err, db) {
    // STATE EVIL
    _spawning = false;

    if (err) return cb('DB Connect failed: ' + err);

    self.CONNECTED = true;
    self.db = db;
    db.on( 'close', function(){ self.CONNECTED = false; });

    while (_queue.length) {
      var q = _queue.shift();
      self.exec( q.query, q.cb );
    }
  });
};


/**
  Stub to close the database connection
*/

adapter.disconnect = function () {
  if (this.db.close) this.db.close();
  this.CONNECTED = false;
};



/**
  Helper: Selector map - Query match conditions to Mongo selector
*/

var _mapOperators = function (match) {
  if (!match) return {};
  var str = JSON.stringify(match);

  var _map = {
    and: '$and',
    or: '$or',
    eq: '$eq',
    neq: '$ne',
    in: '$in',
    nin: '$nin',
    all: '$all',
    gt: '$gt',
    gte: '$gte',
    lt: '$lt',
    lte: '$lte'
  };

  // Replace Query operators for Mongo operators
  for (var k in _map) {
    var regex = new RegExp( '{"' + k + '"', 'g');
    str = str.replace( regex, '{"' + _map[k] + '"');
  }

  return JSON.parse(str);
};


/**
  Helper: Id map - create a selector for .ids
*/

var _mapIdSelector = function (ids) {
  return {_id: {'$in': ids.map(function(i) { return new ObjectID(i); }) } };
};


/**
  Generate a Mongo 'query' (selector) based on Qe `.match` and `.ids`

  @param {QueryEnvelope} qe
  @return {Object} The mongo query selector
*/

var selectorFromQe = function (qe) {
  var sel = _mapOperators( qe.match );
  if (qe.ids) sel._id = _mapIdSelector( qe.ids )._id;
  return sel;
};


/**
  Generates a Mongo projection map from array of selector strings
  eg: ['-name','-age'] => {name:0, age:0}

  @param {String[]} arr Array of string selectors
  @param {Number} [negValue] The value to apply to 'negative' keys (default:0)

  @return {Object} Mongo projection map
*/

var setProjection = function (arr, negValue) {
  if (!arr) return {};
  if (typeof negValue === 'undefined') negValue = 0;

  var ret = {};

  arr.forEach( function (s) {
    s[0] === '-'
      ? ret[ s.slice(1) ] = negValue
      : ret[s] = 1;
  });

  return ret;
};


/**
  Generates a Mongo 'sort' object
  Uses almost the same code as 'setProjection' but passes '-1' sort direction
  as the value to apply to the key when "negative"

  @param {String[]} arr Array of string keys (optionally prefixed with '-')
  @return {Object} Mongo sort object
*/

var setSort = function (arr) {
  return setProjection( arr, -1 );
};



/**
  Generate a hash of keyed arrays containing the identifiers to lookup.

  @param {String[]} keys A list of fields to inspect on each doc in `docs`
  @param {Object[]} docs Array of documents to inspect

  @return {Object} An object hash of `keys` with arrays of identifiers to lookup
*/

var buildLinkedHash = function(keys, docs) {
  var ret = {};
  keys.forEach(function (k) { ret[k] = []; });
  var len = docs.length;
  var counter = 0;
  while (len--) {
    counter++;
    // Iterate each key to build lookup table per document
    var klen = keys.length;
    while(klen--) {
      counter++;
      var key = keys[klen];
      // Mongo does not require unique keys, so it's permitted to add all
      ret[key].push.apply(ret[key], docs[len][key]);
    }
  }
  return ret;
};


/**
  Retrieves linked data based on the `qe.populate` fields for a given set
  of documents `docs`.

  @param {QueryEnvelope} qe The Qe containing a `.populate` field
  @param {Array} docs The list of documents to load relation data from
  @param {MongoConnection} db The connection to the mongoDB
  @param {Function} cb The adapter callback to execute on completion
  @param {Adapter} self A reference to this instance of the adapter

  @private
*/

var getLinkedData = function (qe, docs, db, cb, self) {
  var populate = qe.populate;
  var keys = Object.keys(populate);

  // -- Build lookup table
  var linked = buildLinkedHash(keys, docs);

  // -- Perform lookups
  var toDone = keys.length;
  var onDone = function () {
    cb(null, toReplyFormat(docs, qe.on, linked) );
  };
  for (var i=0; i<keys.length; i++) {
    var field = keys[i], pop = qe.populate[field];
    var nq = pop.query || {on:field};

    // Build new query for linked data
    if (pop.key) {
      var mo = {};
      mo[pop.key] = {in: linked[field]};
      if (nq.match) {
        if (nq.match.and) nq.match.and.push(mo);
        else nq.match = {and:[mo, nq.match]};
      }
      else nq.match = {and:[mo]};
    }
    else nq.ids = linked[field];

    // Required to keep an internal reference to `field` and `nq.on`
    /*jshint loopfunc: true */
    (function (field, remoteKey) {

      self.find( nq, function (e, r) {
        if (e) { toDone = -1; return cb(e); }
        linked[field] = r[remoteKey];
        if (!--toDone) onDone();
      });

    })(field, nq.on);
  }
};


/**
  Generates a compliant response payload from `res` and `key`

  @todo Return a function with bound values for `on` and `cb`

  @param {Mixed} res Usually an Array of documents
  @param {String} [key] The key of the document collection (`Qe.on`)
  @param {Object} [linked] Object hash {<field>:[results]} of relation data

  @return {Object} A compliant object response payload
*/

var toReplyFormat = function (res, key, linked) {
  key || (key = 'data');
  var ret = {};

  if (res instanceof Array) ret[key] = mapIDs( res );
  else ret[key] = res;

  if (linked) ret.linked = linked;
  return ret;
};


/**
  Creates a Mongo 'update operator' hash

  @param {Object[]} updates An array of Qe update operators

  @return {Object} A Mongo formatted update operator object
*/

var buildUpdateOperator = function (updates) {
  var ret = {};

  // Return first key in o
  var fk = function (o) { for (var k in o) { return k; } };
  // Create a single key object {k:v}
  var oo = function (k, v) { var o = {}; o[k] = v; return o; };

  var len = updates.length;
  while (len--) {
    var updt = updates[len];
    for (var k in updt) {
      var op = fk(updt[k]), v = updt[k][op];
      // Enable push array values to each be added
      if (op === 'push' && v instanceof Array) v = {$each: v};
      // Map pull array to `pullAll`
      if (op === 'pull' && v instanceof Array) op = 'pullAll';

      if (!ret['$' + op]) ret[ '$' + op ] = oo(k, v);
      else ret['$' + op][k] = v;
    }
  }

  return ret;
};


/**
  Converts Mongo _id {ObjectID} on collection objects to a String

  @param {Object[]} col The collection to map
*/

var mapIDs = function (col) {
  for (var i=0; i < col.length; i++) {
    col[i]._id = col[i]._id.toString();
  }
  return col;
};

/**
  CRUDL
*/

adapter.create = function (qe, cb) {
  this.db
    .collection( qe.on )
    .insert( qe.body, {}, function (err, res) {
      // @todo These repeated sections could be factored into a partial
      // that returns a function with values set for `on` and `cb`
      if (err) return cb(err);
      cb(null, toReplyFormat( res.ops, qe.on ));
    });
};

adapter.update = function (qe, cb) {
  var sel = selectorFromQe( qe );

  // Bail out if no selectors are set (nothing to update)
  if (!Object.keys(sel).length) return cb(null, []);

  var buildMongoQuery = function (qe) {
    var mq = {};

    // Overwrites `mq`
    if (qe.updates) mq = buildUpdateOperator(qe.updates);

    // Currently only supports providing a SINGLE body element
    /* istanbul ignore else */
    if (qe.body) {
      mq['$set'] = qe.body[0];
    }

    return mq;
  };

  // Set "multi" update flag if likely to update more than one record
  var opts = {multi: false};
  if ( (qe.ids && qe.ids.length > 1) || qe.match) opts.multi = true;

  var mq = buildMongoQuery(qe);
  this.db
    .collection( qe.on )
    .update( sel, mq, opts, function (err, res) {
      // @todo These repeated sections could be factored into a partial
      // that returns a function with values set for `on` and `cb`
      if (err) return cb(err);
      cb(null, toReplyFormat( res.result.nModified, qe.on ));
    });
};

adapter.remove = function (qe, cb) {
  var sel = selectorFromQe( qe );

  var opts = {};

  this.db
    .collection( qe.on )
    .remove( sel, opts, function (err, res) {
      // @todo These repeated sections could be factored into a partial
      // that returns a function with values set for `on` and `cb`
      if (err) return cb(err);
      cb(null, toReplyFormat( res.result.n, qe.on ));
    });
};

adapter.find = function (qe, cb) {
  var sel = selectorFromQe( qe );
  var projection = setProjection( qe.select );

  var request = this.db
    .collection( qe.on )
    .find( sel, projection );

  if (qe.sort) request.sort( setSort(qe.sort) );
  // Limits and offsets need to happen AFTER a sort (or you'll end up sorting
  // on a limited set of results)
  if (qe.limit) request.limit( qe.limit );
  if (qe.offset) {
    /* istanbul ignore else */
    if (typeof qe.offset === 'number') request.skip( qe.offset );
  }

  // If no 'populate' directive, return results
  if (!qe.populate) {
    return request.toArray(function (err, res) {
      // @todo These repeated sections could be factored into a partial
      // that returns a function with values set for `on` and `cb`
      if (err) return cb(err);
      cb(null, toReplyFormat( res, qe.on ));
    });
  }

  // Handle Populate directives
  var self = this;
  request.toArray( function (err, docs) {
    if (err) return cb(err);
    getLinkedData(qe, docs, self.db, cb, self);
  });
};

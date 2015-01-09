
/**
  Qe dependencies
*/

var Adapter = require('qe-adapter');


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

adapter.new = function () { return new Adapter(); };


/**
  Internal reference to the DB connection
*/

adapter.CONNECTED = false;
adapter.db = {};


var _queue = [];
var _spawning = false;


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
  else cb('Adapter does not implement action: '+query.do);
};


/**
  Connects the adapter to a test MongoDB

  @param {Function} cb The adapter.exec callback to pass errors to on fail
*/

adapter.connect = function (cb) {
  if (_spawning) return;

  var self = this;

  var url = 'mongodb://127.0.0.1:27017/test';

  // STATE EVIL
  _spawning = true;

  MongoClient.connect( url, function(err, db) {
    // STATE EVIL
    _spawning = false;

    if (err) return cb('DB Connect failed: '+err);

    self.CONNECTED = true;
    self.db = db;

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
  this.db.close && this.db.close();
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
    str = str.replace( '{"'+k+'"', '{"'+_map[k]+'"');
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

  @return {Object} Mongo projection map
*/

var setProjection = function (arr) {
  if (!arr) return {};

  var ret = {};

  arr.forEach( function (s) {
    s[0] === '-'
      ? ret[ s.slice(1) ] = 0
      : ret[s] = 1;
  });

  return ret;
};


/**
  CRUDL
*/

adapter.create = function (qe, cb) {
  this.db
    .collection( qe.on )
    .insert( qe.body, {}, cb );
};

adapter.update = function (qe, cb) {
  var sel = selectorFromQe( qe );

  // Bail out if no selectors are set (nothing to update)
  if (!Object.keys(sel).length) return cb(null, []);

  var buildMongoQuery = function (qe) {
    var mq = {};

    // Currently only supports providing a SINGLE body element
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
    .update( sel, mq, opts, cb );
};

adapter.remove = function (qe, cb) {
  var sel = selectorFromQe( qe );

  var opts = {};

  this.db
    .collection( qe.on )
    .remove( sel, opts, cb );
};

adapter.find = function (qe, cb) {
  var sel = selectorFromQe( qe );

  var projection = setProjection( qe.select );

  this.db
    .collection( qe.on )
    .find( sel, projection )
    .toArray( cb );
};

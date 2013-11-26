/**
 * Module dependencies
 */

var adapter = require( 'mekanika-adapter' )

  // Mongo drivers
  , MongoClient = require('mongodb').MongoClient
  , Server = require('mongodb').Server
  , ObjectID = require('mongodb').ObjectID
  , Db = require('mongodb').Db

    // Configuration settings
  , config = require( './config' ).core
  , serverOpts = require( './config' ).serverOptions
  , dbOpts = require( './config' ).dbOptions

    // Adapter utilities
  , utils = require( './utils' );


// Internal registers
var _spawning = false;
var _queue = [];


/**
 * Initialise a new blank adapter
 */

var mongo = adapter('mongo');


/**
 * Export the mongo adapter
 */

module.exports = mongo;


/**
 * Export the cached connection to the database
 *
 * @type {Object}
 * @public
 */

mongo.connection = {};


/**
 * Sets up a connection to a mongo DB
 *
 * Creates and caches a `connection` to the database and then executes any
 * queries in the private `_queue`.
 *
 * @private
 */

function buildConnection() {
  // Let the system know we're trying to connect
  _spawning = true;

  mongo.connect( function( err, db) {
    // Reset connecting flag
    _spawning = false;

    // Run all queued queries
    while( _queue.length ) {
      var run = _queue.shift();
      mongo.exec( run.query, run.cb );
    }
  });
}


/**
 * Execute a Query against this adapter
 *
 * @param {Query}
 * @param {Function} cb Called by delegates on completion, passed `(err, res)`
 * @public
 */

mongo.exec = function( query, cb ) {
  // Check we have a connection
  if ( !mongo.connection.db ) {
    // Defer query
    _queue.push( {query:query, cb:cb} );

    // Connect to DB if this is the first attempt to do so
    return _spawning ? null : buildConnection();
  }

  switch( query.action ) {
    case 'create': this.create( query, cb ); break;
    case 'delete': this.remove( query, cb ); break;
    case 'update': this.update( query, cb ); break;
    case 'find': this.find( query, cb  );
  }
};


/**
 * Applies `options` to the adapter configuration
 * No argument simply returns the current config
 *
 * @returns {Object} config Updated onfiguration options
 */

mongo.configure = function( options ) {
  // Set an empty config options as default if nothing passed
  options || (options = {});
  var keys = Object.keys( options );
  while( keys.length ) {
    var key = keys.shift();
    if ( config[ key ] !== undefined )
      config[ key ] = options[ key ];
    else
      throw new Error( 'No such config option: '+key );
  }

  // Return the updated configuration
  return config;
};


/**
 * Async connects to a Mongo DB
 * Success return calls `cb( null, db )` where `db` is Mongo db instance
 *
 * @param {Function} cb Returns `cb( err, db )` where db is database handle
 * @public
 */

mongo.connect = function( cb ) {

  // Return a cached connection if one exists
  if (mongo.connection.db) return cb( null, mongo.connection );

  // Create Mongo harness
  var server = new Server( config.host, config.port, serverOpts );
  var db = new Db( config.database, server, dbOpts );


  // Test for authentication present
  var isAuthSet = function() {
    if (config.user.length || config.pass.length) return true;
    else return false;
  };

  // Setup internal adapter references once correctly connected
  var connected = function( db ) {
    // Cache the connection
    mongo.connection = db;
    // Ensure connection is reset if closed somehow
    mongo.connection.on( 'close', function(){ mongo.connection = {}; });
    // Trigger the
    cb( null, mongo.connection );
  };

  var onConnect = function( err ) {
    if ( err ) return cb( err );

    // Attempt authentication if present
    if ( isAuthSet() ) {
      return db.authenticate( config.user, config.pass, function( err, res ) {
        if ( res ) return connected( res, cb );

        if ( err ) return err;
        else return new Error('Auth failed');
      });
    }

    // Return the database connection `db` to the callback
    connected( db, cb );
  };

  // Open the connection to the database
  db.open( onConnect );
};


/**
 * Drops any open connection held to the DB
 *
 * @param {Function} cb Callback( err, res ) on close return from DB
 */

mongo.disconnect = function( cb ) {

  // Force close the local reference to the db
  // -- this is an internal reference and used as a hard lookup
  var onClose = function( err, res ) {
    // Immediately reset the connection
    mongo.connection = {};
    cb( err, res );
  };

  if (mongo.connection.db) mongo.connection.close( cb ? onClose : null );
  else {
    var err = new Error( 'No connection to close' );
    if (cb) cb( err );
    else throw err;
  }
};


/**
 * Create records in the database
 *
 * @param {Query}
 * @param {Function} cb Called on completion, passed `(err, res)`
 * @public
 */

mongo.create = function( query, cb ) {

  var options = {};

  mongo.connection
    .collection( query.resource )
    .insert( query.inputs, options, cb );

};


/**
 * Destroy records in the database
 *
 * @param {Query}
 * @param {Function} cb Called on completion, passed `(err, res)`
 * @public
 */

mongo.remove = function( query, cb ) {

  var selector = utils.selector( query );
  var options = {};

  mongo.connection
    .collection( query.resource )
    .remove( selector, options, cb );

};


/**
 * Updates records in the database
 *
 * @param {Query}
 * @param {Function} cb Called on completion, passed `(err, res)`
 * @public
 */

mongo.update = function( query, cb ) {

  var selector = utils.selector( query );
  var update = utils.modifiers( query );

  // Mongo ref:
  // db.collection.update( <selectors>, <update{}>, <upsertBool>, <multiBool> )

  mongo.connection
    .collection( query.resource )
    .update( selector, update, cb );

};


/**
 * Find records in the database
 *
 * @param {Query}
 * @param {Function} cb Called on completion, passed `(err, res)`
 * @public
 */

mongo.find = function( query, cb ) {
  // Selections
  var selector = utils.selector( query );

  var options = utils.options( query );


  mongo.connection
    .collection( query.resource )
    .find( selector, options )
    .toArray( function( err, res ) {
      cb( err, res );
    });
};

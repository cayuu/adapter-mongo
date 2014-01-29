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
 * Export the mongo adapter
 */

module.exports = exports = adapter('mongo');


/**
 * Export the cached connection to the database
 *
 * @type {Object}
 * @public
 */

exports.connection = {};


/**
 * Sets up a connection to a mongo DB
 *
 * Creates and caches a `connection` to the database and then executes any
 * queries in the private `_queue`.
 *
 * @param {Function} cb Callback to run on db connection reply
 *
 * @private
 */

function buildConnection( cb ) {
  // Let the system know we're trying to connect
  _spawning = true;

  exports.connect( function( err, db) {

    // Reset connecting flag
    _spawning = false;

    // Connection error :(
    if (err) cb( 'Mongo DB connection error: ' + err );
    else {
      // Run all queued queries
      while( _queue.length ) {
        var run = _queue.shift();
        exports.exec( run.query, run.cb );
      }
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

exports.exec = function( query, cb ) {
  // Check we have a connection
  if ( !exports.connection.db ) {
    // Defer query
    _queue.push( {query:query, cb:cb} );

    // Connect to DB if this is the first attempt to do so
    return _spawning ? null : buildConnection( cb );
  }
  else {
    switch( query.action ) {
      case 'create': this.create( query, cb ); break;
      case 'delete': this.remove( query, cb ); break;
      case 'update': this.update( query, cb ); break;
      case 'find': this.find( query, cb  );
    }
  }
};


/**
 * Applies `options` to the adapter configuration
 * No argument simply returns the current config
 *
 * @returns {Object} config Updated onfiguration options
 */

exports.configure = function( options ) {
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

exports.connect = function( cb ) {

  // Return a cached connection if one exists
  if (exports.connection.db) return cb( null, exports.connection );

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
    exports.connection = db;
    // Ensure connection is reset if closed somehow
    exports.connection.on( 'close', function(){ exports.connection = {}; });
    // Trigger the
    cb( null, exports.connection );
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

exports.disconnect = function( cb ) {

  // Force close the local reference to the db
  // -- this is an internal reference and used as a hard lookup
  var onClose = function( err, res ) {
    // Immediately reset the connection
    exports.connection = {};
    cb( err, res );
  };

  if (exports.connection.db) exports.connection.close( cb ? onClose : null );
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

exports.create = function( query, cb ) {

  var options = {};

  exports.connection
    .collection( query.resource )
    .insert( query.content, options, cb );

};


/**
 * Destroy records in the database
 *
 * @param {Query}
 * @param {Function} cb Called on completion, passed `(err, res)`
 * @public
 */

exports.remove = function( query, cb ) {

  var selector = utils.selector( query );
  var options = {};

  exports.connection
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

exports.update = function( query, cb ) {

  var selector = utils.selector( query );
  var update = utils.modifiers( query );

  // Mongo ref:
  // db.collection.update( <selectors>, <update{}>, <upsertBool>, <multiBool> )

  exports.connection
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

exports.find = function( query, cb ) {
  // Selections
  var selector = utils.selector( query );

  var options = utils.options( query );


  exports.connection
    .collection( query.resource )
    .find( selector, options )
    .toArray( function( err, res ) {
      cb( err, res );
    });
};

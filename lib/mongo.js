var adapter = require('mknl-adapter'),

    // Mongo drivers
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    ObjectID = require('mongodb').ObjectID,
    Db = require('mongodb').Db,

    // Configuration settings
    config = require( './config' ).core,
    serverOpts = require( './config' ).serverOptions,
    dbOpts = require( './config' ).dbOptions;


// Internal registers
var _spawning = false;
var _queue = [];
// Cached connection to the database
var connection = {};


// Sets up a connection to a mongo DB
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

var mongo = adapter('mongo');

mongo.exec = function( query, cb ) {

  // Check we have a connection
  if ( !connection.db ) {
    // Defer query
    _queue.push( {query:query, cb:cb} );

    // Connect to DB if this is the first attempt to do so
    return _spawning ? null : buildConnection();
  }

  switch( query.action ) {
    case 'create': this.create( query ); break;
    case 'delete': this.destroy( query ); break;
    case 'find': this.find( query, cb  );
  }
};



// Success return calls `cb( null, db )` where `db` is Mongo db instance
mongo.connect = function( cb ) {

  // Return a cached connection if one exists
  if (connection.db) return cb( null, connection );

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
    connection = db;
    // Ensure connection is reset if closed somehow
    connection.on( 'close', function(){ connection = {}; });
    // Trigger the
    cb( null, connection );
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


mongo.create = function( query, cb ) {
  // @todo: implement me
};

mongo.destroy = function( query, cb  ) {
  // @todo: implement me
};

mongo.find = function( query, cb ) {
  connection
    .collection( query.resource )
    .find()
    .toArray( function( err, res ) {
      cb( err, res );
    });
};


// Export the mongo adapter
module.exports = exports = mongo;

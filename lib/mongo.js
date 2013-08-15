var adapter = require('mknl-adapter'),
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    ObjectID = require('mongodb').ObjectID,
    Db = require('mongodb').Db;


    // Internal tools
    config = require( './config' );


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
    // Cache the connection
    connection = db;

    // Ensure connection is reset if closed somehow
    connection.on( 'close', function(){ connection = {}; });

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
  // Configuration settings
  var core = config.core;
  var serverOpts = config.serverOptions;
  var dbOpts = config.dbOptions;

  // Create Mongo harness
  var server = new Server( core.host, core.port, serverOpts );
  var db = new Db( core.database, server, dbOpts );


  // Test for authentication present
  var isAuthSet = function() {
    if (core.user.length || core.password.length) return true;
    else return false;
  };

  var onConnect = function( err ) {
    if ( err ) return cb( err );

    // Attempt authentication if present
    if ( isAuthSet() ) {
      return db.authenticate( core.user, core.password, function( err, res ) {
        if ( res ) return cb( null, res );
        if ( db ) db.close();

        if ( err ) return err;
        else return new Error('Auth failed');
      });
    }

    // Return the database connection `db` to the callback
    return cb( null, db );
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

var adapter = require('mknl-adapter'),
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    ObjectID = require('mongodb').ObjectID,
    Db = require('mongodb').Db;



// @todo use a module for this
var each = function( array, cb ) {
  for (var i = 0; i < array.length; i++ )
    cb( array[i] );
};

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
    each( _queue, function( q ) {
      mongo.exec( q.query, q.cb );
    });
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

  // Temporary store for connection data
  // @todo: pull this out into a config object
  var host = 'localhost',
      port = '27017',
      nativeParser = false,
      user = '',
      password = '',
      database = 'mydb';


  // Server options
  var options = {
    native_parser: nativeParser,
    auth: {
      user: user,
      password: password
    }
  };

  // Database options
  var dbOpts = {
    safe: true,
    native_parser: nativeParser
  };

  // Create Mongo harness
  var server = new Server( host, port, options );
  var db = new Db( database, server, dbOpts );


  // Test for authentication present
  var isAuthSet = function() {
    if (user.length || password.length) return true;
    else return false;
  };

  var onConnect = function( err ) {
    if ( err ) return cb( err );

    // Attempt authentication if present
    if ( isAuthSet() ) {
      return db.authenticate( user, password, function( err, res ) {
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

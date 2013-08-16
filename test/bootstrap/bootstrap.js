var options = require('./config').config
  , data = require('./data');

module.exports = function( adapter ) {

  // Before the tests, configure the adapter config options
  before( function() {
    adapter.configure( options );
  });

  // Once the tests are complete, destroy the test db
  after( function(done) {
    adapter.connect( function(err, db) {
      if (err) done( err );
      // Drop the test database
      db.dropDatabase( function( err, res ) {
        if (err) done( err );
        done();
      })
    });
  });
};

module.exports.reset = function( adapter, done ) {
  // Only drop database if it contains the string 'test'
  var dbName = adapter.configure().database;
  if (!dbName.match(/test/))
    throw new Error('Refusing to drop non "test" database: ' + dbName );

  // Connect and reset
  adapter.connect( function(err, db) {
    if (err) done( err );

    // Drop the currently connected database
    db.dropDatabase( function(err, res) {
      if (err) done( err );

      // Step through each data set, create a collection, populate it
      // Once all have iterated, call `done()`
      var keys = Object.keys( data );
      var numKeys = keys.length;
      var counted = 0;

      while ( keys.length ) {
        var key = keys.shift();

        db.createCollection( key, function(err, col) {
          if (err) done( err );

          // Insert test data
          col.insert( data[key], function( err, cb ) {
            if (err) done( err );
            // Return once all the keys have been inserted
            if (++counted === numKeys) done();
          })
        });

      };

    });

  });
};

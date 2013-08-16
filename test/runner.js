var expect = require('expect.js')
  , mongo = require('../lib/mongo.js')
  , query = require('../../../query/lib/index');


// Bootstrap configures connections and ensures teardown of testDB
// Also exposes bootstrap.reset( adapter, done ) for db reset
var bootstrap = require('./bootstrap/bootstrap.js');
bootstrap( mongo );



describe('Tests', function() {
  // Set query to use the adapter class reference
  after( function() {
    query.adapterClass( mongo.adapter );
  });

  it('should export a Query factory', function() {
    expect( query ).to.be.a( Function );
  });

  it('should initialise the mongo adapter', function() {
    expect( mongo ).to.not.be.empty();
  });
});



describe('adapter', function() {
  // Note: ALL tests should do this. Factor this into general adapter tests
  it('should expose an .exec() method', function() {
    expect( mongo.exec ).to.be.a( Function );
  });
});



describe('.find()', function() {

  // Hoist query reference
  var q;

  // Destroy and reset state
  beforeEach( function( done ) {
    q = query('mongo');
    bootstrap.reset( mongo, done );
  });


  it('should find records', function( done ) {
    q.find().from('users').done( function(err, res) {
      expect( res.length ).to.be.greaterThan( 0 );
      done();
    });

  });
});

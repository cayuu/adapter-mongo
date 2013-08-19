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


  describe('.configure( options )', function() {
    it('should enable updating config via .configure(options)', function() {
      expect( mongo.configure ).to.be.a( Function );
      var user = mongo.configure().user;
      var newConfig = mongo.configure({user:'hello'});

      expect( user ).to.not.eql( newConfig.user );

      // reset it back to the original value
      mongo.configure( {user:user} );
    });

    it('should fail to set a key not present in config', function() {
      var err;
      try {
        mongo.configure( {boguskey: 'blaaaaaam'} );
      }
      catch( e ) {
        err = e;
      }
      expect( err ).to.be.an( Error );
      expect( err.message ).to.match( /config.*option/ );
    });
  });

  describe('.exec( query, cb )', function() {

    it('should expose an .exec() method', function() {
      expect( mongo.exec ).to.be.a( Function );
    });

    // This test checks that direct `query(adapter)...done( fn )` calls
    // correctly queue until the adapter has built a connection to its
    // service - then executing the queued queries
    it('should queue queries until service connection', function(done) {
      mongo.disconnect( function(err, res) {
        if (err) done( err );

        // Tiny potential race condition here:
        // We're assuming that the .exec() delegation to .connect()
        // and subsequent mongodb connection establishment will take
        // longer than the synchronous execution of the following calls.
        expect( mongo.connection ).to.be.empty();
        query('mongo').find().from('users').done( cb );
        expect( mongo.connection ).to.be.empty();
        query('mongo').find().from('users').done( cb );

        // At this stage, if no DB is yet connected, queue must be in place
        // for the callbacks to execute
        expect( mongo.connection ).to.be.empty();

        var count = 0;
        function cb( err, res ) {
          if (err) done( err );
          // Both callbacks have executed. Success!
          if (++count === 2) done();
        }

      });

    });

  });


  describe('.connect() and .disconnect()', function() {

    it('should return a db handle on connect', function( done ) {
      mongo.connect( function( err, db ) {
        if (err) done( err );

        expect( db ).to.not.be.empty();
        expect( db.admin ).to.be.a( Function );
        done();
      });
    });

    it('should connect to an authenticated db');

    // This test uses DIRECT mongo adapter calls rather than the delegations
    // through `query()`. This BYPASSES .exec() which is NOT RECOMMENDED in
    // production, but is useful for testing the adapter.
    // DO NOT DO THIS in production code. Mediate everything through `query`
    it('should destroy a connection on .disconnect(cb)', function( done ) {
      // Build an explicit connection
      mongo.connect( function( err, db ) {
        if (err) done( err );

        // Check that `db` came back with something useful
        expect( db.admin ).to.be.a( Function );

        mongo.disconnect( function(err,res) {
          if (err) done( err );

          // Overwrite db reference **Pls don't do this in production
          mongo.connection = db;
          // Force a database attempt
          mongo.find( {resource:'users'}, function(err,res){
            expect( err ).to.match( /Connection.*destroyed/ );
            done();
          })

        });
      });
    })

    it('should fail to .disconnect(cb) if no connection present', function(done) {
      mongo.disconnect( function(err) {
        expect( err ).to.be.an( Error );
        expect( err.message ).to.match( /No connection/ );
        done();
      });
    });

    it('should throw an error if disconnect() fails and no cb passed',
      function(done) {
        var err;
        try {
          mongo.disconnect();
        }
        catch( e ) { err = e; }
        expect( err ).to.be.an( Error );
        expect( err ).to.match( /No connection/ );
        done();
      });

  });

});



// Note: Exceptions thrown inside this block do NOT propagate back up to Mocha.
// Must manually catch and pass to done(e)
describe('.find()', function() {

  // Hoist query reference
  var q;

  // Destroy and reset state
  beforeEach( function( done ) {
    q = query('mongo');
    bootstrap.reset( mongo, done );
  });


  it('should return records on a .find() action', function( done ) {
    q
      .find()
      .from('users')
      .done( function(err, res) {
        try {
          expect( res.length ).to.be.greaterThan( 0 );
          done();
        }
        catch( e ) { done( e ); }

      });
  });
});


describe('CRUD', function() {

  // Destroy and reset state
  // beforeEach( function( done ) {
  //   bootstrap.reset( mongo, done );
  // });

  it('should create a new record', function( done ) {

    function cb( err, res ) {
      if (err) done( err );

      // Check this record exists
      query('mongo')
        .from('users')
        .find()
        .where('name').is('Smoo moo')
        .done( function(err, res) {
          if (err) done( err );

          expect( res ).to.have.length( 1 );
          expect( res[0].name ).to.be( 'Smoo moo' );

          done();
        });
    };

    query('mongo')
      .from('users')
      .create( {name:'Smoo moo'} )
      .done( cb );
  });

  it('should create several records');

  it('should remove an existing record [resets db]', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      expect( res ).to.be( 1 );
      // done();
      // Reset the database back to what we expect
      bootstrap.reset( mongo, done );
    }

    query('mongo')
      .from('users')
      .remove()
      .where('name').is( 'Hulk Hogan' )
      .done( cb );
  });

  it('should find an existing record', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length(1);
        expect( res[0].name ).to.be( 'Hulk Hogan' );
        done();
      }
      catch( e ) { done(e); }
    }

    query('mongo')
      .from('users')
      .find()
      .where( 'name' ).is( 'Hulk Hogan' )
      .done( cb );
  });

  it('should return no records if nothing found');

  it('should update a record');
});


describe('Organisation', function() {

  it('should limit results based on .limit( number )');

  it('should return an .offset( lastIndex ) of results ');

  it('should sort records ascending .sort( "asc" )');

  it('should sort records descending .sort( "desc" )');

});

describe('Constraints .where()', function() {

  it('should support .is( val ) & .eq( val )');

  it('should support .in( array )');

  it('should support exlusion .neq( val ) & .not( val )');

  it('should support lower comparators .lt( val ) & .lte( val )');

  it('should support upper comparators .gt( val ) & .gte( val )');

});


describe('Associations', function() {

  it('should populate associated records with .include() :read');

  it('should update associate records on :update');

  it('should destroy dependent records on .remove() :delete');

});

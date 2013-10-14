var expect = require('expect.js')
  , mongo = require('../lib/mongo.js')
  , utils = require('../lib/utils.js')
  , query = require('../../query/lib/index');


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



describe('utils.', function() {

  it('should load utils', function() {
    expect( utils ).to.not.be.empty();
  });

  describe('selector()', function() {

    it('should have a selector Function', function() {
      expect( utils.selector ).to.be.a( Function );
    });

    it('should return an Object', function() {
      var q = query();
      expect( utils.selector( q ) ).to.be.an( Object );
    });

    it('should directly apply equality values', function() {
      var q = query().where('crash').is( 1 );
      var sel = utils.selector( q );

      expect( sel ).to.have.keys( 'crash' );
      expect( sel.crash ).to.be( 1 );
    });

    it('should map `neq` to `ne`', function() {
      var q = query().where('boom').neq( 1 );
      var sel = utils.selector( q );

      expect( sel.boom ).to.be.an( Object );
      expect( sel.boom[ '$ne' ] ).to.be( 1 );
    });

    it('should map operators as `$operator`', function() {
      var q = query()
        .where('boom').gt( 1 )
        .and('crash').lte( 3 )
        .and('splat').in( [1,2,3] );

      var sel = utils.selector( q );
      expect( sel.boom ).to.have.key( '$gt' );
      expect( sel.crash ).to.have.key( '$lte' );
      expect( sel.splat ).to.have.key( '$in' );
    });

  });


  describe('modifiers()', function() {

    it('should have a .modifiers Function', function() {
      expect( utils.modifiers ).to.be.a( Function );
    });

    it('should return an object', function() {
      var q = query();
      expect( utils.modifiers( q ) ).to.be.an( Object );
    });

    it('should apply inputs as `$set` modifier', function() {
      var q = query().update( {name:'Blaaam'});
      expect( utils.modifiers( q ) ).to.have.key( '$set' );
      expect( utils.modifiers( q )['$set'].name ).to.be( 'Blaaam' );
    });

    it('should only apply inputs if both inputs and modifiers provided', function() {
      var q = query().update( {name:'Blaaam'} ).set('name').to('Boo');
      expect( utils.modifiers( q )['$set'].name ).to.be( 'Blaaam' );
    });

    it('should map known modifiers (set, unset, rename, inc)', function() {
      var q = query()
        .set( 'name', 'Blaaam' )
        .rename( 'hand', 'foot' )
        .unset( 'deadly' )
        .increment( 'age', 1 );

      var mods = utils.modifiers( q );
      expect( mods['$set'].name ).to.be( 'Blaaam' );
      expect( mods['$rename'].hand ).to.be( 'foot' );
      expect( mods['$inc'].age ).to.be( 1 );
      expect( mods['$unset'].deadly ).to.be( '' );

    });

    it('should ignore unknown modifiers', function() {
      var q = query();
      q.modifiers['$fake'] = {nothing:'to_see_here'};
      expect( utils.modifiers( q ) ).to.be.empty();
    });

  });

});


// The tests in this block work from an initialised base state but DO NOT
// reset state for each test. This is a speed consideration.
// If you are testing for an expected state, use `bootstrap.reset( mongo, done )
// and BE AWARE of the shared state of these tests
describe('CRUD', function() {

  // Reset the DB prior to attempting any CRUD exercises
  before( function(done) {
    bootstrap.reset( mongo, done )
  });

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

  // This deletes the record created above
  it('should remove an existing record', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.be( 1 );
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .remove()
      .where('name').is( 'Smoo moo' )
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

  it('should return no records if nothing found', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length( 0 );
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where('junkfield').is('junkvalue')
      .done( cb );
  });

  it('should find several records matching search criteria', function( done ) {

    function cb( err, res ) {
      if (err) done( err );

      try {
        expect( res.length ).to.be.greaterThan( 2 );
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where( 'weight' ).gt( 290 )
      .done( cb );
  });

  it('should update a record', function( done ) {

    function verifycb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length( 1 );
        expect( res[0].weight ).to.be( 485 );
        done();
      }
      catch( e ) { done( e ); }
    }

    function updatecb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.be( 1 );

        // Double check it actually updated
        query('mongo')
          .from( 'users' )
          .find()
          .where( 'name' ).is('Andre The Giant')
          .done( verifycb )
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .update()
        .set('weight').to( 485 )
      .where( 'weight' ).eq( 475 )
      .done( updatecb );
  });

  it('should update several records matching criteria');
});


describe('Organisation', function() {

  it('should limit results based on .limit( number )', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length( 3 );
        expect( res[0].name ).to.be( 'Ultimate Warrior' );
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from( 'users' )
      .find()
      .limit( 3 )
      .done( cb );

  });

  it('should return an .offset( lastIndex ) of results', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length( 2 );
        expect( res[0].name ).to.be( 'The Undertaker' );
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from( 'users' )
      .find()
      .limit( 2 )
      .offset( 2 )
      .done( cb );

  });

  it('should sort records ascending .sort( "asc" )');

  it('should sort records descending .sort( "desc" )');

});

describe('Constraints .where()', function() {

  it('should support .is( val ) & .eq( val )', function(done) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length( 1 );
        expect( res[0].name ).to.be( 'Hulk Hogan' );

        query( 'mongo' )
          .from( 'users' )
          .find()
          .where( 'name' ).eq( 'Hulk Hogan' ).done( function(err, res) {
            if (err) done( err );
            try {
              expect( res ).to.have.length( 1 );
              expect( res[0].name ).to.be( 'Hulk Hogan' );
              done();
            }
            catch(e) { done(e); }

          })

      }
      catch( e ) { done( e ); }
    }

    query( 'mongo' )
      .from( 'users' )
      .find()
      .where( 'name' ).is( 'Hulk Hogan' )
      .done( cb );

  });

  it('should support .in( array )', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        // Match 'Hogan' and 'Warrior' (the 500 weight is intentionally bogus)
        expect( res ).to.have.length( 2 );
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where('weight').in( [299, 302, 500] )
      .done( cb );
  });

  it('should support .nin( array )', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        // Should only match Andre The Giant
        expect( res ).to.have.length( 1 );
        expect( res[0].name ).to.be('Andre The Giant');
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where('weight').nin( [299, 302, 280] )
      .done( cb );
  });

  it('should support exclusion .neq( val ) & .not( val )', function( done ) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length( 1 );
        expect( res[0].name ).to.be( 'Andre The Giant' );

        query('mongo')
          .from('users')
          .find()
          .where( 'alive' ).neq( true ).done( function(err, res) {
            if (err) done( err );
            try {
              expect( res ).to.have.length( 1 );
              expect( res[0].name ).to.be( 'Andre The Giant' );
              done();
            }
            catch(e) { done(e); }

          });

      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where( 'alive' ).not( true )
      .done( cb );
  });

  it('should support comparators .lt( val ) & .lte( val )', function(done) {

    function cb( err, res ) {
      if (err) done( err );

      try{
        expect( res ).to.have.length( 2 );

        query('mongo')
          .from('users')
          .find()
          .where('weight').lte( 302 ).done( function(err, res) {
            if (err) done( err );
            try {
              expect( res ).to.have.length( 3 );
              done();
            }
            catch( e ) { done( e ); }
          });
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where('weight').lt(302)
      .done( cb );

  });

  it('should support comparators .gt( val ) & .gte( val )', function(done) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        expect( res ).to.have.length( 2 );

        query('mongo')
          .from( 'users' )
          .find()
          .where( 'weight' ).gte( 299 )
          .done( function( err, res ) {
            if (err) done( err );
            try {
              expect( res ).to.have.length( 3 );
              done();
            }
            catch( e ) { done( e ); }
          });
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where( 'weight' ).gt( 299 )
      .done( cb );
  });

  it('should compound constraints [eg. .is(x) .nin(y)]', function(done) {

    function cb( err, res ) {
      if (err) done( err );
      try {
        // Expects only Hulk Hogan and The Undertaker
        expect( res ).to.have.length( 2 );
        done();
      }
      catch( e ) { done( e ); }
    }

    query('mongo')
      .from('users')
      .find()
      .where( 'alive' ).is( true )
      .where( 'weight' ).gte( 299 )
      .done( cb );

  });

});


describe('Associations', function() {

  it('should populate associated records with .include() :read');

  it('should update associate records on :update');

  it('should destroy dependent records on .remove() :delete');

});

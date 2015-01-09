
var expect = require('chai').expect;
var query = require('mekanika-query');
var store = require('../index');


var _FIXTURE = {
  'supers': [
    {pk:'1', handle:'Drzzt', type:'rogue', power:5, speed:12, extra:['a','b']},
    {pk:'2', handle:'Pug', type:'wizard', power:2, speed:5},
    {pk:'3', handle:'Bruce', type:'fighter', power:15, speed:6},
    {pk:'4', handle:'Joe', type:'rogue', power:8, speed:10}
  ]
};

var _ON = 'supers';

// Simple Helper methods
var create = function (body, cb) {
  var q = query().on(_ON).create().body(body);
  store.exec( q.qe, cb );
};


describe.only('CRUD', function () {

  // Clear database
  beforeEach( function (done) {
    store.exec( query().remove().on(_ON).qe, function (err) {
      if (err) throw err;
      done();
    });
  });

  describe('create', function () {
    it('new record', function (done) {
      create( _FIXTURE.supers[0], function (err, res) {
        expect(err).to.not.be.ok;
        expect(res).to.have.length[1];
        expect( res[0].pk ).to.equal('1');
        done();
      });
    });
  });

  describe('update', function () {
    describe('.body to sparse set', function () {
      it('existing record by id', function (done) {
        create( _FIXTURE.supers, function (err, res) {
          // Update the first record's power to 7 (a unique value we can check)
          var q = query().update().on(_ON).body({power:7});
          q.qe.ids = [res[0]._id.toString()];
          store.exec( q.qe, function (err, res) {
            expect( err ).to.not.be.ok;
            // Check that our record updated correctly
            store.exec( {do:'find', on:'supers', ids:q.qe.ids}, function (err, res) {
              expect( res[0].power ).to.equal(7);
              done();
            });
          });
        });
      });
      it('many by selectors', function (done) {
        var _test = function (err, res) {
          var q = query().update().on(_ON).body({type:'ghost'}).where('type','rogue');
          store.exec( q.qe, function (err, res) {
            expect(err).to.not.be.ok;

            store.exec( query().find().on(_ON).where('type','rogue').qe, function (err,res) {
              expect( res ).to.have.length(0);
              store.exec(query().find().on(_ON).where('type','ghost').qe, function (err, res) {
                expect( res ).to.have.length(2);
                done();
              });
            });
          });
        };
        create( _FIXTURE.supers, _test);
      });
    });
  });

  describe('find', function () {
    var _created = [];
    beforeEach( function (done) {
      create( _FIXTURE.supers, function (err, res) {
        _created = res;
        done();
      });
    });
    it('by id', function (done) {
      var id = _created[0]._id.toString();
      var q = query().on(_ON).find( id );
      store.exec( q.qe, function (err, res) {
        expect( err ).to.not.be.ok;
        expect( res ).to.have.length(1);
        expect( res[0]._id.toString() ).to.equal( id );
        done();
      });
    });
    it('by match', function (done) {
      var q = query().on(_ON).find().where('handle').is('Pug');
      store.exec( q.qe, function (err, res) {
        expect( err ).to.not.be.ok;
        expect( res ).to.have.length(1);
        expect( res[0].handle ).to.equal('Pug');
        done();
      });
    });
    it('match within ids', function (done) {
      var ids = [
        _created[0]._id.toString(),
        _created[1]._id.toString(),
        _created[2]._id.toString()
      ];
      var q = query().on(_ON).find(ids).where('type').is('rogue');
      store.exec( q.qe, function (err, res) {
        expect( err ).to.not.be.ok;
        expect( res ).to.have.length(1);
        expect( res[0].handle ).to.equal('Drzzt');
        done();
      });
    });
  });

  describe('remove', function () {
    var records = [];
    beforeEach( function (done) {
      create( _FIXTURE.supers, function (err,res) {
        records = res;
        done();
      });
    });
    it('by ids', function (done) {
      var id = records[0]._id.toString();
      var q = query().remove( id ).on(_ON);
      store.exec( q.qe, function (err,res) {
        expect(err).to.not.be.ok;
        q = query().find().on(_ON);
        q.qe.ids = [id];
        store.exec( q.qe, function (err, res) {
          expect( res ).to.have.length(0);
          done();
        });
      });
    });
    it('by match', function (done) {
      var q = query().remove().on(_ON).where('type', 'rogue');
      store.exec( q.qe, function (err, res) {
        expect( err ).to.not.be.ok;
        q = query().find().on(_ON).where('type','rogue');
        store.exec( q.qe, function (err,res) {
          expect( res ).to.have.length(0);
          done();
        });
      });
    });
  });
});

describe('Update operators', function () {
  it('inc');
  it('push (array)');
  it('push (scalar)');
  it('pull (array)');
});

describe('Match', function () {
  describe('Operators', function () {
    it('eq');
    it('neq');
    it('in');
    it('nin');
    it('all');
    it('gt');
    it('gte');
    it('lt');
    it('lte');
  });

  describe('on action', function () {
    it('find');
    it('update');
    it('remove');
  });

  describe('complex', function () {
    it('multiple conditions');
    it('OR container');
    it('nested matches');
  });
});

describe('Populate', function () {
  it('from keys only');
  it('based on Qe');
  it('with foreign key');
});

describe('Select', function () {
  it('whitelists fields', function () {

  });
  it('blacklists fields');

  describe('Limits', function () {
    it('on find');
  });

  describe('Offset', function () {
    it('by number');
  });
});

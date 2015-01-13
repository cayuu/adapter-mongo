
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


// Clear database
beforeEach( function (done) {
  store.exec( query().remove().on(_ON).qe, function (err) {
    if (err) throw err;
    done();
  });
});

describe('CRUD', function () {
  describe('create', function () {
    it('new record', function (done) {
      create( _FIXTURE.supers[0], function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length[1];
        expect( res.supers[0].pk ).to.equal('1');
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
          q.qe.ids = [res.supers[0]._id.toString()];
          store.exec( q.qe, function (err, res) {
            expect( err ).to.not.be.ok;
            // Check that our record updated correctly
            store.exec( {do:'find', on:'supers', ids:q.qe.ids}, function (err, res) {
              expect( res.supers[0].power ).to.equal(7);
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
              expect( res.supers ).to.have.length(0);
              store.exec(query().find().on(_ON).where('type','ghost').qe, function (err, res) {
                expect( res.supers ).to.have.length(2);
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
      var id = _created.supers[0]._id.toString();
      var q = query().on(_ON).find( id );
      store.exec( q.qe, function (err, res) {
        expect( err ).to.not.be.ok;
        expect( res.supers ).to.have.length(1);
        expect( res.supers[0]._id.toString() ).to.equal( id );
        done();
      });
    });
    it('by match', function (done) {
      var q = query().on(_ON).find().where('handle').is('Pug');
      store.exec( q.qe, function (err, res) {
        expect( err ).to.not.be.ok;
        expect( res.supers ).to.have.length(1);
        expect( res.supers[0].handle ).to.equal('Pug');
        done();
      });
    });
    it('match within ids', function (done) {
      var ids = [
        _created.supers[0]._id.toString(),
        _created.supers[1]._id.toString(),
        _created.supers[2]._id.toString()
      ];
      var q = query().on(_ON).find(ids).where('type').is('rogue');
      store.exec( q.qe, function (err, res) {
        expect( err ).to.not.be.ok;
        expect( res.supers ).to.have.length(1);
        expect( res.supers[0].handle ).to.equal('Drzzt');
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
      var id = records.supers[0]._id.toString();
      var q = query().remove( id ).on(_ON);
      store.exec( q.qe, function (err,res) {
        expect(err).to.not.be.ok;
        q = query().find().on(_ON);
        q.qe.ids = [id];
        store.exec( q.qe, function (err, res) {
          expect( res.supers ).to.have.length(0);
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
          expect( res.supers ).to.have.length(0);
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
  var q;
  beforeEach( function (done) {
    q = query().find().on(_ON);
    create( _FIXTURE.supers, function (err,res) {
      records = res;
      done();
    });
  });
  describe('Operators', function () {
    it('eq', function (done) {
      q.where('type').is('rogue');
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(2);
        res.supers.map( function (el) {
          expect(el.type).to.equal('rogue');
        });
        done();
      });
    });
    it('neq', function (done) {
      q.where('type').not('wizard');
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(3);
        res.supers.map( function (el) {
          expect(el.type).to.not.equal('wizard');
        });
        done();
      });
    });
    it('in', function (done) {
      q.where('type').in(['wizard', 'fighter']);
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(2);
        res.supers.map( function (el) {
          expect(el.type).to.not.equal('rogue');
        });
        done();
      });
    });
    it('nin', function (done) {
      q.where('type').nin(['wizard', 'fighter']);
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(2);
        res.supers.map( function (el) {
          expect(el.type).to.not.equal('wizard');
          expect(el.type).to.not.equal('fighter');
        });
        done();
      });
    });
    it('all', function (done) {
      q.where('extra').all(['a','b']);
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(1);
        res.supers.map( function (el) {
          expect(el.extra).to.include('a','b');
        });
        done();
      });
    });
    it('gt', function (done) {
      q.where('power').gt(8);
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(1);
        res.supers.map( function (el) {
          expect(el.power).to.be.gt(8);
        });
        done();
      });
    });
    it('gte', function (done) {
      q.where('power').gte(8);
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(2);
        res.supers.map( function (el) {
          expect(el.power).to.be.gte(8);
        });
        done();
      });
    });
    it('lt', function (done) {
      q.where('power').lt(8);
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(2);
        res.supers.map( function (el) {
          expect(el.power).to.be.lt(8);
        });
        done();
      });
    });
    it('lte', function (done) {
      q.where('power').lte(8);
      store.exec( q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(3);
        res.supers.map( function (el) {
          expect(el.power).to.be.lte(8);
        });
        done();
      });
    });
  });

  describe('complex', function () {
    it('multiple conditions', function (done) {
      q.where('type').is('rogue').and('power').gt(5);
      store.exec(q.qe, function (err,res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(1);
        res.supers.map(function(el) {
          expect(el.type).to.equal('rogue');
          expect(el.power).to.be.gt(5);
        });
        done();
      });
    });
    it('OR container', function (done) {
      q.where('type').is('rogue').or('power').gt(5);
      store.exec(q.qe, function (err,res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(3);
        res.supers.map(function(el) {
          if (el.type !== 'rogue') expect(el.power).to.be.gt(5);
          else expect( el.type ).to.equal('rogue');
        });
        done();
      });
    });
    it('nested matches', function (done) {
      // Create MC manually because Query 0.8.0 bug: https://github.com/mekanika/query/issues/1
      var manual = {
        do:'find', on:'supers',
        match: {or:[
          {type:{eq:'wizard'}},
          {and:[{speed:{gt:8}}, {power:{gt:5}}]}
        ]}
      };

      q.where( query.mc().where('speed').gt(8).where('power').gte(5) )
        .or('type').is('wizard');

      store.exec(manual, function (err,res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(2);
        res.supers.map(function(el) {
          if (el.type !== 'wizard') {
            if (el.speed < 9) expect(el.power).to.be.gt(5);
            else expect(el.speed).to.be.gt(8);
          }
          else expect( el.type ).to.equal('wizard');
        });
        done();
      });
    });
  });
});

describe('Populate', function () {
  it('from keys only');
  it('based on Qe');
  it('with foreign key');
});

describe('Select', function () {

  var q;
  beforeEach( function (done) {
    q = query().find().on(_ON);
    create( _FIXTURE.supers, function (err,res) {
      records = res;
      done();
    });
  });

  it('whitelists fields', function (done) {
    q.where('handle','Drzzt').select('handle power');
    store.exec(q.qe, function (err, res) {
      expect(err).to.not.be.ok;
      expect(res.supers[0].handle).to.equal('Drzzt');
      expect(res.supers[0]).to.not.include.key('speed');
      done();
    });
  });
  it('blacklists fields', function (done) {
    q.where('handle','Drzzt').select('-speed -power');
    store.exec(q.qe, function (err, res) {
      expect(err).to.not.be.ok;
      expect(res.supers[0].handle).to.equal('Drzzt');
      expect(res.supers[0]).to.include.key('type');
      expect(res.supers[0]).to.not.include.key('speed');
      expect(res.supers[0]).to.not.include.key('power');
      done();
    });
  });

  describe('Sort', function () {
    it('by field (ascending)', function (done) {
      q.sort('power');
      store.exec(q.qe, function (err,res) {
        expect(err).to.not.be.ok;
        expect(res.supers[0].power).to.equal(2);
        expect(res.supers[3].power).to.equal(15);
        done();
      });
    });
    it('by field (descending)', function (done) {
      q.sort('-power');
      store.exec(q.qe, function (err,res) {
        expect(err).to.not.be.ok;
        expect(res.supers[0].power).to.equal(15);
        expect(res.supers[3].power).to.equal(2);
        done();
      });
    });
    it('by multiple fields', function (done) {
      // Sorts on type first.
      // Usually rogue Drzzt (power 5) comes up first (as his id comes first).
      // Reverse sort on power and test that the other roge (power 8) comes 1st.
      q.sort('type -power');
      store.exec( q.qe, function (err, res) {
        expect(res.supers[1].power).to.equal(8);
        done();
      });
    });
  });

  describe('Limits', function () {
    var q;
    beforeEach( function (done) {
      q = query().find().on(_ON);
      create( _FIXTURE.supers, function (err,res) {
        records = res;
        done();
      });
    });
    it('on find', function (done) {
      q.limit(2);
      store.exec(q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(2);
        expect(res.supers[0].handle).to.equal('Drzzt');
        done();
      });
    });
  });

  describe('Offset', function () {
    var q;
    beforeEach( function (done) {
      q = query().find().on(_ON);
      create( _FIXTURE.supers, function (err,res) {
        records = res;
        done();
      });
    });
    it('by number', function (done) {
      q.offset(3);
      store.exec(q.qe, function (err, res) {
        expect(err).to.not.be.ok;
        expect(res.supers).to.have.length(1);
        expect(res.supers[0].handle).to.equal('Joe');
        done();
      });
    });
  });
});
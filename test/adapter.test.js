
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
  var q;
  beforeEach( function (done) {
    q = query().update().on('supers');
    create( _FIXTURE.supers, function (err,res) {
      records = res;
      done();
    });
  });
  afterEach( function (done) {
    store.exec(query().remove().on('supers').qe, done );
  });
  it('inc', function (done) {
    q.inc('power', 100).inc('speed', -3).where('handle','Pug');
    store.exec(q.qe, function (e,r) {
      expect( e ).to.not.be.ok;

      // Go find the updated record to be sure it has applied
      store.exec( query().find().on('supers').where('power').gt(100).qe, function (e,r) {
        expect( r.supers ).to.have.length(1);
        expect( r.supers[0].handle ).to.equal('Pug');
        expect( r.supers[0].speed ).to.equal(2);
        done();
      });

    });
  });
  it('push (array)', function (done) {
    q.push('extra',['k','c','d']).where('handle', 'Drzzt');
    store.exec( q.qe, function (e,r) {
      store.exec(query().find().on('supers').where('handle','Drzzt').qe, function (e,r){
        expect(r.supers[0].extra).to.have.length(5);
        expect(r.supers[0].extra).to.contain('k','c','d');
        done();
      });
    });
  });
  it('push (scalar)', function (done) {
    q.push('extra','x').where('handle', 'Drzzt');
    store.exec( q.qe, function (e,r) {
      store.exec(query().find().on('supers').where('handle','Drzzt').qe, function (e,r){
        expect(r.supers[0].extra).to.have.length(3);
        expect(r.supers[0].extra).to.contain('x');
        done();
      });
    });
  });
  it('pull (array)', function (done) {
    q.pull('extra',['a','b']).where('handle', 'Drzzt');
    store.exec( q.qe, function (e,r) {
      store.exec(query().find().on('supers').where('handle','Drzzt').qe, function (e,r){
        expect(r.supers[0].extra).to.have.length(0);
        done();
      });
    });
  });
  it('pull (scalar)', function (done) {
    q.pull('extra', 'b').where('handle', 'Drzzt');
    store.exec( q.qe, function (e,r) {
      store.exec(query().find().on('supers').where('handle','Drzzt').qe, function (e,r) {
        expect( r.supers[0].extra ).to.not.contain('b');
        done();
      });
    });
  });
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


var _db = {
  'supers': [
    {pk:1, handle:'Drzzt', type:'rogue', power:5, speed:12, extra:['a','b']},
    {pk:2, handle:'Pug', type:'wizard', kicks:[1,3], tags:[1,3], powers:[1]},
    {pk:3, handle:'Bruce', type:'fighter', kicks:[], tags:[2], powers:[]},
    {pk:4, handle:'Joe', type:'rogue', kicks:[2,3], tags:[], powers:[2]}
  ],
  // Resource name matches field name, pks as 'pk'
  'tags': [
    {pk:1, body:'pro'},
    {pk:2, body:'noob'},
    {pk:3, body:'deadly'}
  ],
  // Alternatively named resource
  'sidekicks': [
    {pk:1, workswith:[2], name:'Gir', skill:-3},
    {pk:2, workswith:[4], name:'Pop', skill:2},
    {pk:3, workswith:[2,4],name:'Moo', skill:5000}
  ],
  // Alternatively named ids
  'powers': [
    {power_id:1, name:'magic'},
    {power_id:2, name:'lockpick'}
  ]
};

describe('Populate', function () {
  var q;
  beforeEach( function (done) {
    store.exec(query().on('supers').create().body(_db.supers).qe, function () {
      store.exec(query().on('sidekicks').create().body(_db.sidekicks).qe, function () {
        store.exec(query().on('tags').create().body(_db.tags).qe, function () {
          store.exec(query().on('powers').create().body(_db.powers).qe, function () {
            done();
          });
        });
      });
    });
  });
  afterEach(function (done) {
    store.exec( query().on('supers').remove().qe, function () {
      store.exec( query().on('sidekicks').remove().qe, function () {
        store.exec( query().on('tags').remove().qe, function () {
          store.exec( query().on('powers').remove().qe, function () {
            done();
          });
        });
      });
    });
  });
  it('from keys only', function (done) {
    // First reset the keys to whatever the internal DB keys are:
    var q = query().find().on('tags').where('pk').in([1,3]);
    store.exec(q.qe, function (e,r) {
      var ids = [];
      r.tags.forEach(function(el) { ids.push(el._id.toString()); });
      q = query().update().on('supers').where('handle', 'Bruce').body({tags:ids});
      store.exec(q.qe, function (e,r) {

        // Now query with populate on raw key identifiers
        q = query().find().on('supers')
          .where('handle', 'Bruce')
          .populate('tags');

        store.exec( q.qe, function (e,r) {
          expect( r.linked.tags ).to.have.length(2);
          expect( r.linked.tags[0].body ).to.equal('pro');
          done();
        });

      });

    });
  });
  it('with foreign key', function (done) {
    var qe = query().find().on('supers')
      .where('handle').is('Pug')
      .populate('tags', 'pk').qe;
    store.exec(qe, function (err,res) {
      expect(err).to.not.be.ok;
      expect(res.linked.tags).to.have.length(2);
      done();
    });
  });
  it('based on Qe', function (done) {
    var qe = query().find().on('supers')
      .where('handle').is('Pug')
      .populate('kicks','pk',{on:'sidekicks',select:['name']}).qe;
    store.exec(qe, function (err,res) {
      expect(err).to.not.be.ok;
      expect(res.linked.kicks).to.have.length(2);
      expect(res.linked.kicks[0]).to.not.have.key('skill');
      expect(res.linked.kicks[0].name).to.equal('Gir');
      done();
    });
  });
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

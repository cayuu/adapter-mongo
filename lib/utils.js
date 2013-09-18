
// Generates a MongoDB `selector` object
module.exports.selector = function selector( query ) {

  var sel = {};

  // Convert Query operators to Mongo native
  var map = {
    neq: 'ne'
  };

  function remap( field, op, value ) {
    var o = {};

    // Directly apply the value if operator `eq`
    if ( op === 'eq' ) return sel[ field ] = value;

    // Otherwise map the operator where required
    var operator = map[ op ] ? map[ op ] : op;
    o[ '$'+operator ] = value;

    sel[ field  ] = o;
  }

  if ( query.constraints ) {
    for (var i = 0; i < query.constraints.length; i++ ) {

      var where = query.constraints[i];
      remap( where.field, where.operator, where.condition );
    }
  }
  return sel;
};

module.exports.options = function options( query ) {
  var opt = {};

  if (query.paging) {
    if (query.paging.limit) opt.limit = query.paging.limit;
    if (query.paging.offset) opt.skip = query.paging.offset;
  }

  return opt;
};

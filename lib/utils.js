/**
 * Utility method to shallow step through arrays
 *
 * @param {Array} array The array of elements to step through
 * @param {Function} fn Passed the current value, index and array
 * @private
 */

function each( array, fn ) {
  for (var j=0; j < array.length; j++)
    fn( array[j], j, array );
}


/**
 * Generates a MongoDB query compatible `selectors` object
 *
 * @param {Query}
 */

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


/**
 * Generate a MongoDB query compatible `options` object
 *
 * @param {Query}
 */

module.exports.options = function options( query ) {
  var opt = {};

  if (query.paging) {
    if (query.paging.limit) opt.limit = query.paging.limit;
    if (query.paging.offset) opt.skip = query.paging.offset;
  }

  return opt;
};

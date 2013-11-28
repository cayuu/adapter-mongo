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
 * @param query object
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
 * @param query object
 */

module.exports.options = function options( query ) {
  var opt = {};

  if (query.display) {
    if (query.display.limit) opt.limit = query.display.limit;
    if (query.display.offset) opt.skip = query.display.offset;
  }

  return opt;
};


/**
 * Generate a MongoDB query compatible `modifiers` object
 *
 * Modifiers are built from a query object, specifically from the `content`
 * and `modifiers` arrays.
 *
 * Known query modifiers are of the kind:
 *   - set
 *   - unset
 *   - rename
 *   - inc
 *
 * @param query object
 */

module.exports.modifiers = function modifiers( query ) {
  var mods = {};

  // `content` overrides all other data. Apply these as `$set` if provided
  if (query.content.length) {

    mods[ '$set' ] = {};

    // Apply all inputs passed
    each( query.content, function( dataObj ) {
      // Step through each property in object settor and apply as `$set`
      for (var attr in dataObj )
        mods[ '$set' ][ attr ] = dataObj[ attr ];
    });
  }

  // Only apply modifiers if no `inputs` were set
  else if ( query.modifiers.length ) {

    // Step through each modifier
    each( query.modifiers, function( mod ) {

      // Explicitly model only known modifiers
      each( ['set', 'unset', 'rename', 'inc'], function( type ) {
        if (mod[ type ]) {
          // Handler to force 'unset' value to mongo required `""`
          if (type === 'unset' && mod.value === undefined) mod.value = '';

          if (!mods[ '$'+type ]) mods[ '$'+type ] = {};
          mods[ '$'+type ][ mod[ type ] ] = mod.value;
        }
      });

    });
  }

  return mods;
};


// Generates a MongoDB `selector` object
module.exports.selector = function selector( query ) {

  var sel = {};

  if ( query.constraints ) {
    for (var i = 0; i < query.constraints.length; i++ ) {

      var constraint = query.constraints[i];

      switch( constraint.operator ) {
        case 'is':
        case 'eq':
          sel[ constraint.field ] = constraint.condition;
          break;
        case 'not':
        case 'neq':
          sel[ constraint.field ] = { $ne: constraint.condition };
          break;
      }
    }
  }
  return sel;
}

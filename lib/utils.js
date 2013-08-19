
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
        case 'lt':
          sel[ constraint.field ] = { $lt: constraint.condition };
          break;
        case 'lte':
          sel[ constraint.field ] = { $lte: constraint.condition };
          break;
        case 'gt':
          sel[ constraint.field ] = { $gt: constraint.condition };
          break;
        case 'gte':
          sel[ constraint.field ] = { $gte: constraint.condition };
          break;
      }
    }
  }
  return sel;
}

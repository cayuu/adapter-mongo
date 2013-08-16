
var core = module.exports.core = {
  // Base database connection
  host: 'localhost',
  port: 27017,
  database: 'mydb',

  nativeParser: false,
  safe: true,

  // Authentication
  user: '',
  password: ''

};

var serverOptions = module.exports.serverOptions = {
  native_parser: core.nativeParser,
  auth: {
    user: core.user,
    password: core.password
  }
};

var dbOptions = module.exports.dbOptions = {
  safe: core.safe,
  native_parser: core.nativeParser
};

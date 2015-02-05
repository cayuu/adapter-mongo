
# adapter-mongo

**WIP. Do not use**

> [Query envelope](https://github.com/mekanika/qe) adapter for **MongoDB**


## Usage

Require the adapter:

```js
var adapter = require('mekanika-adapter-mongo');
```

Then specify your MongoDB config:

```js
adapter.config.host = '127.0.0.1';
adapter.config.port = '27017';
adapter.config.db = 'test';
```

And pass Query envelopes to the `.exec(qe, cb)` method:

```js
adapter.exec({do:'find',on:'users'}, myCallback );
```

The function `myCallback` will be passed `(error, results)` as parameters on completion of the adapter execution. In the case of no errors, `error` will equal `null`.


## Tests

To run the **tests**:

    npm test

To **lint** the code:

    npm run lint

To generate **coverage** reports:

    npm run coverage


## License

Copyright &copy; 2013-2015 Clint Walker

Released under the **Mozilla Public License v2.0** ([MPLv2](http://mozilla.org/MPL/2.0/))


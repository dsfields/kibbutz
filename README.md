# Kibbutz

Communal gathering of configuration artifacts.

Kibbutz loads fragments of configuration from multiple sources, and merges them into a single JSON object.

## Usage

Add `kibbutz` as a dependency in `package.json`:

```sh
$ npm install kibbutz -S
```

Create an instance of `Kibbutz`, and give it configuration and/or a list of providers from which to load configuration data:

```js
const Kibbutz = require('kibbutz');

const config = new Kibbutz({
  value: {
    foo: 'bar'
  }
});

const myProvider = {
  load: function(callback) {
    // load configuration data from somewhere
    callback(undefined, configFragment);
  }
};

config.load([ myProvider ], function(err, config) {
  // do something beautiful with your configuration
});
```

## API

### Constructors

#### `new Kibbutz([options])`

Creates an instance of `Kibbutz`.

##### Parameters

  * `options`: _(optional)_ an object with the following keys:

    + `value`: _(optional)_ the base configuration object.  Kibbutz will make a deep copy of this object, which will become the value of `Kibbutz.prototype.value`.  All other configuration fragments loaded via provider with `Kibbutz.prototype.load()` are merged into this object.

##### Example

```js
const Kibbutz = require('kibbutz');

const config = new Kibbutz({
  value: {
    foo: 'bar',
    baz: 'qux'
  }
});

console.log(config.value.foo); // bar
console.log(config.value.baz); // qux
```

### Properties

#### `Kibbutz.prototype.value`

Gets the full configuration object.  This is the merged configuration JSON object from all providers supplied to `Kibbutz.prototype.load()`, and the seed value supplied via options to the constructor.  The object return is immutable, and attempts to modify it will result in an error.

##### Example

```js
const Kibbutz = require('kibbutz');

const config = new Kibbutz({
  value: { foo: 'bar' }
});

config.load([{
  load: function(callback) {
    callback({ baz: 'qux' });
  }
}]);

console.log(config.value.foo); // bar
console.log(config.value.baz); // qux
```

### Methods

#### `Kibbutz.prototype.load(providers, callback)`

##### Parameters

  * `providers`: _(required)_ an array of providers used to load configuration fragments.

  * `callback`: _(required)_ a function invoked when al providers have completed loading.  The expected function signature takes two parameters:

    + `err`: an error returned from one of the providers.

    + `config`: the fully merged configuration value.  This is the same as `Kibbutz.prototype.value`.

##### Returns

The same instance of `Kibbutz`.  This allows multiple method calls to be chained together.

##### Providers

Providers are run serially by how they are ordered in the `providers` array.  One provider does not execute until the previous has completed loading.  In the event one provider fails, no succeeding providers are run.  A provider must be an object with the following signature:

  * `load(callback)`: a method that loads a configuration fragment.  The method takes a single parameter:

    + `err`: an error object passed to the callback.  If no error occurred, the provider must pass in `undefined` or `null`.

    + `fragment`: the configuration fragment loaded by the provider.  This value is ignored if `err` has a value.

##### Merging

Configuration fragments are merged into the base config element managed by `Kibbutz`.  Keys use a first-in-wins strategy, meaning, once a key is set it cannot be set by a different provider.  The exception being objects and arrays.  Objects are deep-merged, and arrays are concatenated.

#### `Kibbutz.prototype.on(eventName, listener)`

`Kibbutz` emits events which can be subscribed to via the `on()` method.  This method functions just like the native Node.js [`EventEmitter.prototype.on()`](https://nodejs.org/api/events.html#events_emitter_on_eventname_listener) method.

##### Parameters

  * `eventName`: _(required)_ the name of the even to which your `listener` is subscribed.

  * `listener`: _(required)_ the function used to handle an event.  Each function signature should follow the expected contract for the associated event.  See below for more details.

##### Returns

The same instance of `Kibbutz`.  This allows multiple method calls to be chained together.

##### Events

  * `config`: raised when a provider's `load()` responds with data.  Listeners should have the following parameters:

    + `providerName`: the name of the provider.

    + `fragment`: the the configuration fragment that has been loaded from the provider.

  * `done`: raised when all providers given to `Kibbutz.prototype.load()` have completed.    Listeners should have the following parameters:

    + `config`: the full configuration JSON object.

##### Example

```js
const Kibbutz = require('kibbutz');

const config = new Kibbutz();

config.on('error', function(err) {
  console.log(err);
})
.on('config', function(providerName, fragment) {
  console.log(`${providerName}: ${fragment}`);
})
.on('done', function(config) {
  myThing.configure(config);
});
```

## Provider Implementations

The following are known Kibbutz provider implementations.  _If you've created one not listed here, please add it to README.md via pull request in the [GitHub project](https://github.com/dsfields/kibbutz)._

  * [`kibbutz-rc`](https://www.npmjs.com/package/kibbutz-rc)
  * [`kibbutz-consul`](https://www.npmjs.com/package/kibbutz-consul)

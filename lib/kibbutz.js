'use strict';

const elv = require('elv');
const EventEmitter = require('events').EventEmitter;


/*
  Messages used for errors.
*/
const _msg = {
  optionsRequired: 'Arg "options" is required',
  optionsObj: 'Invalid options: must be an object',
  optionsValueObj: 'Invalid options: value must be an object',
  callback: 'Invalid argument: callback must be a function.',
  providersArray: 'Arg "providers" must be an array',
  providerLoad: 'Providers must be an object with a "load" method',
  providerLoadArity: 'Provider load methods must take a single callback arg',
  eventNameStr: 'Arg "eventName" must be a non-empty string',
  listenerFunc: 'Arg "listener" must be a function',
  unknownEventName: 'Arg "eventName" referenes an unknown event: ',
  appendNothing: 'No arguments were supplied to append'
};

/*
  Is Plain Old JSON Object.  Returns true if value is an object, and is not an
  Array or Date.  Otherwise false.
*/
const _isPojo = (value) => {
  return (typeof value === 'object'
          && !Array.isArray(value)
          && !(value instanceof Date);
  );
};

/*
  Asserts that the schema of an options object passed to the Kibbutz constructor
  is valid.
*/
const _assertOptions = (options) => {
  if (!elv(options)) return;

  if (!_isPojo(options))
    throw new TypeError(_msg.optionsObj);

  if (options.hasOwnProperty('value')) {
    const value = options.value;
    if (typeof value !== 'object' || value === null)
      throw new TypeError(_msg.optionsValueObj);
  }
};

/*
  Asserts that a callback function argument is valid.
*/
const _assertCallback = (callback) => {
  if (typeof callback !== 'function') throw new TypeError(_msg.callback);
};

/*
  Asserts that the providers array supplied to the load() method is in fact
  an array.
*/
const _assertProviders = (providers) => {
  if (!Array.isArray(providers)) throw new TypeError(_msg.providersArray);
};

/*
  Validates a provider object to ensure it is an object with a load() method.
  If not, throw a TypeError.  This helper is called prior to to the call to
  load() in the default module function.
*/
const _assertProvider = (provider) => {
  if (!elv(provider)
      || typeof provider.load !== 'function'
  )
    throw new TypeError(_msg.providerLoad);

  if (provider.load.length !== 1)
    throw new TypeError(_msg.providerLoadArity);
};

/*
  Merges b into a, and returns a.  The merge is first-one-in wins.  Keys will
  not be over-written.  If matching keys are both an object, the objects are
  merged (this includes arrays).  All objects are deep-copied.
*/
const _merge = (a, b) => {
  if (typeof a !== 'object'
      || a instanceof Date
      || typeof b !== 'object'
      || b instanceof Date
  ) return a;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return a;
    Array.prototype.push.apply(a, b);
    return a;
  }

  const bkeys = Object.keys(b);

  for (let i = 0; i < bkeys.length; i++) {
    const key = bkeys[i];
    const bval = b[key];
    const isBObj = (typeof bval === 'object' && !(bval instanceof Date));

    if (!a.hasOwnProperty(key)) {
      if (!isBObj) {
        a[key] = bval;
      } else {
        a[key] = (Array.isArray(bval)) ? [] : {};
        _merge(a[key], bval);
      }
      continue;
    }

    const aval = a[key];
    if (typeof aval !== 'object' || aval instanceof Date || !isBObj) continue;
    _merge(aval, bval);
  }

  return a;
};

/*
  Makes a deep copy of an object.  If the object is undefined, an empty object
  is returned.
*/
const _deepCopy = (obj) => {
  if (!elv(obj)) return {};
  if (typeof obj !== 'object' || obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    const copiedArray = [];

    for (let i = 0; i < obj.length; i++) {
      const aval = obj[i];
      copiedArray.push((typeof aval === 'object')
        ? _deepCopy(aval)
        : aval);
    }

    return copiedArray;
  }

  const copiedObj = {};
  const keys = Object.keys(obj);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = obj[key];
    copiedObj[key] = (typeof val === 'object')
      ? _deepCopy(val)
      : val;
  }

  return copiedObj;
};

/*
  Recurse through a list of providers, and call their load() method serialy.
*/
const _load = (value, providers, emitter, i, callback) => {
  if (i === providers.length) {
    callback(undefined, value);
    return;
  }

  const val = value;
  const p = providers;
  const events = emitter;
  const next = i + 1;
  const cb = callback;
  const provider = p[i];
  _assertProvider(provider);

  provider.load((err, fragment) => {
    if (elv(err)) {
      cb(err);
      return;
    }
    events.emit('config', fragment);
    _merge(val, fragment);
    _load(val, p, events, next, (e, res) => {
      cb(e, res);
    });
  });
};

/*
  Private state holder.
*/
const _state = new WeakMap();

/*
  Used to aggregate configuration artifacts from multiple sources, and merge
  them into a single JSON object.
*/
class Kibbutz {

  /*
    Creates an instance of Kibbutz.
  */
  constructor(options) {
    _assertOptions(options);

    const val = (elv(options) && elv(options.value))
      ? _deepCopy(options.value)
      : {}

    _state.set(this, {
      value: Object.freeze(val),
      emitter: new EventEmitter()
    });
  }

  /*
    Returns the aggregated configuration object.  If an error occurred during
    loading, that error is thrown.  If loading has not completed, an error is
    thrown.
  */
  get value() { return _state.get(this).value; }

  /*
    Loads configuration fragments from a given list of providers, and merges
    the results into this.value.
  */
  load(providers, callback) {
    _assertProviders(providers);
    _assertCallback(callback);

    const cb = callback;
    const state = _state.get(this);
    const value = _deepCopy(state.value);
    _load(value, providers, state.emitter, 0, (err, val) => {
      if (elv(err)) {
        cb(err);
        return;
      }

      state.value = Object.freeze(val);
      state.emitter.emit('done', state.value);
      cb(undefined, state.value);
    });

    return this;
  }

  /*
    Wires up an event to a listener.
  */
  on(eventName, listener) {
    if (typeof eventName !== 'string' || eventName.length === 0)
      throw new TypeError(_msg.eventNameStr);

    if (typeof listener !== 'function')
      throw new TypeError(_msg.listenerFunc);

    if (eventName !== 'config' && eventName !== 'done')
      throw new Error(_msg.unknownEventName + eventName);

    _state.get(this).emitter.on(eventName, listener);
    return this;
  }

  /*
    Appends JSON objects to the configuration.
  */
  append() {
    if (arguments.length === 0)
      throw new TypeError(_msg.appendNothing);

    const state = _state.get(this);
    const value = _deepCopy(state.value);

    if (arguments.length === 1 && Array.isArray(arguments[0])) {
      const vals = arguments[0];
      for (let i = 0; i < vals.length; i++) {
        const val = vals[i];
        _merge(value, val);
      }

      state.value = Object.freeze(value);

      return this;
    }

    for (let i = 0; i < arguments.length; i++) {
      const val = arguments[i];
      _merge(value, val);
    }

    state.value = Object.freeze(value);

    return this;
  }

}

module.exports = Kibbutz;

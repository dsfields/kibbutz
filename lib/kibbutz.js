'use strict';

const elv = require('elv');
const { EventEmitter } = require('events');
const Promise = require('bluebird');


/*
  Messages used for errors.
*/
const msg = {
  optionsRequired: 'Arg "options" is required',
  optionsObj: 'Invalid options: must be an object',
  optionsValueObj: 'Invalid options: value must be an object',
  callback: 'Invalid argument: callback must be a function.',
  providersArray: 'Arg "providers" must be an array',
  providerLoad: 'Providers must be an object with a "load" method',
  eventNameStr: 'Arg "eventName" must be a non-empty string',
  listenerFunc: 'Arg "listener" must be a function',
  unknownEventName: 'Arg "eventName" referenes an unknown event: ',
  appendNothing: 'No arguments were supplied to append',
  sharedKibbutz: 'Property "shared" must be an instance of Kibbutz or null',
};


const hasProp = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);


/*
  Is Plain Old JSON Object.  Returns true if value is an object, and is not an
  Array or Date.  Otherwise false.
*/
const isPojo = value => typeof value === 'object'
  && !Array.isArray(value)
  && !(value instanceof Date);


/*
  Asserts that the schema of an options object passed to the Kibbutz constructor
  is valid.
*/
const assertOptions = (options) => {
  if (!elv(options)) return;

  if (!isPojo(options)) { throw new TypeError(msg.optionsObj); }

  if (hasProp(options, 'value')) {
    const { value } = options;

    if (typeof value !== 'object' || value === null) {
      throw new TypeError(msg.optionsValueObj);
    }
  }
};


/*
  Asserts that a callback function argument is valid.
*/
const assertCallback = (callback) => {
  if (typeof callback !== 'function') throw new TypeError(msg.callback);
};


/*
  Asserts that the providers array supplied to the load() method is in fact
  an array.
*/
const assertProviders = (providers) => {
  if (!Array.isArray(providers)) throw new TypeError(msg.providersArray);
};


/*
  Validates a provider object to ensure it is an object with a load() method.
  If not, throw a TypeError.  This helper is called prior to to the call to
  load() in the default module function.
*/
const assertProvider = (provider) => {
  if (!elv(provider)
      || typeof provider.load !== 'function'
  ) { throw new TypeError(msg.providerLoad); }
};


/*
  Merges b into a, and returns a.  The merge is first-one-in wins.  Keys will
  not be over-written.  If matching keys are both an object, the objects are
  merged (this includes arrays).  All objects are deep-copied.
*/
const merge = (a, b) => {
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

  const val = a;
  const bkeys = Object.keys(b);

  for (let i = 0; i < bkeys.length; i++) {
    const key = bkeys[i];
    const bval = b[key];
    const isBObj = (typeof bval === 'object' && !(bval instanceof Date));

    if (!hasProp(val, key)) {
      if (!isBObj) {
        val[key] = bval;
      } else {
        val[key] = (Array.isArray(bval)) ? [] : {};
        merge(val[key], bval);
      }
      continue;
    }

    const aval = val[key];
    if (typeof aval !== 'object' || aval instanceof Date || !isBObj) continue;
    merge(aval, bval);
  }

  return val;
};


/*
  Makes a deep copy of an object.  If the object is undefined, an empty object
  is returned.
*/
const deepCopy = (obj) => {
  if (!elv(obj)) return {};
  if (typeof obj !== 'object' || obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    const copiedArray = [];

    for (let i = 0; i < obj.length; i++) {
      const aval = obj[i];
      copiedArray.push((typeof aval === 'object')
        ? deepCopy(aval)
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
      ? deepCopy(val)
      : val;
  }

  return copiedObj;
};


/*
  Recurse through a list of providers, and call their load() method serialy.
*/
const load = (value, providers, emitter, i, callback) => {
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
  assertProvider(provider);

  provider.load((err, fragment) => {
    if (elv(err)) {
      cb(err);
      return;
    }
    events.emit('config', fragment);
    merge(val, fragment);
    load(val, p, events, next, (e, res) => {
      cb(e, res);
    });
  });
};


/**
 * @typedef {object} Provider
 * Any object used to load configuration data.
 *
 * @prop {function} load - A function that takes a callback as a parameter
 */


/*
  Holds shared Kibbutz instances.
*/
let shared = null;


/**
 * Used to aggregate configuration artifacts from multiple sources, and merge
 * them into a single JSON object.
 */
class Kibbutz {

  /**
   * Creates an instance of Kibbutz.
   */
  constructor(options) {
    assertOptions(options);

    const val = (elv(options) && elv(options.value))
      ? deepCopy(options.value)
      : {};

    this._value = Object.freeze(val);
    this._emitter = new EventEmitter();
  }


  /**
   * Gets or sets an instance of Kibbutz to be shared across modules.
   *
   * @static
   *
   * @returns {Kibbutz}
   */
  static get shared() { return shared; }
  static set shared(val) {
    if (!(val instanceof Kibbutz) && val !== null) {
      throw new TypeError(msg.sharedKibbutz);
    }

    shared = val;
  }


  /**
   * Gets the aggregated configuration object.
   *
   * @readonly
   *
   * @returns {object}
   */
  get value() { return this._value; }


  /**
   * Loads configuration fragments from a given list of providers, and merges
   * the results into this.value.
   *
   * @param {Provider[]} providers
   * @param {function} callback
   *
   * @returns {Kibbutz}
   */
  load(providers, callback) {
    assertProviders(providers);
    assertCallback(callback);

    const cb = callback;
    const value = deepCopy(this._value);
    load(value, providers, this._emitter, 0, (err, val) => {
      if (elv(err)) {
        cb(err);
        return;
      }

      this._value = Object.freeze(val);
      this._emitter.emit('done', this._value);
      cb(undefined, this._value);
    });

    return this;
  }


  /**
   * Loads configuration fragments from a given list of providers, and merges
   * the results into this.value.
   *
   * @param {Provider[]} providers
   *
   * @returns {Promise}
   */
  loadAsync(providers) {
    const p = providers;

    return new Promise((resolve, reject) => {
      const res = resolve;
      const rej = reject;

      this.load(p, (err, value) => {
        if (elv(err)) {
          rej(err);
          return;
        }

        res(value);
      });
    });
  }


  /**
   * Wires up an event to a listener.
   *
   * @param {'config'|'done'} eventName
   * @param {function} listener
   *
   * @returns {Kibbutz}
   */
  on(eventName, listener) {
    if (typeof eventName !== 'string' || eventName.length === 0) {
      throw new TypeError(msg.eventNameStr);
    }

    if (typeof listener !== 'function') {
      throw new TypeError(msg.listenerFunc);
    }

    if (eventName !== 'config' && eventName !== 'done') {
      throw new Error(msg.unknownEventName + eventName);
    }

    this._emitter.on(eventName, listener);
    return this;
  }


  /**
   * Appends JSON objects to the configuration.
   *
   * @param {...object} args
   */
  append(...args) {
    if (args.length === 0) { throw new TypeError(msg.appendNothing); }

    const value = deepCopy(this._value);

    if (args.length === 1 && Array.isArray(args[0])) {
      const vals = args[0];
      for (let i = 0; i < vals.length; i++) {
        const val = vals[i];
        merge(value, val);
      }

      this._value = Object.freeze(value);

      return this;
    }

    for (let i = 0; i < args.length; i++) {
      const val = args[i];
      merge(value, val);
    }

    this._value = Object.freeze(value);

    return this;
  }

}

module.exports = Kibbutz;

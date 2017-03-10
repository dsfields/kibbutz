'use strict';

const assert = require('chai').assert;
const Kibbutz = require('../../lib/kibbutz');

describe('Kibbutz', () => {

  describe('#constructor', () => {
    it('should throw if options not an object', () => {
      assert.throws(() => {
        const config = new Kibbutz(42);
      }, TypeError);
    });

    it('should throw if options an array', () => {
      assert.throws(() => {
        const config = new Kibbutz([]);
      }, TypeError);
    });

    it('should throw if options value not an object', () => {
      assert.throws(() => {
        const config = new Kibbutz({ value: 42 });
      }, TypeError);
    });

    it('should throw if options value null', () => {
      assert.throws(() => {
        const config = new Kibbutz({ value: null });
      }, TypeError);
    });

    it('should set "value" prop when supplied', (done) => {
      const config = new Kibbutz({
        value: { foo: 'bar' }
      });
      assert.strictEqual(config.value.foo, 'bar');
      done();
    });

    it('should set "value" prop as a deep copy of supplied value', (done) => {
      const options = {
        value: { foo: 'bar' }
      };
      const config = new Kibbutz(options);
      assert.notEqual(config.value, options);
      done();
    });

    if ('should set "value" to empty object when not supplied', (done) => {
      const config = new Kibbutz({});
      const count = Object.keys(config.value).length;
      assert.strictEqual(count, 0);
      done();
    });

    if ('should set "value" to empty object when options undefined', (done) => {
      const config = new Kibbutz();
      const count = Object.keys(config.value).length;
      assert.strictEqual(count, 0);
      done();
    });
  });

  describe('#on', () => {
    let config;

    beforeEach((done) => {
      config = new Kibbutz({
        value: { foo: 'bar' }
      });
      done();
    });

    it('should throw if eventName is not a string', () => {
      assert.throws(() => {
        config.on(24, () => { return 42; });
      }, TypeError);
    });

    it('should throw if eventName an empty string', () => {
      assert.throws(() => {
        config.on('', () => { return 42; });
      }, TypeError);
    });

    it('should throw if listener not a function', () => {
      assert.throws(() => {
        config.on('config', undefined);
      }, TypeError);
    });

    it('should throw if eventName an unknown event', () => {
      assert.throws(() => {
        config.on('blah', () => { return 42; });
      });
    });

    it('should return same instance of Kibbutz', (done) => {
      const next = config.on('config', (fragment) => { return 42; });
      assert.strictEqual(next, config);
      done();
    });
  });

  describe('#shared', () => {
    afterEach(() => {
      Kibbutz.shared = null;
    });

    it('should throw if set to not null or instanceof Kibbutz', () => {
      assert.throws(() => {
        Kibbutz.shared = 123;
      });
    });

    it('should set a global instance of Kibbutz', () => {
      Kibbutz.shared = new Kibbutz();
      assert.instanceOf(Kibbutz.shared, Kibbutz);
    });

    it('should get null if not set', () => {
      assert.isNull(Kibbutz.shared);
    });
  });

  describe('#value', () => {
    let config;

    beforeEach((done) => {
      config = new Kibbutz({
        value: { foo: 'bar' }
      });
      done();
    });

    it('should return object', (done) => {
      assert.isObject(config.value);
      done();
    });

    it('should return a frozen object', (done) => {
      assert.isFrozen(config.value);
      done();
    });
  });

  describe('#load', () => {
    let config;

    const provider = {
      load: function(callback) {
        process.nextTick(() => {
          callback(undefined, { baz: 'qux' });
        });
      }
    };

    const errorProvider = {
      load: function(callback) {
        process.nextTick(() => {
          callback({ message: 'Test' }, undefined);
        });
      }
    };

    beforeEach((done) => {
      config = new Kibbutz({
        value: { foo: 'bar' }
      });
      done();
    });

    it('should throw if providers not array', () => {
      assert.throws(() => {
        config.load(42, (err, conf) => { return 42; });
      }, TypeError);
    });

    it('should throw if callback not a function', () => {
      assert.throws(() => {
        config.load([
          {
            load: function(callback) { return 'noice' }
          }
        ], 'blah');
      }, TypeError);
    });

    it('should throw if provider is null', () => {
      assert.throws(() => {
        config.load(null, (err, conf) => { return 42; });
      }, TypeError);
    });

    it('should throw if provider is undefined', () => {
      assert.throws(() => {
        config.load(undefined, (err, conf) => { return 42; });
      }, TypeError);
    });

    it('should throw if provider does not have load method', () => {
      assert.throws(() => {
        config.load([{}], (err, conf) => { return 42; });
      }, TypeError);
    });

    it('should throw if provider.load does not have arity of 1', () => {
      assert.throws(() => {
        config.load([
          {
            load: function() { return 'noice' }
          }
        ], 'blah');
      }, TypeError);
    });

    it('should call each provider.load', (done) => {
      let calledA = false;
      let calledB = false;

      const providerA = {
        load: function(callback) {
          calledA = true;
          process.nextTick(() => {
            callback(undefined, {});
          });
        }
      };

      const providerB = {
        load: function(callback) {
          calledB = true;
          process.nextTick(() => {
            callback(undefined, {});
          });
        }
      };

      config.load([ providerA, providerB], (err, conf) => {
        assert.isTrue(calledA);
        assert.isTrue(calledB);
        done();
      });
    });

    it('should call callback with errors', (done) => {
      config.load([ errorProvider ], (err, conf) => {
        assert.isObject(err);
        done();
      });
    });

    it('should should call callback with config result', (done) => {
      config.load([ provider ], (err, conf) => {
        assert.isObject(conf);
        done();
      });
    });

    it('should call providers in order', (done) => {
      const results = [];

      const providerA = {
        load: function(callback) {
          results.push('a');
          process.nextTick(() => {
            callback(undefined, { keyA: 'a' });
          })
        }
      };

      const providerB = {
        load: function(callback) {
          results.push('b');
          process.nextTick(() => {
            callback(undefined, { keyB: 'b' });
          })
        }
      };

      config.load([providerA, providerB], (err, conf) => {
        assert.strictEqual(results[0], 'a');
        assert.strictEqual(results[1], 'b');
        done();
      });
    });

    it('should emit "config" when configuration loaded', (done) => {
      let emitted = false;
      config.on('config', (fragment) => {
        emitted = true;
      });

      config.load([ provider ], (err, conf) => {
        assert.isTrue(emitted);
        done();
      });
    });

    it('should pass load fragment to config listeners', (done) => {
      config.on('config', (fragment) => {
        assert.deepEqual(fragment, { baz: 'qux' });
      });

      config.load([ provider ], (err, conf) => {
        done();
      });
    });

    it('should emit "done" when all config loaded', (done) => {
      let emitted = false;
      config.on('done', (conf) => {
        emitted = true;
      });

      config.load([ provider ], (err, conf) => {
        assert.isTrue(emitted);
        done();
      });
    });

    it('should pass full config value to done listeners', (done) => {
      config.on('done', (conf) => {
        assert.deepEqual(conf, {
          foo: 'bar',
          baz: 'qux'
        });
      });

      config.load([ provider ], (err, conf) => {
        done();
      });
    });

    it('should throw if eventName not string', () => {
      assert.throws(() => {
        config.on(42, (fragment) => { });
      }, TypeError);
    });

    it('should not overwrite string-valued keys', (done) => {
      const p = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: 'qux' });
          });
        }
      };

      const foo = 'bar';
      const c = new Kibbutz({
        value: { foo: foo }
      });

      c.load([ p ], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('should not overwrite number-valued keys', (done) => {
      const p = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: 24 });
          });
        }
      };

      const foo = 42;
      const c = new Kibbutz({
        value: { foo: foo }
      });

      c.load([ p ], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('should not overwrite date-valued keys', (done) => {
      const p = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: new Date(1991, 9, 24) });
            // oh well whatever nevermind
          });
        }
      };

      const foo = new Date(1978, 6, 20);
      const c = new Kibbutz({
        value: { foo: foo }
      });

      c.load([ p ], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('should not overwrite function-valued keys', (done) => {
      const p = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: 42 });
          });
        }
      };

      const foo = function() { return 42; };
      const c = new Kibbutz({
        value: { foo: foo }
      });

      c.load([ p ], (err, conf) => {
        assert.isFunction(conf.foo);
        done();
      });
    });

    it('should not overwrite Boolean-valued keys', (done) => {
      const p = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: false });
          });
        }
      };

      const foo = true;
      const c = new Kibbutz({
        value: { foo: foo }
      });

      c.load([ p ], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('should merge into array-valued keys', (done) => {
      const alsoFoo = ['c'];
      const p = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: alsoFoo });
          });
        }
      };

      const foo = ['a', 'b'];
      const c = new Kibbutz({
        value: { foo: foo }
      });

      c.load([ p ], (err, conf) => {
        assert.strictEqual(conf.foo[0], foo[0]);
        assert.strictEqual(conf.foo[1], foo[1]);
        assert.strictEqual(conf.foo[2], alsoFoo[0]);
        done();
      });
    });

    it('should merge into object-valued keys', (done) => {
      const alsoFoo = { qux: 'quux' };
      const p = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              foo: alsoFoo
            });
          });
        }
      };

      const foo = { bar: 'baz' };
      const c = new Kibbutz({
        value: { foo: foo }
      });

      c.load([ p ], (err, conf) => {
        assert.strictEqual(conf.foo.bar, foo.bar);
        assert.strictEqual(conf.foo.qux, alsoFoo.qux);
        done();
      });
    });

    it('should set value property with fully merged config', (done) => {
      config.load([ provider ], (err, conf) => {
        assert.strictEqual(config.value.foo, 'bar');
        assert.strictEqual(config.value.baz, 'qux');
        done();
      });
    });

    it('should call callback with undefined for error on success', (done) => {
      config.load([ provider ], (err, conf) => {
        assert.strictEqual(err, undefined);
        done();
      });
    });

    it('should call callback with error when encountered', (done) => {
      config.load([ errorProvider], (err, conf) => {
        assert.isOk(err);
        done();
      });
    });
  });

  describe('#append', () => {
    let config;

    beforeEach((done) => {
      config = new Kibbutz({
        value: { foo: 'bar' }
      });
      done();
    });

    it('should throw if no arguments passed', () => {
      assert.throws(() => {
        config.append();
      }, TypeError);
    });

    it('should return self', (done) => {
      const res = config.append({ baz: 'qux' });
      assert.strictEqual(res, config);
      done();
    });

    it('should append value in array', (done) => {
      config.append([ { baz: 'qux' } ]);
      assert.strictEqual(config.value.foo, 'bar');
      assert.strictEqual(config.value.baz, 'qux');
      done();
    });

    it('should append multiple values in array', (done) => {
      config.append([ { baz: 'qux' }, { quux: 'corge' } ]);
      assert.strictEqual(config.value.foo, 'bar');
      assert.strictEqual(config.value.baz, 'qux');
      assert.strictEqual(config.value.quux, 'corge');
      done();
    });

    it('should set value to frozen object', (done) => {
      config.append([ { baz: 'qux' } ]);
      assert.isFrozen(config.value);
      done();
    });

    it('should append value', (done) => {
      config.append({ baz: 'qux' });
      assert.strictEqual(config.value.foo, 'bar');
      assert.strictEqual(config.value.baz, 'qux');
      done();
    });

    it('should append multiple argument values', (done) => {
      config.append({ baz: 'qux' }, { quux: 'corge' });
      assert.strictEqual(config.value.foo, 'bar');
      assert.strictEqual(config.value.baz, 'qux');
      assert.strictEqual(config.value.quux, 'corge');
      done();
    });

    it('should set value to frozen object', (done) => {
      config.append({ baz: 'qux' });
      assert.isFrozen(config.value);
      done();
    });
  });

});

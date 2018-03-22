'use strict';

const { assert } = require('chai');
const Promise = require('bluebird');

const Kibbutz = require('../../lib/kibbutz');


describe('Kibbutz', function() {

  describe('#constructor', function() {
    it('throws if options not an object', function() {
      assert.throws(() => {
        const config = new Kibbutz(42);
        assert.isNotOk(config);
      }, TypeError);
    });

    it('throws if options an array', function() {
      assert.throws(() => {
        const config = new Kibbutz([]);
        assert.isNotOk(config);
      }, TypeError);
    });

    it('throws if options value not an object', function() {
      assert.throws(() => {
        const config = new Kibbutz({ value: 42 });
        assert.isNotOk(config);
      }, TypeError);
    });

    it('throws if options value null', function() {
      assert.throws(() => {
        const config = new Kibbutz({ value: null });
        assert.isNotOk(config);
      }, TypeError);
    });

    it('sets "value" prop when supplied', function(done) {
      const config = new Kibbutz({
        value: { foo: 'bar' },
      });
      assert.strictEqual(config.value.foo, 'bar');
      done();
    });

    it('sets "value" prop as a deep copy of supplied value', function(done) {
      const options = {
        value: { foo: 'bar' },
      };
      const config = new Kibbutz(options);
      assert.notEqual(config.value, options);
      done();
    });

    it('sets "value" to empty object when not supplied', function(done) {
      const config = new Kibbutz({});
      const count = Object.keys(config.value).length;
      assert.strictEqual(count, 0);
      done();
    });

    it('sets "value" to empty object when options undefined', function(done) {
      const config = new Kibbutz();
      const count = Object.keys(config.value).length;
      assert.strictEqual(count, 0);
      done();
    });
  });


  describe('#on', function() {
    beforeEach(function(done) {
      this.config = new Kibbutz({
        value: { foo: 'bar' },
      });
      done();
    });

    it('throws if eventName is not a string', function() {
      assert.throws(() => {
        this.config.on(24, () => 42);
      }, TypeError);
    });

    it('throws if eventName an empty string', function() {
      assert.throws(() => {
        this.config.on('', () => 42);
      }, TypeError);
    });

    it('throw if listener not a function', function() {
      assert.throws(() => {
        this.config.on('config', undefined);
      }, TypeError);
    });

    it('throws if eventName an unknown event', function() {
      assert.throws(() => {
        this.config.on('blah', () => 42);
      });
    });

    it('returns same instance of Kibbutz', function(done) {
      const next = this.config.on('config', () => 42);
      assert.strictEqual(next, this.config);
      done();
    });
  });


  describe('#shared', function() {
    afterEach(function() {
      Kibbutz.shared = null;
    });

    it('throws if set to not null or instanceof Kibbutz', function() {
      assert.throws(() => {
        Kibbutz.shared = 123;
      });
    });

    it('sets a global instance of Kibbutz', function() {
      Kibbutz.shared = new Kibbutz();
      assert.instanceOf(Kibbutz.shared, Kibbutz);
    });

    it('gets null if not set', function() {
      assert.isNull(Kibbutz.shared);
    });
  });


  describe('#value', function() {
    beforeEach(function(done) {
      this.config = new Kibbutz({
        value: { foo: 'bar' },
      });
      done();
    });

    it('returns object', function(done) {
      assert.isObject(this.config.value);
      done();
    });

    it('returns a frozen object', function(done) {
      assert.isFrozen(this.config.value);
      done();
    });
  });


  describe('#load', () => {
    beforeEach(function(done) {
      this.provider = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { baz: 'qux' });
          });
        },
      };

      this.errorProvider = {
        load(callback) {
          process.nextTick(() => {
            callback({ message: 'Test' }, undefined);
          });
        },
      };

      this.config = new Kibbutz({
        value: { foo: 'bar' },
      });
      done();
    });

    it('throws if providers not array', function() {
      assert.throws(() => {
        this.config.load(42, () => 42);
      }, TypeError);
    });

    it('throws if callback not a function', function() {
      assert.throws(() => {
        this.config.load([
          {
            load() { return 'noice'; },
          },
        ], 'blah');
      }, TypeError);
    });

    it('throws if provider is null', function() {
      assert.throws(() => {
        this.config.load(null, () => 42);
      }, TypeError);
    });

    it('throws if provider is undefined', function() {
      assert.throws(() => {
        this.config.load(undefined, () => 42);
      }, TypeError);
    });

    it('throws if provider does not have load method', function() {
      assert.throws(() => {
        this.config.load([{}], () => 42);
      }, TypeError);
    });

    it('calls each provider.load', function(done) {
      let calledA = false;
      let calledB = false;

      const providerA = {
        load(callback) {
          calledA = true;
          process.nextTick(() => {
            callback(undefined, {});
          });
        },
      };

      const providerB = {
        load(callback) {
          calledB = true;
          process.nextTick(() => {
            callback(undefined, {});
          });
        },
      };

      this.config.load([providerA, providerB], () => {
        assert.isTrue(calledA);
        assert.isTrue(calledB);
        done();
      });
    });

    it('calls callback with errors', function(done) {
      this.config.load([this.errorProvider], (err) => {
        assert.isObject(err);
        done();
      });
    });

    it('calls callback with config result', function(done) {
      this.config.load([this.provider], (err, conf) => {
        assert.isObject(conf);
        done();
      });
    });

    it('calls providers in order', function(done) {
      const results = [];

      const providerA = {
        load(callback) {
          results.push('a');
          process.nextTick(() => {
            callback(undefined, { keyA: 'a' });
          });
        },
      };

      const providerB = {
        load(callback) {
          results.push('b');
          process.nextTick(() => {
            callback(undefined, { keyB: 'b' });
          });
        },
      };

      this.config.load([providerA, providerB], function() {
        assert.strictEqual(results[0], 'a');
        assert.strictEqual(results[1], 'b');
        done();
      });
    });

    it('emits "config" when configuration loaded', function(done) {
      let emitted = false;
      this.config.on('config', () => {
        emitted = true;
      });

      this.config.load([this.provider], () => {
        assert.isTrue(emitted);
        done();
      });
    });

    it('passes load fragment to config listeners', function(done) {
      this.config.on('config', (fragment) => {
        assert.deepEqual(fragment, { baz: 'qux' });
      });

      this.config.load([this.provider], () => {
        done();
      });
    });

    it('emits "done" when all config loaded', function(done) {
      let emitted = false;
      this.config.on('done', () => {
        emitted = true;
      });

      this.config.load([this.provider], () => {
        assert.isTrue(emitted);
        done();
      });
    });

    it('should pass full config value to done listeners', function(done) {
      this.config.on('done', (conf) => {
        assert.deepEqual(conf, {
          foo: 'bar',
          baz: 'qux',
        });
      });

      this.config.load([this.provider], () => {
        done();
      });
    });

    it('throws if eventName not string', function() {
      assert.throws(() => {
        this.config.on(42, () => { });
      }, TypeError);
    });

    it('does not overwrite string-valued keys', function(done) {
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: 'qux' });
          });
        },
      };

      const foo = 'bar';
      const c = new Kibbutz({
        value: { foo },
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('does not overwrite number-valued keys', function(done) {
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: 24 });
          });
        },
      };

      const foo = 42;
      const c = new Kibbutz({
        value: { foo },
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('does not overwrite date-valued keys', function(done) {
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: new Date(1991, 9, 24) });
            // oh well whatever nevermind
          });
        },
      };

      const foo = new Date(1978, 6, 20);
      const c = new Kibbutz({
        value: { foo },
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('does not overwrite function-valued keys', function(done) {
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: 42 });
          });
        },
      };

      const foo = function() { return 42; };
      const c = new Kibbutz({
        value: { foo },
      });

      c.load([p], (err, conf) => {
        assert.isFunction(conf.foo);
        done();
      });
    });

    it('does not overwrite Boolean-valued keys', function(done) {
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: false });
          });
        },
      };

      const foo = true;
      const c = new Kibbutz({
        value: { foo },
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf.foo, foo);
        done();
      });
    });

    it('merges into array-valued keys', function(done) {
      const alsoFoo = ['c'];
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { foo: alsoFoo });
          });
        },
      };

      const foo = ['a', 'b'];
      const c = new Kibbutz({
        value: { foo },
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf.foo[0], foo[0]);
        assert.strictEqual(conf.foo[1], foo[1]);
        assert.strictEqual(conf.foo[2], alsoFoo[0]);
        done();
      });
    });

    it('merges into object-valued keys', function(done) {
      const alsoFoo = { qux: 'quux' };
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, {
              foo: alsoFoo,
            });
          });
        },
      };

      const foo = { bar: 'baz' };
      const c = new Kibbutz({
        value: { foo },
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf.foo.bar, foo.bar);
        assert.strictEqual(conf.foo.qux, alsoFoo.qux);
        done();
      });
    });

    it('merges multiple object-valued keys', function(done) {
      const b = { qux: { quux: 'corge' } };
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, b);
          });
        },
      };

      const a = { foo: { bar: 'baz' } };
      const c = new Kibbutz({
        value: a,
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf.foo.bar, a.foo.bar);
        assert.strictEqual(conf.qux.quux, b.qux.quux);
        done();
      });
    });

    it('gives back Date if first loaded object is a Date', function(done) {
      const b = { foo: 'bar' };
      const p = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, b);
          });
        },
      };

      const a = new Date(267148800000);
      const c = new Kibbutz({
        value: a,
      });

      c.load([p], (err, conf) => {
        assert.strictEqual(conf, a);
        done();
      });
    });

    it('sets value property with fully merged config', function(done) {
      this.config.load([this.provider], () => {
        assert.strictEqual(this.config.value.foo, 'bar');
        assert.strictEqual(this.config.value.baz, 'qux');
        done();
      });
    });

    it('calls callback with undefined for error on success', function(done) {
      this.config.load([this.provider], (err) => {
        assert.strictEqual(err, undefined);
        done();
      });
    });

    it('should call callback with error when encountered', function(done) {
      this.config.load([this.errorProvider], (err) => {
        assert.isOk(err);
        done();
      });
    });
  });


  describe('#loadAsync', function() {
    beforeEach(function(done) {
      this.configValue = { foo: 'bar', baz: 'qux' };

      this.provider = {
        load(callback) {
          process.nextTick(() => {
            callback(undefined, { baz: 'qux' });
          });
        },
      };

      this.errorProvider = {
        load(callback) {
          process.nextTick(() => {
            callback({ message: 'Test' }, undefined);
          });
        },
      };

      this.config = new Kibbutz({
        value: { foo: 'bar' },
      });
      done();
    });

    it('returns Promise', function() {
      const result = this.config.loadAsync([this.provider]);
      assert.instanceOf(result, Promise);
    });

    it('rejects when providers not array', function(done) {
      this.config.loadAsync(42)
        .then(() => {
          done('Nope');
        })
        .catch((err) => {
          if (err instanceof TypeError) {
            done();
            return;
          }
          done(err);
        });
    });

    it('rejects when provider is null', function(done) {
      this.config.loadAsync([null])
        .then(() => {
          done('Nope');
        })
        .catch((err) => {
          if (err instanceof TypeError) {
            done();
            return;
          }
          done(err);
        });
    });

    it('rejects when provider is undefined', function(done) {
      this.config.loadAsync([undefined])
        .then(() => {
          done('Nope');
        })
        .catch((err) => {
          if (err instanceof TypeError) {
            done();
            return;
          }
          done(err);
        });
    });

    it('rejects if providers not have load method', function(done) {
      this.config.loadAsync([{}])
        .then(() => {
          done('Nope');
        })
        .catch((err) => {
          if (err instanceof TypeError) {
            done();
            return;
          }
          done(err);
        });
    });

    it('rejects if provider errors', function(done) {
      this.config.loadAsync([this.errorProvider])
        .then(() => {
          done('Nope');
        })
        .catch(() => {
          done();
        });
    });

    it('resolves with value', function(done) {
      this.config.loadAsync([this.provider])
        .then((result) => {
          assert.deepEqual(result, this.configValue);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });


  describe('#append', function() {
    beforeEach(function(done) {
      this.config = new Kibbutz({
        value: { foo: 'bar' },
      });
      done();
    });

    it('throws if no arguments passed', function() {
      assert.throws(() => {
        this.config.append();
      }, TypeError);
    });

    it('returns self', function(done) {
      const res = this.config.append({ baz: 'qux' });
      assert.strictEqual(res, this.config);
      done();
    });

    it('appends value in array', function(done) {
      this.config.append([{ baz: 'qux' }]);
      assert.strictEqual(this.config.value.foo, 'bar');
      assert.strictEqual(this.config.value.baz, 'qux');
      done();
    });

    it('appends multiple values in array', function(done) {
      this.config.append([{ baz: 'qux' }, { quux: 'corge' }]);
      assert.strictEqual(this.config.value.foo, 'bar');
      assert.strictEqual(this.config.value.baz, 'qux');
      assert.strictEqual(this.config.value.quux, 'corge');
      done();
    });

    it('sets value to frozen object', function(done) {
      this.config.append([{ baz: 'qux' }]);
      assert.isFrozen(this.config.value);
      done();
    });

    it('appends value', function(done) {
      this.config.append({ baz: 'qux' });
      assert.strictEqual(this.config.value.foo, 'bar');
      assert.strictEqual(this.config.value.baz, 'qux');
      done();
    });

    it('appends multiple argument values', function(done) {
      this.config.append({ baz: 'qux' }, { quux: 'corge' });
      assert.strictEqual(this.config.value.foo, 'bar');
      assert.strictEqual(this.config.value.baz, 'qux');
      assert.strictEqual(this.config.value.quux, 'corge');
      done();
    });

    it('sets value to frozen object', function(done) {
      this.config.append({ baz: 'qux' });
      assert.isFrozen(this.config.value);
      done();
    });
  });

});

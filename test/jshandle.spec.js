/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function({testRunner, expect, CHROMIUM, FFOX, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.evaluateHandle', function() {
    it('should work', async({page, server}) => {
      const windowHandle = await page.evaluateHandle(() => window);
      expect(windowHandle).toBeTruthy();
    });
    it('should accept object handle as an argument', async({page, server}) => {
      const navigatorHandle = await page.evaluateHandle(() => navigator);
      const text = await page.evaluate(e => e.userAgent, navigatorHandle);
      expect(text).toContain('Mozilla');
    });
    it('should accept object handle to primitive types', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => 5);
      const isFive = await page.evaluate(e => Object.is(e, 5), aHandle);
      expect(isFive).toBeTruthy();
    });
    it('should warn on nested object handles', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => document.body);
      let error = null;
      await page.evaluateHandle(
          opts => opts.elem.querySelector('p'),
          { elem: aHandle }
      ).catch(e => error = e);
      expect(error.message).toContain('Are you passing a nested JSHandle?');
    });
    it('should accept object handle to unserializable value', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => Infinity);
      expect(await page.evaluate(e => Object.is(e, Infinity), aHandle)).toBe(true);
    });
    it('should use the same JS wrappers', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => {
        window.FOO = 123;
        return window;
      });
      expect(await page.evaluate(e => e.FOO, aHandle)).toBe(123);
    });
    it('should work with primitives', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => {
        window.FOO = 123;
        return window;
      });
      expect(await page.evaluate(e => e.FOO, aHandle)).toBe(123);
    });
  });

  describe('JSHandle.getProperty', function() {
    it('should work', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => ({
        one: 1,
        two: 2,
        three: 3
      }));
      const twoHandle = await aHandle.getProperty('two');
      expect(await twoHandle.jsonValue()).toEqual(2);
    });
  });

  describe('JSHandle.jsonValue', function() {
    it('should work', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => ({foo: 'bar'}));
      const json = await aHandle.jsonValue();
      expect(json).toEqual({foo: 'bar'});
    });
    it('should not work with dates', async({page, server}) => {
      const dateHandle = await page.evaluateHandle(() => new Date('2017-09-26T00:00:00.000Z'));
      const json = await dateHandle.jsonValue();
      expect(json).toEqual({});
    });
    it('should throw for circular objects', async({page, server}) => {
      const windowHandle = await page.evaluateHandle('window');
      let error = null;
      await windowHandle.jsonValue().catch(e => error = e);
      if (WEBKIT)
        expect(error.message).toContain('Object has too long reference chain');
      else if (CHROMIUM)
        expect(error.message).toContain('Object reference chain is too long');
      else if (FFOX)
        expect(error.message).toContain('Object is not serializable');
    });
    it('should work with tricky values', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => ({a: 1}));
      const json = await aHandle.jsonValue();
      expect(json).toEqual({a: 1});
    });
  });

  describe('JSHandle.getProperties', function() {
    it('should work', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => ({
        foo: 'bar'
      }));
      const properties = await aHandle.getProperties();
      const foo = properties.get('foo');
      expect(foo).toBeTruthy();
      expect(await foo.jsonValue()).toBe('bar');
    });
    it('should return empty map for non-objects', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => 123);
      const properties = await aHandle.getProperties();
      expect(properties.size).toBe(0);
    });
    it('should return even non-own properties', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => {
        class A {
          constructor() {
            this.a = '1';
          }
        }
        class B extends A {
          constructor() {
            super();
            this.b = '2';
          }
        }
        return new B();
      });
      const properties = await aHandle.getProperties();
      expect(await properties.get('a').jsonValue()).toBe('1');
      expect(await properties.get('b').jsonValue()).toBe('2');
    });
  });

  describe('JSHandle.asElement', function() {
    it('should work', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => document.body);
      const element = aHandle.asElement();
      expect(element).toBeTruthy();
    });
    it('should return null for non-elements', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => 2);
      const element = aHandle.asElement();
      expect(element).toBeFalsy();
    });
    it('should return ElementHandle for TextNodes', async({page, server}) => {
      await page.setContent('<div>ee!</div>');
      const aHandle = await page.evaluateHandle(() => document.querySelector('div').firstChild);
      const element = aHandle.asElement();
      expect(element).toBeTruthy();
      expect(await page.evaluate(e => e.nodeType === HTMLElement.TEXT_NODE, element)).toBeTruthy();
    });
    it('should work with nullified Node', async({page, server}) => {
      await page.setContent('<section>test</section>');
      await page.evaluate(() => delete Node);
      const handle = await page.evaluateHandle(() => document.querySelector('section'));
      const element = handle.asElement();
      expect(element).not.toBe(null);
    });
  });

  describe('JSHandle.toString', function() {
    it('should work for primitives', async({page, server}) => {
      const numberHandle = await page.evaluateHandle(() => 2);
      expect(numberHandle.toString()).toBe('JSHandle:2');
      const stringHandle = await page.evaluateHandle(() => 'a');
      expect(stringHandle.toString()).toBe('JSHandle:a');
    });
    it('should work for complicated objects', async({page, server}) => {
      const aHandle = await page.evaluateHandle(() => window);
      expect(aHandle.toString()).toBe('JSHandle@object');
    });
    it('should work for promises', async({page, server}) => {
      // wrap the promise in an object, otherwise we will await.
      const wrapperHandle = await page.evaluateHandle(() => ({b: Promise.resolve(123)}));
      const bHandle = await wrapperHandle.getProperty('b');
      expect(bHandle.toString()).toBe('JSHandle@promise');
    });
    it('should work with different subtypes', async({page, server}) => {
      expect((await page.evaluateHandle('(function(){})')).toString()).toBe('JSHandle@function');
      expect((await page.evaluateHandle('12')).toString()).toBe('JSHandle:12');
      expect((await page.evaluateHandle('true')).toString()).toBe('JSHandle:true');
      expect((await page.evaluateHandle('undefined')).toString()).toBe('JSHandle:undefined');
      expect((await page.evaluateHandle('"foo"')).toString()).toBe('JSHandle:foo');
      expect((await page.evaluateHandle('Symbol()')).toString()).toBe('JSHandle@symbol');
      expect((await page.evaluateHandle('new Map()')).toString()).toBe('JSHandle@map');
      expect((await page.evaluateHandle('new Set()')).toString()).toBe('JSHandle@set');
      expect((await page.evaluateHandle('[]')).toString()).toBe('JSHandle@array');
      expect((await page.evaluateHandle('null')).toString()).toBe('JSHandle:null');
      expect((await page.evaluateHandle('/foo/')).toString()).toBe('JSHandle@regexp');
      expect((await page.evaluateHandle('document.body')).toString()).toBe('JSHandle@node');
      expect((await page.evaluateHandle('new Date()')).toString()).toBe('JSHandle@date');
      expect((await page.evaluateHandle('new WeakMap()')).toString()).toBe('JSHandle@weakmap');
      expect((await page.evaluateHandle('new WeakSet()')).toString()).toBe('JSHandle@weakset');
      expect((await page.evaluateHandle('new Error()')).toString()).toBe('JSHandle@error');
      // TODO(yurys): change subtype from array to typedarray in WebKit.
      expect((await page.evaluateHandle('new Int32Array()')).toString()).toBe(WEBKIT ? 'JSHandle@array' : 'JSHandle@typedarray');
      expect((await page.evaluateHandle('new Proxy({}, {})')).toString()).toBe('JSHandle@proxy');
    });
  });
};

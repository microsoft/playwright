/**
 * @license
 * Copyright 2024 Google Inc.
 * Modifications copyright (c) Microsoft Corporation.
 * SPDX-License-Identifier: Apache-2.0
 */


import type * as Bidi from './bidiProtocol';

/* eslint-disable object-curly-spacing */

/**
 * @internal
 */
export class BidiDeserializer {
  static deserialize(result: Bidi.Script.RemoteValue): any {
    if (!result)
      return undefined;

    switch (result.type) {
      case 'array':
        return result.value?.map(value => {
          return BidiDeserializer.deserialize(value);
        });
      case 'set':
        return result.value?.reduce((acc: Set<unknown>, value) => {
          return acc.add(BidiDeserializer.deserialize(value));
        }, new Set());
      case 'object':
        return result.value?.reduce((acc: Record<any, unknown>, tuple) => {
          const {key, value} = BidiDeserializer._deserializeTuple(tuple);
          acc[key as any] = value;
          return acc;
        }, {});
      case 'map':
        return result.value?.reduce((acc: Map<unknown, unknown>, tuple) => {
          const {key, value} = BidiDeserializer._deserializeTuple(tuple);
          return acc.set(key, value);
        }, new Map());
      case 'promise':
        return {};
      case 'regexp':
        return new RegExp(result.value.pattern, result.value.flags);
      case 'date':
        return new Date(result.value);
      case 'undefined':
        return undefined;
      case 'null':
        return null;
      case 'number':
        return BidiDeserializer._deserializeNumber(result.value);
      case 'bigint':
        return BigInt(result.value);
      case 'boolean':
        return Boolean(result.value);
      case 'string':
        return result.value;
    }

    throw new Error(`Deserialization of type ${result.type} not supported.`);
  }

  static _deserializeNumber(value: Bidi.Script.SpecialNumber | number): number {
    switch (value) {
      case '-0':
        return -0;
      case 'NaN':
        return NaN;
      case 'Infinity':
        return Infinity;
      case '-Infinity':
        return -Infinity;
      default:
        return value;
    }
  }

  static _deserializeTuple([serializedKey, serializedValue]: [
    Bidi.Script.RemoteValue | string,
    Bidi.Script.RemoteValue,
  ]): {key: unknown; value: unknown} {
    const key =
      typeof serializedKey === 'string'
        ? serializedKey
        : BidiDeserializer.deserialize(serializedKey);
    const value = BidiDeserializer.deserialize(serializedValue);

    return {key, value};
  }
}

# Map/Set Props Support in Component Testing

## Summary

This PR adds comprehensive support for passing Map and Set objects as props in Playwright component testing. Previously, Map and Set objects were being serialized to empty objects (`{}`), making it impossible to test components that accept these data structures as props.

## Implementation Details

The implementation leverages existing serialization/deserialization logic in the Playwright codebase:

1. Maps are serialized with a `__pw_type: 'map'` property and their entries stored in a `value` array
2. Sets are serialized with a `__pw_type: 'set'` property and their values stored in a `value` array
3. On the client side, these serialized objects are properly deserialized back to Map and Set instances

## Test Coverage

Added comprehensive test coverage including:
- Basic Map and Set props
- Complex Map and Set values (objects, etc.)
- Nested Map and Set structures

## Usage Example

```jsx
// In your test file
const selectedItems = new Set(['orange', 'bananas']);
const itemDetails = new Map([
  ['orange', { color: 'orange', price: 1.2 }],
  ['bananas', { color: 'yellow', price: 0.8 }]
]);

await mount(<FruitPicker selectedItems={selectedItems} itemDetails={itemDetails} />);
```

This will now correctly pass the Map and Set objects to your component, preserving their structure and methods.

## Related Issues

Fixes #36963
Refs #26730
Refs #24040
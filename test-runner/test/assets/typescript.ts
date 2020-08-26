import '../../';
import { abc } from "./global-foo";

it('should find global foo', () => {
  expect(global['foo']).toBe(true);
});

it('should work with type annotations', () => {
  const x: number = 5;
  expect(x).toBe(5);
});
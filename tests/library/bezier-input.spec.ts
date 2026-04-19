import { test, expect } from '@playwright/test';
import { generateBezierPath } from '../../packages/playwright-core/src/server/chromium/bezierInput';

const seeded = (seed: number) => {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
};

test('emits a single step when from === to', () => {
  const steps = generateBezierPath({ x: 100, y: 100 }, { x: 100, y: 100 }, { random: seeded(1) });
  expect(steps).toHaveLength(1);
  expect(steps[0]).toEqual({ x: 100, y: 100, dt: expect.any(Number) });
});

test('horizontal path produces ≥12 intermediate points within duration bounds', () => {
  const steps = generateBezierPath({ x: 100, y: 100 }, { x: 500, y: 100 }, { random: seeded(42) });
  expect(steps.length).toBeGreaterThanOrEqual(12);
  const total = steps.reduce((acc, s) => acc + s.dt, 0);
  expect(total).toBeGreaterThanOrEqual(80);
  expect(total).toBeLessThanOrEqual(200);
});

test('horizontal path is not perfectly straight (curvature present)', () => {
  const steps = generateBezierPath({ x: 100, y: 100 }, { x: 500, y: 100 }, { random: seeded(7) });
  const offAxis = steps.filter(s => s.y !== 100);
  expect(offAxis.length).toBeGreaterThan(0);
});

test('100 runs over the same path produce non-zero X variance at the midpoint', () => {
  const xs: number[] = [];
  for (let i = 1; i <= 100; i++) {
    const steps = generateBezierPath({ x: 0, y: 0 }, { x: 400, y: 0 }, { random: seeded(i) });
    const mid = steps[Math.floor(steps.length / 2)];
    xs.push(mid.x);
  }
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / xs.length;
  expect(variance).toBeGreaterThan(0);
});

test('last step has dwell ≥20ms before downstream click', () => {
  const steps = generateBezierPath({ x: 0, y: 0 }, { x: 200, y: 200 }, { random: seeded(3) });
  expect(steps[steps.length - 1].dt).toBeGreaterThanOrEqual(20);
});

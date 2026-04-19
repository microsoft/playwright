/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface BezierStep {
  x: number;
  y: number;
  /** Milliseconds to dwell after moving to (x, y). */
  dt: number;
}

export interface BezierPathOptions {
  /** Min total path duration in ms. Default 80. */
  minDurationMs?: number;
  /** Max total path duration in ms. Default 200. */
  maxDurationMs?: number;
  /** Min number of intermediate samples. Default 12. */
  minSteps?: number;
  /** Max number of intermediate samples. Default 24. */
  maxSteps?: number;
  /** Deterministic seed for tests. Default Math.random. */
  random?: () => number;
}

export function generateBezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: BezierPathOptions = {},
): BezierStep[] {
  const random = opts.random ?? Math.random;
  const minDuration = opts.minDurationMs ?? 80;
  const maxDuration = opts.maxDurationMs ?? 200;
  const minSteps = opts.minSteps ?? 12;
  const maxSteps = opts.maxSteps ?? 24;

  if (from.x === to.x && from.y === to.y) {
    return [{ x: from.x, y: from.y, dt: 20 + Math.floor(random() * 40) }];
  }

  // Random control points in a perpendicular band ~15% of distance to add curvature.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const jitter = () => (random() - 0.5) * dist * 0.15;
  const c1 = { x: from.x + dx * 0.33 + perpX * jitter(), y: from.y + dy * 0.33 + perpY * jitter() };
  const c2 = { x: from.x + dx * 0.66 + perpX * jitter(), y: from.y + dy * 0.66 + perpY * jitter() };

  const stepCount = minSteps + Math.floor(random() * (maxSteps - minSteps + 1));
  const totalDuration = minDuration + Math.floor(random() * (maxDuration - minDuration + 1));
  const FINAL_DWELL_MIN = 20;
  const PER_STEP_MIN = 2;

  // Sample positions and unscaled per-step weights from an ease-in-out kernel
  // (larger near endpoints). We post-scale weights so the rounded+clamped total
  // lands inside [minDuration, maxDuration] regardless of the random seed.
  const positions: { x: number; y: number }[] = [];
  const weights: number[] = [];
  for (let i = 1; i <= stepCount; i++) {
    const t = i / stepCount;
    const omt = 1 - t;
    const x = omt ** 3 * from.x + 3 * omt ** 2 * t * c1.x + 3 * omt * t ** 2 * c2.x + t ** 3 * to.x;
    const y = omt ** 3 * from.y + 3 * omt ** 2 * t * c1.y + 3 * omt * t ** 2 * c2.y + t ** 3 * to.y;
    const easeWeight = 0.5 - 0.5 * Math.cos(Math.PI * t);
    positions.push({ x: Math.round(x), y: Math.round(y) });
    weights.push(0.7 + 0.6 * easeWeight);
  }

  // Pre-budget the guaranteed final dwell so the post-clamp total cannot exceed
  // totalDuration. Distribute the remainder across all steps proportional to
  // weights, with a per-step floor to keep deltas plausible.
  const interiorBudget = Math.max(stepCount * PER_STEP_MIN, totalDuration - FINAL_DWELL_MIN);
  const weightSum = weights.reduce((a, w) => a + w, 0);
  const rawDts = weights.map(w => (w / weightSum) * interiorBudget);

  // Largest-remainder rounding: round down, then distribute the leftover ms to
  // the steps with the largest fractional remainders. Guarantees the rounded
  // sum equals the integer interiorBudget exactly.
  const floors = rawDts.map(d => Math.floor(d));
  let remainder = Math.round(interiorBudget) - floors.reduce((a, d) => a + d, 0);
  const order = rawDts
      .map((d, i) => ({ i, frac: d - Math.floor(d) }))
      .sort((a, b) => b.frac - a.frac);
  const dts = floors.slice();
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--)
    dts[order[k].i] += 1;

  // Apply per-step floor (PER_STEP_MIN). If we have to raise any step, steal
  // the equivalent ms from the largest interior step to preserve the total.
  for (let i = 0; i < dts.length; i++) {
    if (dts[i] < PER_STEP_MIN) {
      let need = PER_STEP_MIN - dts[i];
      dts[i] = PER_STEP_MIN;
      while (need > 0) {
        let donor = -1;
        let donorVal = -Infinity;
        for (let j = 0; j < dts.length; j++) {
          if (j !== i && dts[j] > PER_STEP_MIN && dts[j] > donorVal) {
            donor = j;
            donorVal = dts[j];
          }
        }
        if (donor < 0) break;
        dts[donor] -= 1;
        need -= 1;
      }
    }
  }

  // Add the reserved final dwell back onto the last step.
  dts[dts.length - 1] += FINAL_DWELL_MIN;

  const steps: BezierStep[] = positions.map((p, i) => ({ x: p.x, y: p.y, dt: dts[i] }));
  return steps;
}

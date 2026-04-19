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
  _from: { x: number; y: number },
  _to: { x: number; y: number },
  _opts: BezierPathOptions = {},
): BezierStep[] {
  throw new Error('not implemented');
}

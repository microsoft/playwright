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

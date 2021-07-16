import { PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, PlaywrightTestArgs } from './test';
export * from './test';
export const test: TestType<{}, PlaywrightWorkerArgs & PlaywrightWorkerOptions & PlaywrightTestArgs & PlaywrightTestOptions>;
export default test;
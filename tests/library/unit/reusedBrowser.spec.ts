import { test as it, expect } from '@playwright/test';
import { ReusedBrowser } from '../../../packages/playwright-core/src/server/ReusedBrowser';

const createStub = (body?: () => void) => {
  const stub = function(...args: any[]) {
    stub.calls.push({ args });
    if (body) body();
  } as any;
  stub.calls = [];
  stub.called = false;
  return stub;
};

it.describe('ReusedBrowser', () => {
  it('should handle version mismatch error during inspect', async () => {
    const cleanup = () => {};
    const cleanupSpy = createStub(cleanup);

    const browser = new ReusedBrowser({
      wsEndpoint: 'ws://fake',
      cleanup: cleanupSpy,
      onClose: () => {}
    });

    // Stub version check to simulate mismatch
    browser._checkVersion = async () => {
      throw new Error('Version mismatch: expected v1.2.3, got v2.0.0');
    };

    try {
      await browser.inspect();
      throw new Error('Should not reach here');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Version mismatch');
      expect(cleanupSpy.calls.length).toBe(1);
    }
  });
}); 
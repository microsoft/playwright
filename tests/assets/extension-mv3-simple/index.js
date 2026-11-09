// Mock script for background extension
globalThis.initialTimezone = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  localDate: new Date('2030-01-01T23:00').toISOString(),
};
globalThis.MAGIC = 42;

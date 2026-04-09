/**
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 Made With MOXY Lda <hello@moxy.studio>
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import path from 'path';

// @ts-expect-error untyped vendored module
import gracefulFs from 'graceful-fs';
import retry from 'retry';
// @ts-expect-error untyped vendored module
import onExit from 'signal-exit';

type LockRecord = {
  lockfilePath: string;
  mtime: Date;
  mtimePrecision: 's' | 'ms';
  options: LockOptions;
  lastUpdate: number;
  updateDelay?: number | null;
  updateTimeout?: ReturnType<typeof setTimeout> | null;
  released?: boolean;
};

type LockOptions = {
  stale: number;
  update: number | null;
  realpath: boolean;
  retries: number | retry.OperationOptions;
  fs: any;
  lockfilePath?: string;
  onCompromised: (err: Error) => void;
};

type NodeCallback<T = void> = (err: Error | null, result?: T) => void;

const locks: Record<string, LockRecord> = {};
const cacheSymbol = Symbol();

function probe(file: string, fs: any, callback: (err: Error | null, mtime?: Date, precision?: 's' | 'ms') => void) {
  const cachedPrecision = fs[cacheSymbol];

  if (cachedPrecision) {
    return fs.stat(file, (err: any, stat: any) => {
      /* istanbul ignore if */
      if (err)
        return callback(err);

      callback(null, stat.mtime, cachedPrecision);
    });
  }

  // Set mtime by ceiling Date.now() to seconds + 5ms so that it's "not on the second"
  const mtime = new Date((Math.ceil(Date.now() / 1000) * 1000) + 5);

  fs.utimes(file, mtime, mtime, (err: any) => {
    /* istanbul ignore if */
    if (err)
      return callback(err);

    fs.stat(file, (err: any, stat: any) => {
      /* istanbul ignore if */
      if (err)
        return callback(err);

      const precision: 's' | 'ms' = stat.mtime.getTime() % 1000 === 0 ? 's' : 'ms';

      // Cache the precision in a non-enumerable way
      Object.defineProperty(fs, cacheSymbol, { value: precision });

      callback(null, stat.mtime, precision);
    });
  });
}

function getMtime(precision: 's' | 'ms'): Date {
  let now = Date.now();

  if (precision === 's')
    now = Math.ceil(now / 1000) * 1000;

  return new Date(now);
}

function getLockFile(file: string, options: LockOptions): string {
  return options.lockfilePath || `${file}.lock`;
}

function resolveCanonicalPath(file: string, options: LockOptions, callback: (err: Error | null, resolved?: string) => void) {
  if (!options.realpath)
    return callback(null, path.resolve(file));

  // Use realpath to resolve symlinks
  // It also resolves relative paths
  options.fs.realpath(file, callback);
}

function acquireLock(file: string, options: LockOptions, callback: (err: Error | null, mtime?: Date, mtimePrecision?: 's' | 'ms') => void) {
  const lockfilePath = getLockFile(file, options);

  // Use mkdir to create the lockfile (atomic operation)
  options.fs.mkdir(lockfilePath, (err: any) => {
    if (!err) {
      // At this point, we acquired the lock!
      // Probe the mtime precision
      return probe(lockfilePath, options.fs, (err, mtime, mtimePrecision) => {
        // If it failed, try to remove the lock..
        /* istanbul ignore if */
        if (err) {
          options.fs.rmdir(lockfilePath, () => {});
          return callback(err);
        }
        callback(null, mtime, mtimePrecision);
      });
    }

    // If error is not EEXIST then some other error occurred while locking
    if (err.code !== 'EEXIST')
      return callback(err);

    // Otherwise, check if lock is stale by analyzing the file mtime
    if (options.stale <= 0)
      return callback(Object.assign(new Error('Lock file is already being held'), { code: 'ELOCKED', file }));

    options.fs.stat(lockfilePath, (err: any, stat: any) => {
      if (err) {
        // Retry if the lockfile has been removed (meanwhile)
        // Skip stale check to avoid recursiveness
        if (err.code === 'ENOENT')
          return acquireLock(file, { ...options, stale: 0 }, callback);

        return callback(err);
      }

      if (!isLockStale(stat, options))
        return callback(Object.assign(new Error('Lock file is already being held'), { code: 'ELOCKED', file }));

      // If it's stale, remove it and try again!
      // Skip stale check to avoid recursiveness
      removeLock(file, options, err => {
        if (err)
          return callback(err);

        acquireLock(file, { ...options, stale: 0 }, callback);
      });
    });
  });
}

function isLockStale(stat: { mtime: Date }, options: LockOptions): boolean {
  return stat.mtime.getTime() < Date.now() - options.stale;
}

function removeLock(file: string, options: LockOptions, callback: NodeCallback) {
  // Remove lockfile, ignoring ENOENT errors
  options.fs.rmdir(getLockFile(file, options), (err: any) => {
    if (err && err.code !== 'ENOENT')
      return callback(err);

    callback(null);
  });
}

function updateLock(file: string, options: LockOptions) {
  const lock = locks[file];

  // Just for safety, should never happen
  /* istanbul ignore if */
  if (lock.updateTimeout)
    return;

  lock.updateDelay = lock.updateDelay || options.update!;
  lock.updateTimeout = setTimeout(() => {
    lock.updateTimeout = null;

    // Stat the file to check if mtime is still ours
    // If it is, we can still recover from a system sleep or a busy event loop
    options.fs.stat(lock.lockfilePath, (err: any, stat: any) => {
      const isOverThreshold = lock.lastUpdate + options.stale < Date.now();

      // If it failed to update the lockfile, keep trying unless
      // the lockfile was deleted or we are over the threshold
      if (err) {
        if (err.code === 'ENOENT' || isOverThreshold)
          return setLockAsCompromised(file, lock, Object.assign(err, { code: 'ECOMPROMISED' }));

        lock.updateDelay = 1000;
        return updateLock(file, options);
      }

      const isMtimeOurs = lock.mtime.getTime() === stat.mtime.getTime();

      if (!isMtimeOurs) {
        return setLockAsCompromised(
            file,
            lock,
            Object.assign(
                new Error('Unable to update lock within the stale threshold'),
                { code: 'ECOMPROMISED' }
            ));
      }

      const mtime = getMtime(lock.mtimePrecision);

      options.fs.utimes(lock.lockfilePath, mtime, mtime, (err: any) => {
        const isOverThreshold = lock.lastUpdate + options.stale < Date.now();

        // Ignore if the lock was released
        if (lock.released)
          return;

        // If it failed to update the lockfile, keep trying unless
        // the lockfile was deleted or we are over the threshold
        if (err) {
          if (err.code === 'ENOENT' || isOverThreshold)
            return setLockAsCompromised(file, lock, Object.assign(err, { code: 'ECOMPROMISED' }));

          lock.updateDelay = 1000;
          return updateLock(file, options);
        }

        // All ok, keep updating..
        lock.mtime = mtime;
        lock.lastUpdate = Date.now();
        lock.updateDelay = null;
        updateLock(file, options);
      });
    });
  }, lock.updateDelay);

  // Unref the timer so that the nodejs process can exit freely
  // This is safe because all acquired locks will be automatically released
  // on process exit

  // We first check that `lock.updateTimeout.unref` exists because some users
  // may be using this module outside of NodeJS (e.g., in an electron app),
  // and in those cases `setTimeout` return an integer.
  /* istanbul ignore else */
  if (lock.updateTimeout && (lock.updateTimeout as any).unref)
    (lock.updateTimeout as any).unref();
}

function setLockAsCompromised(file: string, lock: LockRecord, err: Error) {
  // Signal the lock has been released
  lock.released = true;

  // Cancel lock mtime update
  // Just for safety, at this point updateTimeout should be null
  /* istanbul ignore if */
  if (lock.updateTimeout)
    clearTimeout(lock.updateTimeout);

  if (locks[file] === lock)
    delete locks[file];

  lock.options.onCompromised(err);
}

// ----------------------------------------------------------

function lockImpl(
  file: string,
  options: Partial<LockOptions>,
  callback: (err: Error | null, release?: (cb?: NodeCallback) => void) => void,
) {
  /* istanbul ignore next */
  const resolvedOptions: LockOptions = {
    stale: 10000,
    update: null,
    realpath: true,
    retries: 0,
    fs: gracefulFs,
    onCompromised: (err: Error) => { throw err; },
    ...options,
  };

  resolvedOptions.retries = resolvedOptions.retries || 0;
  resolvedOptions.retries = typeof resolvedOptions.retries === 'number' ? { retries: resolvedOptions.retries } : resolvedOptions.retries;
  resolvedOptions.stale = Math.max(resolvedOptions.stale || 0, 2000);
  resolvedOptions.update = resolvedOptions.update === null || resolvedOptions.update === undefined ? resolvedOptions.stale / 2 : resolvedOptions.update || 0;
  resolvedOptions.update = Math.max(Math.min(resolvedOptions.update, resolvedOptions.stale / 2), 1000);

  // Resolve to a canonical file path
  resolveCanonicalPath(file, resolvedOptions, (err, resolvedFile) => {
    if (err)
      return callback(err);

    const canonicalFile = resolvedFile!;

    // Attempt to acquire the lock
    const operation = retry.operation(resolvedOptions.retries as retry.OperationOptions);

    operation.attempt(() => {
      acquireLock(canonicalFile, resolvedOptions, (err, mtime, mtimePrecision) => {
        if (operation.retry(err || undefined))
          return;

        if (err)
          return callback(operation.mainError());

        // We now own the lock
        const lock: LockRecord = locks[canonicalFile] = {
          lockfilePath: getLockFile(canonicalFile, resolvedOptions),
          mtime: mtime!,
          mtimePrecision: mtimePrecision!,
          options: resolvedOptions,
          lastUpdate: Date.now(),
        };

        // We must keep the lock fresh to avoid staleness
        updateLock(canonicalFile, resolvedOptions);

        callback(null, (releasedCallback?: NodeCallback) => {
          if (lock.released) {
            return releasedCallback &&
                releasedCallback(Object.assign(new Error('Lock is already released'), { code: 'ERELEASED' }));
          }

          // Not necessary to use realpath twice when unlocking
          unlock(canonicalFile, { ...resolvedOptions, realpath: false }, releasedCallback || (() => {}));
        });
      });
    });
  });
}

function unlock(file: string, options: Partial<LockOptions>, callback: NodeCallback) {
  const resolvedOptions: LockOptions = {
    stale: 10000,
    update: null,
    realpath: true,
    retries: 0,
    fs: gracefulFs,
    onCompromised: (err: Error) => { throw err; },
    ...options,
  };

  // Resolve to a canonical file path
  resolveCanonicalPath(file, resolvedOptions, (err, resolvedFile) => {
    if (err)
      return callback(err);

    const canonicalFile = resolvedFile!;

    // Skip if the lock is not acquired
    const lock = locks[canonicalFile];

    if (!lock)
      return callback(Object.assign(new Error('Lock is not acquired/owned by you'), { code: 'ENOTACQUIRED' }));

    if (lock.updateTimeout)
      clearTimeout(lock.updateTimeout); // Cancel lock mtime update
    lock.released = true; // Signal the lock has been released
    delete locks[canonicalFile]; // Delete from locks

    removeLock(canonicalFile, resolvedOptions, callback);
  });
}

function toPromise<T = void>(method: (...args: any[]) => void): (...args: any[]) => Promise<T> {
  return (...args: any[]) => new Promise<T>((resolve, reject) => {
    args.push((err: Error | null, result: T) => {
      if (err)
        reject(err);
      else
        resolve(result);
    });
    method(...args);
  });
}

// Remove acquired locks on exit
/* istanbul ignore next */
let cleanupInitialized = false;
function ensureCleanup() {
  if (cleanupInitialized)
    return;
  cleanupInitialized = true;
  onExit(() => {
    for (const file in locks) {
      const options = locks[file].options;

      try {
        options.fs.rmdirSync(getLockFile(file, options));
      } catch (e) { /* Empty */ }
    }
  });
}

export async function lock(file: string, options?: Partial<LockOptions>): Promise<() => Promise<void>> {
  ensureCleanup();
  const release = await toPromise<(cb?: NodeCallback) => void>(lockImpl)(file, options || {});
  return toPromise<void>(release);
}

# class: Clock
* since: v1.45

Playwright uses [@sinonjs/fake-timers](https://github.com/sinonjs/fake-timers) for clock emulation. Clock is installed for the entire [BrowserContext], so the time
in all the pages and iframes is controlled by the same clock.


## async method: Clock.install
* since: v1.45

Creates a clock and installs it globally.

### option: Clock.install.now
* since: v1.45
- `now` <[int]|[Date]>

Install fake timers with the specified unix epoch (default: 0).

### option: Clock.install.toFake
* since: v1.45
- `toFake` <[Array]<[FakeMethod]<"setTimeout"|"clearTimeout"|"setInterval"|"clearInterval"|"Date"|"requestAnimationFrame"|"cancelAnimationFrame"|"requestIdleCallback"|"cancelIdleCallback"|"performance">>>

An array with names of global methods and APIs to fake. For instance, `await page.clock.install({ toFake: ['setTimeout'] })` will fake only `setTimeout()`.
By default, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` and `Date` are faked.

### option: Clock.install.loopLimit
* since: v1.45
- `loopLimit` <[int]>

The maximum number of timers that will be run when calling  [`method: Clock.runAll`]. Defaults to `1000`.

### option: Clock.install.shouldAdvanceTime
* since: v1.45
- `shouldAdvanceTime` <[boolean]>

Tells `@sinonjs/fake-timers` to increment mocked time automatically based on the real system time shift (e.g., the mocked time will be incremented by
20ms for every 20ms change in the real system time). Defaults to `false`.

### option: Clock.install.advanceTimeDelta
* since: v1.45
- `advanceTimeDelta` <[int]>

Relevant only when using with [`option: shouldAdvanceTime`]. Increment mocked time by advanceTimeDelta ms every advanceTimeDelta ms change
in the real system time (default: 20).


## async method: Clock.next
* since: v1.45
- returns: <[int]> Fake milliseconds since the unix epoch.

Advances the clock to the the moment of the first scheduled timer, firing it.


## async method: Clock.jump
* since: v1.45

Advance the clock by jumping forward in time, firing callbacks at most once. Returns fake milliseconds since the unix epoch.
This can be used to simulate the JS engine (such as a browser) being put to sleep and resumed later, skipping intermediary timers.

### param: Clock.jump.time
* since: v1.45
- `time` <[int]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.

## async method: Clock.runAll
* since: v1.45
- returns: <[int]> Fake milliseconds since the unix epoch.

Runs all pending timers until there are none remaining. If new timers are added while it is executing they will be run as well.
This makes it easier to run asynchronous tests to completion without worrying about the number of timers they use, or the delays in those timers.
It runs a maximum of [`option: loopLimit`] times after which it assumes there is an infinite loop of timers and throws an error.


## async method: Clock.runToLast
* since: v1.45
- returns: <[int]> Fake milliseconds since the unix epoch.

This takes note of the last scheduled timer when it is run, and advances the clock to that time firing callbacks as necessary.
If new timers are added while it is executing they will be run only if they would occur before this time.
This is useful when you want to run a test to completion, but the test recursively sets timers that would cause runAll to trigger an infinite loop warning.


## async method: Clock.tick
* since: v1.45
- returns: <[int]> Fake milliseconds since the unix epoch.

Advance the clock, firing callbacks if necessary. Returns fake milliseconds since the unix epoch.

### param: Clock.tick.time
* since: v1.45
- `time` <[int]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.

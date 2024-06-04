# class: Clock
* since: v1.45

Accurately simulating time-dependent behavior is essential for verifying the correctness of applications. Learn more about [clock emulation](../clock.md).

Note that clock is installed for the entire [BrowserContext], so the time
in all the pages and iframes is controlled by the same clock.

## async method: Clock.installFakeTimers
* since: v1.45

Install fake implementations for the following time-related functions:

* `setTimeout`
* `clearTimeout`
* `setInterval`
* `clearInterval`
* `requestAnimationFrame`
* `cancelAnimationFrame`
* `requestIdleCallback`
* `cancelIdleCallback`
* `performance`

Fake timers are used to manually control the flow of time in tests. They allow you to advance time, fire timers, and control the behavior of time-dependent functions. See [`method: Clock.runFor`] and [`method: Clock.skipTime`] for more information.

### param: Clock.installFakeTimers.time
* since: v1.45
- `time` <[int]|[Date]>

Install fake timers with the specified base time.

### option: Clock.installFakeTimers.loopLimit
* since: v1.45
- `loopLimit` <[int]>

The maximum number of timers that will be run in [`method: Clock.runAllTimers`]. Defaults to `1000`.

## async method: Clock.runAllTimers
* since: v1.45
- returns: <[int]>

Runs all pending timers until there are none remaining. If new timers are added while it is executing they will be run as well.
Fake timers must be installed.
Returns fake milliseconds since the unix epoch.

**Details**

This makes it easier to run asynchronous tests to completion without worrying about the number of timers they use, or the delays in those timers.
It runs a maximum of [`option: loopLimit`] times after which it assumes there is an infinite loop of timers and throws an error.


## async method: Clock.runFor
* since: v1.45
- returns: <[int]>

Advance the clock, firing callbacks if necessary. Returns fake milliseconds since the unix epoch.
Fake timers must be installed.
Returns fake milliseconds since the unix epoch.

**Usage**

```js
await page.clock.runFor(1000);
await page.clock.runFor('30:00');
```

```python async
await page.clock.run_for(1000);
await page.clock.run_for('30:00')
```

```python sync
page.clock.run_for(1000);
page.clock.run_for('30:00')
```

```java
page.clock().runFor(1000);
page.clock().runFor("30:00");
```

```csharp
await page.Clock.RunForAsync(1000);
await page.Clock.RunForAsync("30:00");
```

### param: Clock.runFor.time
* since: v1.45
- `time` <[int]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.


## async method: Clock.runToLastTimer
* since: v1.45
- returns: <[int]>

This takes note of the last scheduled timer when it is run, and advances the clock to that time firing callbacks as necessary.
If new timers are added while it is executing they will be run only if they would occur before this time.
This is useful when you want to run a test to completion, but the test recursively sets timers that would cause runAll to trigger an infinite loop warning.
Fake timers must be installed.
Returns fake milliseconds since the unix epoch.


## async method: Clock.runToNextTimer
* since: v1.45
- returns: <[int]>

Advances the clock to the moment of the first scheduled timer, firing it.
Fake timers must be installed.
Returns fake milliseconds since the unix epoch.


## async method: Clock.setTime
* since: v1.45

Set the clock to the specified time.

When fake timers are installed, only fires timers at most once. This can be used to simulate the JS engine (such as a browser)
being put to sleep and resumed later, skipping intermediary timers.

### param: Clock.setTime.time
* since: v1.45
- `time` <[int]|[Date]>


## async method: Clock.skipTime
* since: v1.45
- returns: <[int]>

Advance the clock by jumping forward in time, equivalent to running [`method: Clock.setTime`] with the new target time.

When fake timers are installed, [`method: Clock.skipTime`] only fires due timers at most once, while [`method: Clock.runFor`] fires all the timers up to the current time.
Returns fake milliseconds since the unix epoch.

**Usage**

```js
await page.clock.skipTime(1000);
await page.clock.skipTime('30:00');
```

```python async
await page.clock.skipTime(1000);
await page.clock.skipTime('30:00')
```

```python sync
page.clock.skipTime(1000);
page.clock.skipTime('30:00')
```

```java
page.clock().skipTime(1000);
page.clock().skipTime("30:00");
```

```csharp
await page.Clock.SkipTimeAsync(1000);
await page.Clock.SkipTimeAsync("30:00");
```

### param: Clock.skipTime.time
* since: v1.45
- `time` <[int]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.

# class: Clock
* since: v1.45

Accurately simulating time-dependent behavior is essential for verifying the correctness of applications. Learn more about [clock emulation](../clock.md).

Note that clock is installed for the entire [BrowserContext], so the time
in all the pages and iframes is controlled by the same clock.

## async method: Clock.install
* since: v1.45

Creates a clock and installs it globally.

**Usage**

```js
await page.clock.install();
await page.clock.install({ now });
await page.clock.install({ now, toFake: ['Date'] });
```

```python async
await page.clock.install()
await page.clock.install(now=now)
await page.clock.install(now=now, toFake=['Date'])
```

```python sync
page.clock.install()
page.clock.install(now=now)
page.clock.install(now=now, toFake=['Date'])
```

```java
page.clock().install();
page.clock().install(
    new Clock.InstallOptions()
        .setNow(now));
page.clock().install(
    new Clock.InstallOptions()
        .setNow(now)
        .setToFake(new String[]{"Date"}));
```

```csharp
await page.Clock.InstallAsync();
await page.Clock.InstallAsync(
    new ClockInstallOptions { Now = now });
await page.Clock.InstallAsync(
    new ClockInstallOptions
    {
        Now = now,
        ToFake = new[] { "Date" }
    });
```

### option: Clock.install.now
* since: v1.45
- `now` <[int]|[Date]>

Install fake timers with the specified unix epoch (default: 0).

### option: Clock.install.toFake
* since: v1.45
- `toFake` <[Array]<[FakeMethod]<"setTimeout"|"clearTimeout"|"setInterval"|"clearInterval"|"Date"|"requestAnimationFrame"|"cancelAnimationFrame"|"requestIdleCallback"|"cancelIdleCallback"|"performance">>>

An array with names of global methods and APIs to fake. For instance, `await page.clock.install({ toFake: ['setTimeout'] })` will fake only `setTimeout()`.
By default, all the methods are faked.

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

**Usage**

```js
await page.clock.next();
```

```python async
await page.clock.next()
```

```python sync
page.clock.next()
```

```java
page.clock().next();
```

```csharp
await page.Clock.NextAsync();
```

## async method: Clock.jump
* since: v1.45

Advance the clock by jumping forward in time, firing callbacks at most once. Returns fake milliseconds since the unix epoch.
This can be used to simulate the JS engine (such as a browser) being put to sleep and resumed later, skipping intermediary timers.

**Usage**

```js
await page.clock.jump(1000);
await page.clock.jump('30:00');
```

```python async
await page.clock.jump(1000);
await page.clock.jump('30:00')
```

```python sync
page.clock.jump(1000);
page.clock.jump('30:00')
```

```java
page.clock().jump(1000);
page.clock().jump("30:00");
```

```csharp
await page.Clock.JumpAsync(1000);
await page.Clock.JumpAsync("30:00");
```

### param: Clock.jump.time
* since: v1.45
- `time` <[int]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.

## async method: Clock.runAll
* since: v1.45
- returns: <[int]> Fake milliseconds since the unix epoch.

Runs all pending timers until there are none remaining. If new timers are added while it is executing they will be run as well.

**Details**

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

**Usage**

```js
await page.clock.tick(1000);
await page.clock.tick('30:00');
```

```python async
await page.clock.tick(1000);
await page.clock.tick('30:00')
```

```python sync
page.clock.tick(1000);
page.clock.tick('30:00')
```

```java
page.clock().tick(1000);
page.clock().tick("30:00");
```

```csharp
await page.Clock.TickAsync(1000);
await page.Clock.TickAsync("30:00");
```

### param: Clock.tick.time
* since: v1.45
- `time` <[int]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.

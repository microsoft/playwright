# class: Clock
* since: v1.45

Accurately simulating time-dependent behavior is essential for verifying the correctness of applications. Learn more about [clock emulation](../clock.md).

Note that clock is installed for the entire [BrowserContext], so the time
in all the pages and iframes is controlled by the same clock.

## async method: Clock.fastForward
* since: v1.45

Advance the clock by jumping forward in time. Only fires due timers at most once. This is equivalent to user closing the laptop lid for a while and
reopening it later, after given time.

**Usage**

```js
await page.clock.fastForward(1000);
await page.clock.fastForward('30:00');
```

```python async
await page.clock.fast_forward(1000)
await page.clock.fast_forward("30:00")
```

```python sync
page.clock.fast_forward(1000)
page.clock.fast_forward("30:00")
```

```java
page.clock().fastForward(1000);
page.clock().fastForward("30:00");
```

```csharp
await page.Clock.FastForwardAsync(1000);
await page.Clock.FastForwardAsync("30:00");
```

### param: Clock.fastForward.ticks
* since: v1.45
- `ticks` <[long]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.

## async method: Clock.install
* since: v1.45

Install fake implementations for the following time-related functions:

* `Date`
* `setTimeout`
* `clearTimeout`
* `setInterval`
* `clearInterval`
* `requestAnimationFrame`
* `cancelAnimationFrame`
* `requestIdleCallback`
* `cancelIdleCallback`
* `performance`

Fake timers are used to manually control the flow of time in tests. They allow you to advance time, fire timers, and control the behavior of time-dependent functions. See [`method: Clock.runFor`] and [`method: Clock.fastForward`] for more information.

### option: Clock.install.time
* langs: js, java
* since: v1.45
- `time` <[long]|[string]|[Date]>

Time to initialize with, current system time by default.

### option: Clock.install.time
* langs: python
* since: v1.45
- `time` <[float]|[string]|[Date]>

Time to initialize with, current system time by default.

### option: Clock.install.time
* langs: csharp
* since: v1.45
- `time` <[string]|[Date]>

Time to initialize with, current system time by default.

## async method: Clock.runFor
* since: v1.45

Advance the clock, firing all the time-related callbacks.

**Usage**

```js
await page.clock.runFor(1000);
await page.clock.runFor('30:00');
```

```python async
await page.clock.run_for(1000);
await page.clock.run_for("30:00")
```

```python sync
page.clock.run_for(1000);
page.clock.run_for("30:00")
```

```java
page.clock().runFor(1000);
page.clock().runFor("30:00");
```

```csharp
await page.Clock.RunForAsync(1000);
await page.Clock.RunForAsync("30:00");
```

### param: Clock.runFor.ticks
* since: v1.45
- `ticks` <[long]|[string]>

Time may be the number of milliseconds to advance the clock by or a human-readable string. Valid string formats are "08" for eight seconds, "01:00" for one minute and "02:34:10" for two hours, 34 minutes and ten seconds.


## async method: Clock.pauseAt
* since: v1.45

Advance the clock by jumping forward in time and pause the time. Once this method is called, no timers
are fired unless [`method: Clock.runFor`], [`method: Clock.fastForward`], [`method: Clock.pauseAt`] or [`method: Clock.resume`] is called.

Only fires due timers at most once.
This is equivalent to user closing the laptop lid for a while and reopening it at the specified time and
pausing.

**Usage**

```js
await page.clock.pauseAt(new Date('2020-02-02'));
await page.clock.pauseAt('2020-02-02');
```

```python async
await page.clock.pause_at(datetime.datetime(2020, 2, 2))
await page.clock.pause_at("2020-02-02")
```

```python sync
page.clock.pause_at(datetime.datetime(2020, 2, 2))
page.clock.pause_at("2020-02-02")
```

```java
SimpleDateFormat format = new SimpleDateFormat("yyy-MM-dd");
page.clock().pauseAt(format.parse("2020-02-02"));
page.clock().pauseAt("2020-02-02");
```

```csharp
await page.Clock.PauseAtAsync(DateTime.Parse("2020-02-02"));
await page.Clock.PauseAtAsync("2020-02-02");
```

### param: Clock.pauseAt.time
* langs: js, java
* since: v1.45
- `time` <[long]|[string]|[Date]>

Time to pause at.

### param: Clock.pauseAt.time
* langs: python
* since: v1.45
- `time` <[float]|[string]|[Date]>

Time to pause at.

### param: Clock.pauseAt.time
* langs: csharp
* since: v1.45
- `time` <[Date]|[string]>

Time to pause at.

## async method: Clock.resume
* since: v1.45

Resumes timers. Once this method is called, time resumes flowing, timers are fired as usual.

## async method: Clock.setFixedTime
* since: v1.45

Makes `Date.now` and `new Date()` return fixed fake time at all times,
keeps all the timers running.

**Usage**

```js
await page.clock.setFixedTime(Date.now());
await page.clock.setFixedTime(new Date('2020-02-02'));
await page.clock.setFixedTime('2020-02-02');
```

```python async
await page.clock.set_fixed_time(datetime.datetime.now())
await page.clock.set_fixed_time(datetime.datetime(2020, 2, 2))
await page.clock.set_fixed_time("2020-02-02")
```

```python sync
page.clock.set_fixed_time(datetime.datetime.now())
page.clock.set_fixed_time(datetime.datetime(2020, 2, 2))
page.clock.set_fixed_time("2020-02-02")
```

```java
page.clock().setFixedTime(new Date());
page.clock().setFixedTime(new SimpleDateFormat("yyy-MM-dd").parse("2020-02-02"));
page.clock().setFixedTime("2020-02-02");
```

```csharp
await page.Clock.SetFixedTimeAsync(DateTime.Now);
await page.Clock.SetFixedTimeAsync(new DateTime(2020, 2, 2));
await page.Clock.SetFixedTimeAsync("2020-02-02");
```

### param: Clock.setFixedTime.time
* langs: js, java
* since: v1.45
- `time` <[long]|[string]|[Date]>

Time to be set in milliseconds.

### param: Clock.setFixedTime.time
* langs: python
* since: v1.45
- `time` <[float]|[string]|[Date]>

Time to be set.

### param: Clock.setFixedTime.time
* langs: csharp
* since: v1.45
- `time` <[string]|[Date]>

Time to be set.

## async method: Clock.setSystemTime
* since: v1.45

Sets current system time but does not trigger any timers.

**Usage**

```js
await page.clock.setSystemTime(Date.now());
await page.clock.setSystemTime(new Date('2020-02-02'));
await page.clock.setSystemTime('2020-02-02');
```

```python async
await page.clock.set_system_time(datetime.datetime.now())
await page.clock.set_system_time(datetime.datetime(2020, 2, 2))
await page.clock.set_system_time("2020-02-02")
```

```python sync
page.clock.set_system_time(datetime.datetime.now())
page.clock.set_system_time(datetime.datetime(2020, 2, 2))
page.clock.set_system_time("2020-02-02")
```

```java
page.clock().setSystemTime(new Date());
page.clock().setSystemTime(new SimpleDateFormat("yyy-MM-dd").parse("2020-02-02"));
page.clock().setSystemTime("2020-02-02");
```

```csharp
await page.Clock.SetSystemTimeAsync(DateTime.Now);
await page.Clock.SetSystemTimeAsync(new DateTime(2020, 2, 2));
await page.Clock.SetSystemTimeAsync("2020-02-02");
```

### param: Clock.setSystemTime.time
* langs: js, java
* since: v1.45
- `time` <[long]|[string]|[Date]>

Time to be set in milliseconds.

### param: Clock.setSystemTime.time
* langs: python
* since: v1.45
- `time` <[float]|[string]|[Date]>

Time to be set.

### param: Clock.setSystemTime.time
* langs: csharp
* since: v1.45
- `time` <[string]|[Date]>

Time to be set.

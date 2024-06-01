---
id: clock
title: "Clock"
---

## Introduction

Accurately simulating time-dependent behavior is essential for verifying the correctness of applications. Utilizing [Clock] functionality allows developers to manipulate and control time within tests, enabling the precise validation of features such as rendering time, timeouts, scheduled tasks without the delays and variability of real-time execution.

[`property: Page.clock`] overrides native global classes and functions related to time allowing them to be manually controlled:
  - `Date`
  - `setTimeout`
  - `clearTimeout`
  - `setInterval`
  - `clearInterval`
  - `requestAnimationFrame`
  - `cancelAnimationFrame`
  - `requestIdleCallback`
  - `cancelIdleCallback`

By default, the clock starts at the unix epoch (timestamp of 0). You can override it using the `now` option.

```js
await page.clock.install();
await page.clock.install({ now: new Date('2020-02-02') });
```

## Freeze Date.now

Sometimes you only need to fake `Date.now` and no other time-related functions.
That way the time flows naturally, but `Date.now` returns a fixed value.

```html
<input type="datetime-local" id="my-time" data-testid="my-time">
<script>
  const renderTime = () => {
    const time = new Date();
    document.getElementById('my-time').value = time.toISOString().slice(0, 16);
    setTimeout(renderTime, 1000);
  };
  renderTime();
</script>
```

```js
// Initialize clock with a specific time, only fake Date.now.
await page.clock.install({
  now: new Date('2024-01-01T10:00:00Z'),
  toFake: ['Date'],
});
await page.goto('http://localhost:3333');
await expect(page.getByTestId('my-time')).toHaveValue('2024-01-01T10:00');
```

```python async
# Initialize clock with a specific time, only fake Date.now.
await page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
    toFake=['Date'],
)
await page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')
await expect(locator).to_have_value('2024-01-01T10:00')
```

```python sync
# Initialize clock with a specific time, only fake Date.now.
page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
    to_fake=['Date'],
)
page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')
expect(locator).to_have_value('2024-01-01T10:00')
```

```java
// Initialize clock with a specific time, only fake Date.now.
page.clock().install(
    new Clock.InstallOptions()
        .setNow(Instant.parse("2024-01-01T10:00:00Z"))
        .setToFake(new String[]{"Date"})
);
page.navigate("http://localhost:3333");
Locator locator = page.getByTestId("my-time");
assertThat(locator).hasValue("2024-01-01T10:00");
```

```csharp
// Initialize clock with a specific time, only fake Date.now.
await page.Clock.InstallAsync(
    new ClockInstallOptions
    {
        Now = new DateTime(2024, 1, 1, 10, 0, 0, DateTimeKind.Utc),
        ToFake = new[] { "Date" }
    });
await page.GotoAsync("http://localhost:3333");
var locator = page.GetByTestId("my-time");
await Expect(locator).ToHaveValueAsync("2024-01-01T10:00");
```

## Assert page at different points in time

More often you need to simulate the passage of time to test time-dependent behavior.
You can jump the clock forward in time to simulate the passage of time without waiting for real-time to pass.

```html
<input type="datetime-local" id="my-time" data-testid="my-time">
<script>
  const renderTime = () => {
    const time = new Date();
    document.getElementById('my-time').value = time.toISOString().slice(0, 16);
    setTimeout(renderTime, 1000);
  };
  renderTime();
</script>
```

```js
// Initialize clock with a specific time, take full control over time.
await page.clock.install({ now: new Date('2024-01-01T10:00:00Z') });
await page.goto('http://localhost:3333');
await expect(page.getByTestId('my-time')).toHaveValue('2024-01-01T10:00');

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
await page.clock.jump('30:00');
await expect(page.getByTestId('my-time')).toHaveValue('2024-01-01T10:30');
```

```python async
# Initialize clock with a specific time, take full control over time.
await page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
)
await page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')
await expect(locator).to_have_value('2024-01-01T10:00')

# Fast forward time 30 minutes without firing intermediate timers, as if the user
# closed and opened the lid of the laptop.
await page.clock.jump('30:00')
await expect(locator).to_have_value('2024-01-01T10:30')
```

```python sync
# Initialize clock with a specific time, take full control over time.
page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
)
page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')
expect(locator).to_have_value('2024-01-01T10:00')

# Fast forward time 30 minutes without firing intermediate timers, as if the user
# closed and opened the lid of the laptop.
page.clock.jump('30:00')
expect(locator).to_have_value('2024-01-01T10:30')
```

```java
// Initialize clock with a specific time, take full control over time.
page.clock().install(
    new Clock.InstallOptions()
        .setNow(Instant.parse("2024-01-01T10:00:00Z"))
);
page.navigate("http://localhost:3333");
Locator locator = page.getByTestId("my-time");
assertThat(locator).hasValue("2024-01-01T10:00");

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
page.clock().jump("30:00");
assertThat(locator).hasValue("2024-01-01T10:30");
```

```csharp
// Initialize clock with a specific time, take full control over time.
await page.Clock.InstallAsync(
    new ClockInstallOptions
    {
        Now = new DateTime(2024, 1, 1, 10, 0, 0, DateTimeKind.Utc),
    });
await page.GotoAsync("http://localhost:3333");
var locator = page.GetByTestId("my-time");
await Expect(locator).ToHaveValueAsync("2024-01-01T10:00");

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
await page.Clock.JumpAsync("30:00");
await Expect(locator).ToHaveValueAsync("2024-01-01T10:30");
```

## Tick through time manually

In some cases, you may want to tick through time manually, firing all timers in the process.
This can be useful when you want to simulate the passage of time in a controlled manner.

```html
<input type="datetime-local" id="my-time" data-testid="my-time">
<script>
  const renderTime = () => {
    const time = new Date();
    document.getElementById('my-time').value = time.toISOString().slice(0, 16);
    setTimeout(renderTime, 1000);
  };
  renderTime();
</script>
```

```js
// Initialize clock with a specific time, take full control over time.
await page.clock.install({ now: new Date('2024-01-01T10:00:00Z') });
await page.goto('http://localhost:3333');

// Tick through time manually, firing all timers in the process.
// In this case, time will be updated in the screen 2 times.
await page.clock.tick(2000);
```

```python async
# Initialize clock with a specific time, take full control over time.
await page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
)
await page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')

# Tick through time manually, firing all timers in the process.
# In this case, time will be updated in the screen 2 times.
await page.clock.tick(2000)
```

```python sync
# Initialize clock with a specific time, take full control over time.
page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
)
page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')

# Tick through time manually, firing all timers in the process.
# In this case, time will be updated in the screen 2 times.
page.clock.tick(2000)
```

```java
// Initialize clock with a specific time, take full control over time.
page.clock().install(
    new Clock.InstallOptions()
        .setNow(Instant.parse("2024-01-01T10:00:00Z"))
);
page.navigate("http://localhost:3333");
Locator locator = page.getByTestId("my-time");

// Tick through time manually, firing all timers in the process.
// In this case, time will be updated in the screen 2 times.
page.clock().tick(2000);
```

```csharp
// Initialize clock with a specific time, take full control over time.
await page.Clock.InstallAsync(
    new ClockInstallOptions
    {
        Now = new DateTime(2024, 1, 1, 10, 0, 0, DateTimeKind.Utc),
    });
await page.GotoAsync("http://localhost:3333");
var locator = page.GetByTestId("my-time");

// Tick through time manually, firing all timers in the process.
// In this case, time will be updated in the screen 2 times.
await page.Clock.TickAsync(2000);
```

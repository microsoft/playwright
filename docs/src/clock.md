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
await page.clock.setTime(new Date('2020-02-02'));
await page.clock.installFakeTimers(new Date('2020-02-02'));
```

## Mock Date.now

Most of the time, you only need to fake `Date.now` and no other time-related functions.
That way the time flows naturally, but `Date.now` returns a fixed value.

```html
<div id="current-time" data-testid="current-time"></div>
<script>
  const renderTime = () => {
    document.getElementById('current-time').textContent =
        new Date() = time.toLocalTimeString();
  };
  setInterval(renderTime, 1000);
</script>
```

```js
await page.clock.setTime(new Date('2024-02-02T10:00:00'));
await page.goto('http://localhost:3333');
await expect(page.getByTestId('current-time')).toHaveText('2/2/2024, 10:00:00 AM');

await page.clock.setTime(new Date('2024-02-02T10:30:00'));
await expect(page.getByTestId('current-time')).toHaveText('2/2/2024, 10:30:00 AM');
```

```python async
page.clock.set_time(datetime.datetime(2024, 2, 2, 10, 0, 0, tzinfo=datetime.timezone.pst))
await page.goto('http://localhost:3333')
locator = page.get_by_test_id('current-time')
await expect(locator).to_have_text('2/2/2024, 10:00:00 AM')

page.clock.set_time(datetime.datetime(2024, 2, 2, 10, 30, 0, tzinfo=datetime.timezone.pst))
await expect(locator).to_have_text('2/2/2024, 10:30:00 AM')
```

```python sync
page.clock.set_time(datetime.datetime(2024, 2, 2, 10, 0, 0, tzinfo=datetime.timezone.pst))
page.goto('http://localhost:3333')
locator = page.get_by_test_id('current-time')
expect(locator).to_have_text('2/2/2024, 10:00:00 AM')

page.clock.set_time(datetime.datetime(2024, 2, 2, 10, 30, 0, tzinfo=datetime.timezone.pst))
expect(locator).to_have_text('2/2/2024, 10:30:00 AM')
```

```java
page.clock().setTime(Instant.parse("2024-02-02T10:00:00"));
page.navigate("http://localhost:3333");
Locator locator = page.getByTestId("current-time");
assertThat(locator).hasText("2/2/2024, 10:00:00 AM");

page.clock().setTime(Instant.parse("2024-02-02T10:30:00"));
assertThat(locator).hasText("2/2/2024, 10:30:00 AM");
```

```csharp
// Initialize clock with a specific time, only fake Date.now.
await page.Clock.SetTimeAsync(new DateTime(2024, 2, 2, 10, 0, 0, DateTimeKind.Pst));
await page.GotoAsync("http://localhost:3333");
var locator = page.GetByTestId("current-time");
await Expect(locator).ToHaveTextAsync("2/2/2024, 10:00:00 AM");

await page.Clock.SetTimeAsync(new DateTime(2024, 2, 2, 10, 30, 0, DateTimeKind.Pst));
await Expect(locator).ToHaveTextAsync("2/2/2024, 10:30:00 AM");
```

## Mock Date.now consistent with the timers

Sometimes your timers depend on `Date.now` and are confused when the time stands still.
In cases like this you need to ensure that `Date.now` and timers are consistent.
You can achieve this by installing the fake timers.

```html
<div id="current-time" data-testid="current-time"></div>
<script>
  const renderTime = () => {
    document.getElementById('current-time').textContent =
        new Date() = time.toLocalTimeString();
  };
  setInterval(renderTime, 1000);
</script>
```

```js
// Initialize clock with a specific time, take full control over time.
await page.clock.installFakeTimers(new Date('2024-02-02T10:00:00'));
await page.goto('http://localhost:3333');
await expect(page.getByTestId('current-time')).toHaveText('2/2/2024, 10:00:00 AM');

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
await page.clock.skipTime('30:00');
await expect(page.getByTestId('current-time')).toHaveText('2/2/2024, 10:30:00 AM');
```

```python async
# Initialize clock with a specific time, take full control over time.
await page.clock.install_fake_timers(
    datetime.datetime(2024, 2, 2, 10, 0, 0, tzinfo=datetime.timezone.pst)
)
await page.goto('http://localhost:3333')
locator = page.get_by_test_id('current-time')
await expect(locator).to_have_text('2/2/2024, 10:00:00 AM')

# Fast forward time 30 minutes without firing intermediate timers, as if the user
# closed and opened the lid of the laptop.
await page.clock.skip_time('30:00')
await expect(locator).to_have_text('2/2/2024, 10:30:00 AM')
```

```python sync
# Initialize clock with a specific time, take full control over time.
page.clock.install_fake_timers(
    datetime.datetime(2024, 2, 2, 10, 0, 0, tzinfo=datetime.timezone.pst)
)
page.goto('http://localhost:3333')
locator = page.get_by_test_id('current-time')
expect(locator).to_have_text('2/2/2024, 10:00:00 AM')

# Fast forward time 30 minutes without firing intermediate timers, as if the user
# closed and opened the lid of the laptop.
page.clock.skip_time('30:00')
expect(locator).to_have_text('2/2/2024, 10:30:00 AM')
```

```java
// Initialize clock with a specific time, take full control over time.
page.clock().installFakeTimers(Instant.parse("2024-02-02T10:00:00"));
page.navigate("http://localhost:3333");
Locator locator = page.getByTestId("current-time");
assertThat(locator).hasText("2/2/2024, 10:00:00 AM")

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
page.clock().skipTime("30:00");
assertThat(locator).hasText("2/2/2024, 10:30:00 AM");
```

```csharp
// Initialize clock with a specific time, take full control over time.
await page.Clock.InstallFakeTimersAsync(
    new DateTime(2024, 2, 2, 10, 0, 0, DateTimeKind.Pst)
);
await page.GotoAsync("http://localhost:3333");
var locator = page.GetByTestId("current-time");
await Expect(locator).ToHaveTextAsync("2/2/2024, 10:00:00 AM");

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
await page.Clock.SkipTimeAsync("30:00");
await Expect(locator).ToHaveTextAsync("2/2/2024, 10:30:00 AM");
```

## Tick through time manually

In rare cases, you may want to tick through time manually, firing all timers and animation frames in the process to achieve a fine-grained
control over the passage of time.

```html
<div id="current-time" data-testid="current-time"></div>
<script>
  const renderTime = () => {
    document.getElementById('current-time').textContent =
        new Date() = time.toLocalTimeString();
  };
  setInterval(renderTime, 1000);
</script>
```

```js
// Initialize clock with a specific time, take full control over time.
await page.clock.installFakeTimers(new Date('2024-02-02T10:00:00'));
await page.goto('http://localhost:3333');

// Tick through time manually, firing all timers in the process.
// In this case, time will be updated in the screen 2 times.
await page.clock.runFor(2000);
await expect(locator).to_have_text('2/2/2024, 10:00:02 AM');
```

```python async
# Initialize clock with a specific time, take full control over time.
await page.clock.install_fake_timers(
    datetime.datetime(2024, 2, 2, 10, 0, 0, tzinfo=datetime.timezone.pst),
)
await page.goto('http://localhost:3333')
locator = page.get_by_test_id('current-time')

# Tick through time manually, firing all timers in the process.
# In this case, time will be updated in the screen 2 times.
await page.clock.run_for(2000)
await expect(locator).to_have_text('2/2/2024, 10:00:02 AM')
```

```python sync
# Initialize clock with a specific time, take full control over time.
page.clock.install_fake_timers(
    datetime.datetime(2024, 2, 2, 10, 0, 0, tzinfo=datetime.timezone.pst),
)
page.goto('http://localhost:3333')
locator = page.get_by_test_id('current-time')

# Tick through time manually, firing all timers in the process.
# In this case, time will be updated in the screen 2 times.
page.clock.run_for(2000)
expect(locator).to_have_text('2/2/2024, 10:00:02 AM')
```

```java
// Initialize clock with a specific time, take full control over time.
page.clock().installFakeTimers(Instant.parse("2024-02-02T10:00:00"));
page.navigate("http://localhost:3333");
Locator locator = page.getByTestId("current-time");

// Tick through time manually, firing all timers in the process.
// In this case, time will be updated in the screen 2 times.
page.clock().runFor(2000);
assertThat(locator).hasText("2/2/2024, 10:00:02 AM");
```

```csharp
// Initialize clock with a specific time, take full control over time.
await page.Clock.InstallFakeTimersAsync(
    new DateTime(2024, 2, 2, 10, 0, 0, DateTimeKind.Pst)
);
await page.GotoAsync("http://localhost:3333");
var locator = page.GetByTestId("current-time");

// Tick through time manually, firing all timers in the process.
// In this case, time will be updated in the screen 2 times.
await page.Clock.RunForAsync(2000);
await Expect(locator).ToHaveTextAsync("2/2/2024, 10:00:02 AM");
```

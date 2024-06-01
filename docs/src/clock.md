---
id: clock
title: "Clock"
---

## Introduction

[`property: Page.clock`] overrides native global functions related to time allowing them to be manually controlled:
  - `setTimeout`
  - `clearTimeout`
  - `setInterval`
  - `clearInterval`
  - `Date`
  - `requestAnimationFrame`
  - `cancelAnimationFrame`
  - `requestIdleCallback`

By default, the clock starts at the unix epoch (timestamp of 0), but you can override it using the `now` option.

```js
await page.clock.install();
await page.clock.install({ now: new Date('2020-02-02') });
```

## Only fake Date.now

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
// Initialize clock with a specific time.
await page.clock.install({
  now: new Date('2024-01-01T10:00:00Z'),
  toFake: ['Date'],
});
await page.goto('http://localhost:3333');
await expect(page.getByTestId('my-time')).toHaveValue('2024-01-01T10:00');
```

```python async
# Initialize clock with a specific time.
await page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
    toFake=['Date'],
)
await page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')
await expect(locator).to_have_value('2024-01-01T10:00')
```

```python sync
# Initialize clock with a specific time.
page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
    to_fake=['Date'],
)
page.goto('http://localhost:3333')
locator = page.get_by_test_id('my-time')
expect(locator).to_have_value('2024-01-01T10:00')
```

```java
// Initialize clock with a specific time.
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
// Initialize clock with a specific time.
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
// Initialize clock with a specific time.
await page.clock.install({ now: new Date('2024-01-01T10:00:00Z') });
await page.goto('http://localhost:3333');
await expect(page.getByTestId('my-time')).toHaveValue('2024-01-01T10:00');

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
await page.clock.jump('30:00');
await expect(page.getByTestId('my-time')).toHaveValue('2024-01-01T10:30');
```

```python async
# Initialize clock with a specific time.
await page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
    toFake=['Date'],
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
# Initialize clock with a specific time.
page.clock.install(
    now=datetime.datetime(2024, 1, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
    to_fake=['Date'],
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
// Initialize clock with a specific time.
page.clock().install(
    new Clock.InstallOptions()
        .setNow(Instant.parse("2024-01-01T10:00:00Z"))
        .setToFake(new String[]{"Date"})
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
// Initialize clock with a specific time.
await page.Clock.InstallAsync(
    new ClockInstallOptions
    {
        Now = new DateTime(2024, 1, 1, 10, 0, 0, DateTimeKind.Utc),
        ToFake = new[] { "Date" }
    });
await page.GotoAsync("http://localhost:3333");
var locator = page.GetByTestId("my-time");
await Expect(locator).ToHaveValueAsync("2024-01-01T10:00");

// Fast forward time 30 minutes without firing intermediate timers, as if the user
// closed and opened the lid of the laptop.
await page.Clock.JumpAsync("30:00");
await Expect(locator).ToHaveValueAsync("2024-01-01T10:30");
```

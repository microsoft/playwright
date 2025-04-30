---
id: touch-events
title: "Touch events (legacy)"
---

## Introduction

Web applications that handle legacy [touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events) to respond to gestures like swipe, pinch, and tap can be tested by manually dispatching [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)s to the page. The examples below demonstrate how to use [`method: Locator.dispatchEvent`] and pass [Touch](https://developer.mozilla.org/en-US/docs/Web/API/Touch) points as arguments.

Note that [`method: Locator.dispatchEvent`] does not set [`Event.isTrusted`](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted) property. If your web page relies on it, make sure to disable `isTrusted` check during the test.

### Emulating pan gesture

In the example below, we emulate pan gesture that is expected to move the map. The app under test only uses `clientX/clientY` coordinates of the touch point, so we initialize just that. In a more complex scenario you may need to also set `pageX/pageY/screenX/screenY`, if your app needs them.

```js
import { test, expect, devices, type Locator } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

async function pan(locator: Locator, deltaX?: number, deltaY?: number, steps?: number) {
  const { centerX, centerY } = await locator.evaluate((target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    return { centerX, centerY };
  });

  // Providing only clientX and clientY as the app only cares about those.
  const touches = [{
    identifier: 0,
    clientX: centerX,
    clientY: centerY,
  }];
  await locator.dispatchEvent('touchstart',
      { touches, changedTouches: touches, targetTouches: touches });

  steps = steps ?? 5;
  deltaX = deltaX ?? 0;
  deltaY = deltaY ?? 0;
  for (let i = 1; i <= steps; i++) {
    const touches = [{
      identifier: 0,
      clientX: centerX + deltaX * i / steps,
      clientY: centerY + deltaY * i / steps,
    }];
    await locator.dispatchEvent('touchmove',
        { touches, changedTouches: touches, targetTouches: touches });
  }

  await locator.dispatchEvent('touchend');
}

test(`pan gesture to move the map`, async ({ page }) => {
  await page.goto('https://www.google.com/maps/place/@37.4117722,-122.0713234,15z',
      { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Keep using web' }).click();
  await expect(page.getByRole('button', { name: 'Keep using web' })).not.toBeVisible();
  // Get the map element.
  const met = page.locator('[data-test-id="met"]');
  for (let i = 0; i < 5; i++)
    await pan(met, 200, 100);
  // Ensure the map has been moved.
  await expect(met).toHaveScreenshot();
});
```

```csharp
using Microsoft.Playwright;
using System.Collections.Generic;
using System.Threading.Tasks;

public class TouchEvents
{
    public static async Task Main(string[] args)
    {
        using var playwright = await Playwright.CreateAsync();
        var browser = await playwright.Chromium.LaunchAsync();
        var context = await browser.NewContextAsync(playwright.Devices["Pixel 7"]);
        var page = await context.NewPageAsync();

        await page.GotoAsync(
            "https://www.google.com/maps/place/@37.4117722,-122.0713234,15z",
            new PageGotoOptions { WaitUntil = WaitUntilState.Commit }
        );
        await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Keep using web" }).ClickAsync();
        await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Keep using web" })
            .WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });

        var met = page.Locator("[data-test-id='met']");
        for (int i = 0; i < 5; i++)
        {
            await Pan(met, 200, 100);
        }
        await page.ScreenshotAsync(new PageScreenshotOptions { Path = "screenshot.png" });
    }

    public static async Task Pan(ILocator locator, int deltaX, int deltaY, int steps = 5)
    {
        var bounds = await locator.BoundingBoxAsync();
        double centerX = bounds.X + bounds.Width / 2;
        double centerY = bounds.Y + bounds.Height / 2;

        var touches = new List<Dictionary<string, object>>
        {
            new Dictionary<string, object>
            {
                { "identifier", 0 },
                { "clientX", centerX },
                { "clientY", centerY }
            }
        };
        await locator.DispatchEventAsync("touchstart", new { touches, changedTouches = touches, targetTouches = touches });

        for (int i = 1; i <= steps; i++)
        {
            touches = new List<Dictionary<string, object>>
            {
                new Dictionary<string, object>
                {
                    { "identifier", 0 },
                    { "clientX", centerX + deltaX * i / steps },
                    { "clientY", centerY + deltaY * i / steps }
                }
            };
            await locator.DispatchEventAsync("touchmove", new { touches, changedTouches = touches, targetTouches = touches });
        }

        await locator.DispatchEventAsync("touchend");
    }
}
```

```java
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.*;

public class TouchEvents {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.chromium().launch();
      BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setViewportSize(412, 839)
        .setDeviceScaleFactor(2.625)
        .setUserAgent("Mozilla/5.0 (Linux; Android 12; Pixel 7 Build/SP1A.210812.015) AppleWebKit/537.36" +
          " (KHTML, like Gecko) Chrome/94.0.4606.71 Mobile Safari/537.36")
        .setHasTouch(true)
        .setIsMobile(true)
      );
      Page page = context.newPage();

      page.navigate("https://www.google.com/maps/place/@37.4117722,-122.0713234,15z", new Page.NavigateOptions().setWaitUntil(WaitUntilState.COMMIT));
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Keep using web")).click();
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Keep using web")).waitFor(
        new Locator.WaitForOptions().setState(WaitForSelectorState.HIDDEN));

      Locator met = page.locator("[data-test-id='met']");
      for (int i = 0; i < 5; i++) {
        pan(met, 200, 100);
      }
      page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("screenshot.png")));
    }
  }

  public static void pan(Locator locator, int deltaX, int deltaY) {
    pan(locator, deltaX, deltaY, 5);
  }

  public static void pan(Locator locator, int deltaX, int deltaY, int steps) {
    BoundingBox bounds = locator.boundingBox();
    double centerX = bounds.x + bounds.width / 2;
    double centerY = bounds.y + bounds.height / 2;

    List<Map<String, Object>> touches = List.of(Map.of(
      "identifier", 0,
      "clientX", centerX,
      "clientY", centerY
    ));
    locator.dispatchEvent("touchstart", Map.of(
      "touches", touches,
      "changedTouches", touches,
      "targetTouches", touches
    ));

    for (int i = 1; i <= steps; i++) {
      touches = List.of(Map.of(
        "identifier", 0,
        "clientX", centerX + deltaX * i / steps,
        "clientY", centerY + deltaY * i / steps
      ));
      locator.dispatchEvent("touchmove", Map.of(
        "touches", touches,
        "changedTouches", touches,
        "targetTouches", touches
      ));
    }

    locator.dispatchEvent("touchend");
  }
}
```

```python sync
from playwright.sync_api import sync_playwright, expect

def pan(locator, deltaX=0, deltaY=0, steps=5):
    bounds = locator.bounding_box()
    centerX = bounds['x'] + bounds['width'] / 2
    centerY = bounds['y'] + bounds['height'] / 2

    touches = [{
        'identifier': 0,
        'clientX': centerX,
        'clientY': centerY,
    }]
    locator.dispatch_event('touchstart', {
        'touches': touches,
        'changedTouches': touches,
        'targetTouches': touches
    })

    for i in range(1, steps + 1):
        touches = [{
            'identifier': 0,
            'clientX': centerX + deltaX * i / steps,
            'clientY': centerY + deltaY * i / steps,
        }]
        locator.dispatch_event('touchmove', {
            'touches': touches,
            'changedTouches': touches,
            'targetTouches': touches
        })

    locator.dispatch_event('touchend')

def test_pan_gesture_to_move_the_map(page):
    page.goto('https://www.google.com/maps/place/@37.4117722,-122.0713234,15z', wait_until='commit')
    page.get_by_role('button', name='Keep using web').click()
    expect(page.get_by_role('button', name='Keep using web')).not_to_be_visible()
    met = page.locator('[data-test-id="met"]')
    for _ in range(5):
        pan(met, 200, 100)
    page.screenshot(path="screenshot.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(**p.devices['Pixel 7'])
    page = context.new_page()
    test_pan_gesture_to_move_the_map(page)
    browser.close()
```

```python async
from playwright.async_api import async_playwright, expect

async def pan(locator, deltaX=0, deltaY=0, steps=5):
    bounds = await locator.bounding_box()
    centerX = bounds['x'] + bounds['width'] / 2
    centerY = bounds['y'] + bounds['height'] / 2

    touches = [{
        'identifier': 0,
        'clientX': centerX,
        'clientY': centerY,
    }]
    await locator.dispatch_event('touchstart', {
        'touches': touches,
        'changedTouches': touches,
        'targetTouches': touches
    })

    for i in range(1, steps + 1):
        touches = [{
            'identifier': 0,
            'clientX': centerX + deltaX * i / steps,
            'clientY': centerY + deltaY * i / steps,
        }]
        await locator.dispatch_event('touchmove', {
            'touches': touches,
            'changedTouches': touches,
            'targetTouches': touches
        })

    await locator.dispatch_event('touchend')

async def test_pan_gesture_to_move_the_map(page):
    await page.goto('https://www.google.com/maps/place/@37.4117722,-122.0713234,15z', wait_until='commit')
    await page.get_by_role('button', name='Keep using web').click()
    await expect(page.get_by_role('button', name='Keep using web')).not_to_be_visible()
    met = page.locator('[data-test-id="met"]')
    for _ in range(5):
        await pan(met, 200, 100)
    await page.screenshot(path="screenshot.png")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(**p.devices['Pixel 7'])
        page = await context.new_page()
        await test_pan_gesture_to_move_the_map(page)
        await browser.close()

import asyncio
asyncio.run(main())
```


### Emulating pinch gesture

In the example below, we emulate pinch gesture, i.e. two touch points moving closer to each other. It is expected to zoom out the map. The app under test only uses `clientX/clientY` coordinates of touch points, so we initialize just that. In a more complex scenario you may need to also set `pageX/pageY/screenX/screenY`, if your app needs them.

```js
import { test, expect, devices, type Locator } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

async function pinch(locator: Locator,
  arg: { deltaX?: number, deltaY?: number, steps?: number, direction?: 'in' | 'out' }) {
  const { centerX, centerY } = await locator.evaluate((target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    return { centerX, centerY };
  });

  const deltaX = arg.deltaX ?? 50;
  const steps = arg.steps ?? 5;
  const stepDeltaX = deltaX / (steps + 1);

  // Two touch points equally distant from the center of the element.
  const touches = [
    {
      identifier: 0,
      clientX: centerX - (arg.direction === 'in' ? deltaX : stepDeltaX),
      clientY: centerY,
    },
    {
      identifier: 1,
      clientX: centerX + (arg.direction === 'in' ? deltaX : stepDeltaX),
      clientY: centerY,
    },
  ];
  await locator.dispatchEvent('touchstart',
      { touches, changedTouches: touches, targetTouches: touches });

  // Move the touch points towards or away from each other.
  for (let i = 1; i <= steps; i++) {
    const offset = (arg.direction === 'in' ? (deltaX - i * stepDeltaX) : (stepDeltaX * (i + 1)));
    const touches = [
      {
        identifier: 0,
        clientX: centerX - offset,
        clientY: centerY,
      },
      {
        identifier: 0,
        clientX: centerX + offset,
        clientY: centerY,
      },
    ];
    await locator.dispatchEvent('touchmove',
        { touches, changedTouches: touches, targetTouches: touches });
  }

  await locator.dispatchEvent('touchend', { touches: [], changedTouches: [], targetTouches: [] });
}

test(`pinch in gesture to zoom out the map`, async ({ page }) => {
  await page.goto('https://www.google.com/maps/place/@37.4117722,-122.0713234,15z',
      { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Keep using web' }).click();
  await expect(page.getByRole('button', { name: 'Keep using web' })).not.toBeVisible();
  // Get the map element.
  const met = page.locator('[data-test-id="met"]');
  for (let i = 0; i < 5; i++)
    await pinch(met, { deltaX: 40, direction: 'in' });
  // Ensure the map has been zoomed out.
  await expect(met).toHaveScreenshot();
});
```

```csharp
using Microsoft.Playwright;
using System.Collections.Generic;
using System.Threading.Tasks;

public class TouchEvents
{
    public static async Task Pinch(ILocator locator, int deltaX = 50, int steps = 5, string direction = "in")
    {
        var bounds = await locator.BoundingBoxAsync();
        double centerX = bounds.X + bounds.Width / 2;
        double centerY = bounds.Y + bounds.Height / 2;
        double stepDeltaX = deltaX / (steps + 1.0);

        var touches = new List<Dictionary<string, object>>
        {
            new Dictionary<string, object>
            {
                { "identifier", 0 },
                { "clientX", centerX - (direction == "in" ? deltaX : stepDeltaX) },
                { "clientY", centerY }
            },
            new Dictionary<string, object>
            {
                { "identifier", 1 },
                { "clientX", centerX + (direction == "in" ? deltaX : stepDeltaX) },
                { "clientY", centerY }
            }
        };
        await locator.DispatchEventAsync("touchstart", new { touches, changedTouches = touches, targetTouches = touches });

        for (int i = 1; i <= steps; i++)
        {
            double offset = direction == "in" ? (deltaX - i * stepDeltaX) : (stepDeltaX * (i + 1));
            touches = new List<Dictionary<string, object>>
            {
                new Dictionary<string, object>
                {
                    { "identifier", 0 },
                    { "clientX", centerX - offset },
                    { "clientY", centerY }
                },
                new Dictionary<string, object>
                {
                    { "identifier", 1 },
                    { "clientX", centerX + offset },
                    { "clientY", centerY }
                }
            };
            await locator.DispatchEventAsync("touchmove", new { touches, changedTouches = touches, targetTouches = touches });
        }

        await locator.DispatchEventAsync("touchend", new { touches = new List<object>(), changedTouches = new List<object>(), targetTouches = new List<object>() });
    }

    public static async Task TestPinchInGestureToZoomOutTheMap(IPage page)
    {
        await page.GotoAsync("https://www.google.com/maps/place/@37.4117722,-122.0713234,15z", new PageGotoOptions { WaitUntil = WaitUntilState.Commit });
        await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Keep using web" }).ClickAsync();
        await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Keep using web" }).WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });

        var met = page.Locator("[data-test-id='met']");
        for (int i = 0; i < 5; i++)
        {
            await Pinch(met, 40, 5, "in");
        }
        await page.ScreenshotAsync(new PageScreenshotOptions { Path = "screenshot.png" });
    }
}
```

```java
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.*;

public class TouchEvents {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.chromium().launch();
      BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setViewportSize(412, 839)
        .setDeviceScaleFactor(2.625)
        .setUserAgent("Mozilla/5.0 (Linux; Android 12; Pixel 7 Build/SP1A.210812.015) AppleWebKit/537.36" +
          " (KHTML, like Gecko) Chrome/94.0.4606.71 Mobile Safari/537.36")
        .setHasTouch(true)
        .setIsMobile(true)
      );
      Page page = context.newPage();

      page.navigate("https://www.google.com/maps/place/@37.4117722,-122.0713234,15z", new Page.NavigateOptions().setWaitUntil(WaitUntilState.COMMIT));
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Keep using web")).click();
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Keep using web")).waitFor(
        new Locator.WaitForOptions().setState(WaitForSelectorState.HIDDEN));

      Locator met = page.locator("[data-test-id='met']");
      for (int i = 0; i < 5; i++) {
        pinch(met, 40, "in");
      }
      page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("screenshot.png")));
    }
  }

  public static void pinch(Locator locator, int deltaX, String direction) {
    pinch(locator, deltaX, direction, 5);
  }

  public static void pinch(Locator locator, int deltaX, String direction, int steps) {
    BoundingBox bounds = locator.boundingBox();
    double centerX = bounds.x + bounds.width / 2;
    double centerY = bounds.y + bounds.height / 2;
    double stepDeltaX = deltaX / (steps + 1.0);

    List<Map<String, Object>> touches = List.of(
      Map.of("identifier", 0, "clientX", centerX - (direction.equals("in") ? deltaX : stepDeltaX), "clientY", centerY),
      Map.of("identifier", 1, "clientX", centerX + (direction.equals("in") ? deltaX : stepDeltaX), "clientY", centerY)
    );
    locator.dispatchEvent("touchstart", Map.of("touches", touches, "changedTouches", touches, "targetTouches", touches));

    for (int i = 1; i <= steps; i++) {
      double offset = direction.equals("in") ? (deltaX - i * stepDeltaX) : (stepDeltaX * (i + 1));
      touches = List.of(
        Map.of("identifier", 0, "clientX", centerX - offset, "clientY", centerY),
        Map.of("identifier", 1, "clientX", centerX + offset, "clientY", centerY)
      );
      locator.dispatchEvent("touchmove", Map.of("touches", touches, "changedTouches", touches, "targetTouches", touches));
    }

    locator.dispatchEvent("touchend", Map.of("touches", List.of(), "changedTouches", List.of(), "targetTouches", List.of()));
  }
}
```

```python async
from playwright.async_api import async_playwright, expect

async def pinch(locator, arg):
    bounds = await locator.bounding_box()
    centerX = bounds['x'] + bounds['width'] / 2
    centerY = bounds['y'] + bounds['height'] / 2

    deltaX = arg.get('deltaX', 50)
    steps = arg.get('steps', 5)
    stepDeltaX = deltaX / (steps + 1)

    touches = [
        {
            'identifier': 0,
            'clientX': centerX - (deltaX if arg.get('direction') == 'in' else stepDeltaX),
            'clientY': centerY,
        },
        {
            'identifier': 1,
            'clientX': centerX + (deltaX if arg.get('direction') == 'in' else stepDeltaX),
            'clientY': centerY,
        },
    ]
    await locator.dispatch_event('touchstart', {
        'touches': touches,
        'changedTouches': touches,
        'targetTouches': touches
    })

    for i in range(1, steps + 1):
        offset = deltaX - i * stepDeltaX if arg.get('direction') == 'in' else stepDeltaX * (i + 1)
        touches = [
            {
                'identifier': 0,
                'clientX': centerX - offset,
                'clientY': centerY,
            },
            {
                'identifier': 1,
                'clientX': centerX + offset,
                'clientY': centerY,
            },
        ]
        await locator.dispatch_event('touchmove', {
            'touches': touches,
            'changedTouches': touches,
            'targetTouches': touches
        })

    await locator.dispatch_event('touchend', {
        'touches': [],
        'changedTouches': [],
        'targetTouches': []
    })

async def test_pinch_in_gesture_to_zoom_out_the_map(page):
    await page.goto('https://www.google.com/maps/place/@37.4117722,-122.0713234,15z', wait_until='commit')
    await page.get_by_role('button', name='Keep using web').click()
    await expect(page.get_by_role('button', name='Keep using web')).not_to_be_visible()
    met = page.locator('[data-test-id="met"]')
    for _ in range(5):
        await pinch(met, {'deltaX': 40, 'direction': 'in'})
    await page.screenshot(path="screenshot.png")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(**p.devices['Pixel 7'])
        page = await context.new_page()
        await test_pinch_in_gesture_to_zoom_out_the_map(page)
        await browser.close()

import asyncio
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, expect

def pinch(locator, arg):
    bounds = locator.bounding_box()
    centerX = bounds['x'] + bounds['width'] / 2
    centerY = bounds['y'] + bounds['height'] / 2

    deltaX = arg.get('deltaX', 50)
    steps = arg.get('steps', 5)
    stepDeltaX = deltaX / (steps + 1)

    touches = [
        {
            'identifier': 0,
            'clientX': centerX - (deltaX if arg.get('direction') == 'in' else stepDeltaX),
            'clientY': centerY,
        },
        {
            'identifier': 1,
            'clientX': centerX + (deltaX if arg.get('direction') == 'in' else stepDeltaX),
            'clientY': centerY,
        },
    ]
    locator.dispatch_event('touchstart', {
        'touches': touches,
        'changedTouches': touches,
        'targetTouches': touches
    })

    for i in range(1, steps + 1):
        offset = deltaX - i * stepDeltaX if arg.get('direction') == 'in' else stepDeltaX * (i + 1)
        touches = [
            {
                'identifier': 0,
                'clientX': centerX - offset,
                'clientY': centerY,
            },
            {
                'identifier': 1,
                'clientX': centerX + offset,
                'clientY': centerY,
            },
        ]
        locator.dispatch_event('touchmove', {
            'touches': touches,
            'changedTouches': touches,
            'targetTouches': touches
        })

    locator.dispatch_event('touchend', {
        'touches': [],
        'changedTouches': [],
        'targetTouches': []
    })

def test_pinch_in_gesture_to_zoom_out_the_map(page):
    page.goto('https://www.google.com/maps/place/@37.4117722,-122.0713234,15z', wait_until='commit')
    page.get_by_role('button', name='Keep using web').click()
    expect(page.get_by_role('button', name='Keep using web')).not_to_be_visible()
    met = page.locator('[data-test-id="met"]')
    for _ in range(5):
        pinch(met, {'deltaX': 40, 'direction': 'in'})
    page.screenshot(path="screenshot.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(**p.devices['Pixel 7'])
    page = context.new_page()
    test_pinch_in_gesture_to_zoom_out_the_map(page)
    browser.close()
```

# class: CDPSession
* since: v1.8
* langs: js, python, csharp
* extends: [EventEmitter]

The `CDPSession` instances are used to talk raw Chrome Devtools Protocol:
* protocol methods can be called with `session.send` method.
* protocol events can be subscribed to with `session.on` method.

Useful links:
* Documentation on DevTools Protocol can be found here:
  [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/).
* Getting Started with DevTools Protocol:
  https://github.com/aslushnikov/getting-started-with-cdp/blob/master/README.md

```js
const client = await page.context().newCDPSession(page);
await client.send('Animation.enable');
client.on('Animation.animationCreated', () => console.log('Animation created!'));
const response = await client.send('Animation.getPlaybackRate');
console.log('playback rate is ' + response.playbackRate);
await client.send('Animation.setPlaybackRate', {
  playbackRate: response.playbackRate / 2
});
```

```python async
client = await page.context.new_cdp_session(page)
await client.send("Animation.enable")
client.on("Animation.animationCreated", lambda: print("animation created!"))
response = await client.send("Animation.getPlaybackRate")
print("playback rate is " + str(response["playbackRate"]))
await client.send("Animation.setPlaybackRate", {
    playbackRate: response["playbackRate"] / 2
})
```

```python sync
client = page.context.new_cdp_session(page)
client.send("Animation.enable")
client.on("Animation.animationCreated", lambda: print("animation created!"))
response = client.send("Animation.getPlaybackRate")
print("playback rate is " + str(response["playbackRate"]))
client.send("Animation.setPlaybackRate", {
    playbackRate: response["playbackRate"] / 2
})
```
```csharp
var client = await Page.Context.NewCDPSessionAsync(Page);
await client.SendAsync("Runtime.enable");
client.Event("Animation.animationCreated").OnEvent += (_, _) => Console.WriteLine("Animation created!");
var response = await client.SendAsync("Animation.getPlaybackRate");
var playbackRate = response.Value.GetProperty("playbackRate").GetDouble();
Console.WriteLine("playback rate is " + playbackRate);
await client.SendAsync("Animation.setPlaybackRate", new() { { "playbackRate", playbackRate / 2 } });
```

## async method: CDPSession.detach
* since: v1.8

Detaches the CDPSession from the target. Once detached, the CDPSession object won't emit any events and can't be used to
send messages.

## async method: CDPSession.send
* since: v1.8
* langs: js, python, csharp
- returns: <[Object]>

## async method: CDPSession.send
* since: v1.30
* langs: csharp
- returns: <[JsonElement?]>

### param: CDPSession.send.method
* since: v1.8
* langs: js, python, csharp
- `method` <[string]>

Protocol method name.

### param: CDPSession.send.params
* since: v1.8
* langs: js, python
- `params` ?<[Object]>

Optional method parameters.

### param: CDPSession.send.params
* since: v1.30
* langs: csharp
  - alias-csharp: args
- `params` ?<[Map<string, Object>]>

Optional method parameters.

## method: CDPSession.event
* since: v.1.30
* langs: csharp
- returns: <[CDPSessionEvent]>

Returns an event emitter for the given CDP event name.

### param: CDPSession.event.eventName
* since: v1.30
* langs: csharp
- `eventName` <[string]>

CDP event name.
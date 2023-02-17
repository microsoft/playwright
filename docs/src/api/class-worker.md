# class: Worker
* since: v1.8

The Worker class represents a [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API). `worker`
event is emitted on the page object to signal a worker creation. `close` event is emitted on the worker object when the
worker is gone.

```js
page.on('worker', worker => {
  console.log('Worker created: ' + worker.url());
  worker.on('close', worker => console.log('Worker destroyed: ' + worker.url()));
});

console.log('Current workers:');
for (const worker of page.workers())
  console.log('  ' + worker.url());
```

```java
page.onWorker(worker -> {
  System.out.println("Worker created: " + worker.url());
  worker.onClose(worker1 -> System.out.println("Worker destroyed: " + worker1.url()));
});
System.out.println("Current workers:");
for (Worker worker : page.workers())
  System.out.println("  " + worker.url());
```

```py
def handle_worker(worker):
    print("worker created: " + worker.url)
    worker.on("close", lambda: print("worker destroyed: " + worker.url))

page.on('worker', handle_worker)

print("current workers:")
for worker in page.workers:
    print("    " + worker.url)
```

```csharp
page.Worker += (_, worker) =>
{
    Console.WriteLine($"Worker created: {worker.Url}");
    worker.Close += (_, _) => Console.WriteLine($"Worker closed {worker.Url}");
};

Console.WriteLine("Current Workers:");
foreach(var pageWorker in page.Workers)
{
    Console.WriteLine($"\tWorker: {pageWorker.Url}");
}
```

## event: Worker.close
* since: v1.8
- argument: <[Worker]>

Emitted when this dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is terminated.

## async method: Worker.evaluate
* since: v1.8
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

If the function passed to the [`method: Worker.evaluate`] returns a [Promise], then [`method: Worker.evaluate`] would wait for the promise
to resolve and return its value.

If the function passed to the [`method: Worker.evaluate`] returns a non-[Serializable] value, then [`method: Worker.evaluate`] returns `undefined`. Playwright also supports transferring some
additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`.

### param: Worker.evaluate.expression = %%-evaluate-expression-%%
* since: v1.8

### param: Worker.evaluate.expression = %%-js-worker-evaluate-workerfunction-%%
* since: v1.8

### param: Worker.evaluate.arg
* since: v1.8
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: Worker.evaluateHandle
* since: v1.8
- returns: <[JSHandle]>

Returns the return value of [`param: expression`] as a [JSHandle].

The only difference between [`method: Worker.evaluate`] and
[`method: Worker.evaluateHandle`] is that [`method: Worker.evaluateHandle`]
returns [JSHandle].

If the function passed to the [`method: Worker.evaluateHandle`] returns a [Promise], then [`method: Worker.evaluateHandle`] would wait for
the promise to resolve and return its value.

### param: Worker.evaluateHandle.expression = %%-evaluate-expression-%%
* since: v1.8

### param: Worker.evaluateHandle.expression = %%-js-worker-evaluate-workerfunction-%%
* since: v1.8

### param: Worker.evaluateHandle.arg
* since: v1.8
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## method: Worker.url
* since: v1.8
- returns: <[string]>

## async method: Worker.waitForClose
* since: v1.10
* langs: java
- returns: <[Worker]>

Performs action and waits for the Worker to close.

### option: Worker.waitForClose.timeout = %%-wait-for-event-timeout-%%
* since: v1.9

### param: Worker.waitForClose.callback = %%-java-wait-for-event-callback-%%
* since: v1.9

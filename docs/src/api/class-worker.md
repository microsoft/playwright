# class: Worker

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

```py
def handle_worker(worker):
    print("worker created: " + worker.url)
    worker.on("close", lambda: print("worker destroyed: " + worker.url))

page.on('worker', handle_worker)

print("current workers:")
for worker in page.workers:
    print("    " + worker.url)
```

## event: Worker.close
- type: <[Worker]>

Emitted when this dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is terminated.

## async method: Worker.evaluate
- returns: <[Serializable]>

Returns the return value of [`param: expression`]

If the function passed to the `worker.evaluate` returns a [Promise], then `worker.evaluate` would wait for the promise
to resolve and return its value.

If the function passed to the `worker.evaluate` returns a non-[Serializable] value, then `worker.evaluate` returns
`undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`:
`-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

### param: Worker.evaluate.expression = %%-evaluate-expression-%%

### param: Worker.evaluate.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`]

## async method: Worker.evaluateHandle
- returns: <[JSHandle]>

Returns the return value of [`param: expression`] as in-page object (JSHandle).

The only difference between `worker.evaluate` and `worker.evaluateHandle` is that `worker.evaluateHandle` returns
in-page object (JSHandle).

If the function passed to the `worker.evaluateHandle` returns a [Promise], then `worker.evaluateHandle` would wait for
the promise to resolve and return its value.

### param: Worker.evaluateHandle.expression = %%-evaluate-expression-%%

### param: Worker.evaluateHandle.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`]

## method: Worker.url
- returns: <[string]>

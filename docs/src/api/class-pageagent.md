# class: PageAgent
* since: v1.58
* langs: js

## event: PageAgent.turn
* since: v1.58
- argument: <[Object]>
  - `role` <[string]>
  - `message` <[string]>
  - `usage` ?<[Object]>
    - `inputTokens` <[int]>
    - `outputTokens` <[int]>

Emitted when the agent makes a turn.

## async method: PageAgent.dispose
* since: v1.58

Dispose this agent.

## async method: PageAgent.expect
* since: v1.58

Expect certain condition to be met.

**Usage**

```js
await agent.expect('"0 items" to be reported');
```

### param: PageAgent.expect.expectation
* since: v1.58
- `expectation` <[string]>

Expectation to assert.

### option: PageAgent.expect.-inline- = %%-page-agent-call-options-v1.58-%%
* since: v1.58

## async method: PageAgent.extract
* since: v1.58
- returns: <[Object]>
  - `result` <[any]>
  - `usage` <[Object]>
    - `turns` <[int]>
    - `inputTokens` <[int]>
    - `outputTokens` <[int]>

Extract information from the page using the agentic loop, return it in a given Zod format.

**Usage**

```js
await agent.extract('List of items in the cart', z.object({
  title: z.string().describe('Item title to extract'),
  price: z.string().describe('Item price to extract'),
}).array());
```

### param: PageAgent.extract.query
* since: v1.58
- `query` <[string]>

Task to perform using agentic loop.

### param: PageAgent.extract.schema
* since: v1.58
- `schema` <[z.ZodSchema]>

### option: PageAgent.extract.-inline- = %%-page-agent-call-options-v1.58-%%
* since: v1.58


## async method: PageAgent.perform
* since: v1.58
- returns: <[Object]>
  - `usage` <[Object]>
    - `turns` <[int]>
    - `inputTokens` <[int]>
    - `outputTokens` <[int]>

Perform action using agentic loop.

**Usage**

```js
await agent.perform('Click submit button');
```

### param: PageAgent.perform.task
* since: v1.58
- `task` <[string]>

Task to perform using agentic loop.

### option: PageAgent.perform.-inline- = %%-page-agent-call-options-v1.58-%%
* since: v1.58

## async method: PageAgent.usage
* since: v1.58
- returns: <[Object]>
  - `turns` <[int]>
  - `inputTokens` <[int]>
  - `outputTokens` <[int]>

Returns the current token usage for this agent.

**Usage**

```js
const usage = await agent.usage();
console.log(`Tokens used: ${usage.inputTokens} in, ${usage.outputTokens} out`);
```

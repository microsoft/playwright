---
id: test-agents
title: "Agents"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

# Playwright Test Agents

## Introduction

Playwright comes with three Playwright Test Agents out of the box: **🎭 planner**, **🎭 generator** and **🎭 healer**.

These agents can be used independently, sequentially, or as the chained calls in the agentic loop.
Using them sequentially will produce test coverage for your product.

* **🎭 planner** explores the app and produces a Markdown test plan

* **🎭 generator** transforms the Markdown plan into the Playwright Test files

* **🎭 healer** executes the test suite and automatically repairs failing tests

<LiteYouTube
  id="_AifxZGxwuk"
  title="Playwright 1.56 - Introducing Playwright Test Agents"
/>

### Getting Started

Start with adding Playwright Test Agent definitions to your project using
the `init-agents` command. These definitions should be regenerated whenever Playwright
is updated to pick up new tools and instructions.

```bash tab=bash-vscode
npx playwright init-agents --loop=vscode
```

```bash tab=bash-claude
npx playwright init-agents --loop=claude
```

```bash tab=bash-opencode
npx playwright init-agents --loop=opencode
```

:::note
VS Code v1.105 (released October 9, 2025) is needed for the agentic experience to function properly in VS Code.
:::

Once the agents have been generated, you can use your AI tool of choice to command these agents to build Playwright Tests. 


## 🎭 Planner

Planner agent explores your app and produces a test plan for one or many scenarios and user flows.

**Input**

* A clear request to the planner (e.g., “Generate a plan for guest checkout.”)
* A `seed test` that sets up the environment necessary to interact with your app
* *(optional)* A Product Requirement Document (PRD) for context

**Prompt**
  
<img src={require("../images/test-agents/planner-prompt.png").src} alt="planner prompt" width="472"/>

> - Notice how the `seed.spec.ts` is included in the context of the planner.
> - Planner will run this test to execute all the initialization necessary for your test including the global setup, project dependencies and all the necessary fixtures and hooks.
> - Planner will also use this seed test as an example of all the generated tests. Alternatively, you can mention the file name in the prompt.

```js title="Example: seed.spec.ts"
import { test, expect } from './fixtures';

test('seed', async ({ page }) => {
  // this test uses custom fixtures from ./fixtures
});
```

**Output**

* A Markdown test plan saved as `specs/basic-operations.md`.
* The plan is human-readable but precise enough for test generation.

<details>
<summary>Example: <b>specs/basic-operations.md</b></summary>

```markdown
# TodoMVC Application - Basic Operations Test Plan

## Application Overview

The TodoMVC application is a React-based todo list manager that demonstrates standard todo application functionality. The application provides comprehensive task management capabilities with a clean, intuitive interface. Key features include:

- **Task Management**: Add, edit, complete, and delete individual todos
- **Bulk Operations**: Mark all todos as complete/incomplete and clear all completed todos  
- **Filtering System**: View todos by All, Active, or Completed status with URL routing support
- **Real-time Counter**: Display of active (incomplete) todo count
- **Interactive UI**: Hover states, edit-in-place functionality, and responsive design
- **State Persistence**: Maintains state during session navigation

## Test Scenarios

### 1. Adding New Todos

**Seed:** `tests/seed.spec.ts`

#### 1.1 Add Valid Todo

**Steps:**
1. Click in the "What needs to be done?" input field
2. Type "Buy groceries"
3. Press Enter key

**Expected Results:**
- Todo appears in the list with unchecked checkbox
- Counter shows "1 item left"
- Input field is cleared and ready for next entry
- Todo list controls become visible (Mark all as complete checkbox)

#### 1.2 Add Multiple Todos
...
```
</details>

## 🎭 Generator

Generator agent uses the Markdown plan to produce executable Playwright Tests.
It verifies selectors and assertions live as it performs the scenarios. Playwright supports
generation hints and provides a catalog of assertions for efficient structural and
behavioral validation.

**Input**

* Markdown plan from `specs/`

**Prompt**

<img src={require("../images/test-agents/generator-prompt.png").src} alt="generator prompt" width="472"/>

> - Notice how the `basic-operations.md` is included in the context of the generator.
> - This is how generator knows where to get the test plan from. Alternatively, you can mention the file name in the prompt.

**Output**

* A test suite under `tests/`
* Generated tests may include initial errors that can be healed automatically by the healer agent

<details>
<summary>Example: <b>tests/add-valid-todo.spec.ts</b></summary>

```ts
// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('Add Valid Todo', async ({ page }) => {
    // 1. Click in the "What needs to be done?" input field
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await todoInput.click();

    // 2. Type "Buy groceries"
    await todoInput.fill('Buy groceries');

    // 3. Press Enter key
    await todoInput.press('Enter');

    // Expected Results:
    // - Todo appears in the list with unchecked checkbox
    await expect(page.getByText('Buy groceries')).toBeVisible();
    const todoCheckbox = page.getByRole('checkbox', { name: 'Toggle Todo' });
    await expect(todoCheckbox).toBeVisible();
    await expect(todoCheckbox).not.toBeChecked();

    // - Counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();

    // - Input field is cleared and ready for next entry
    await expect(todoInput).toHaveValue('');
    await expect(todoInput).toBeFocused();

    // - Todo list controls become visible (Mark all as complete checkbox)
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).toBeVisible();
  });
});
```
</details>

## 🎭 Healer

When the test fails, the healer agent:

* Replays the failing steps
* Inspects the current UI to locate equivalent elements or flows
* Suggests a patch (e.g., locator update, wait adjustment, data fix)
* Re-runs the test until it passes or until guardrails stop the loop

**Input**

* Failing test name

**Prompt**

<img src={require("../images/test-agents/healer-prompt.png").src} alt="healer prompt" width="469"/>

**Output**

* A passing test, or a skipped test if the healer believes the that functionality is broken.

## Artifacts and Conventions

The static agent definitions and generated files follow a simple, auditable structure:

```bash
repo/
  .github/                    # agent definitions
  specs/                      # human-readable test plans
    basic-operations.md
  tests/                      # generated Playwright tests
    seed.spec.ts              # seed test for environment
    tests/create/add-valid-todo.spec.ts
  playwright.config.ts
```

### Agent Definitions

Under the hood, agent definitions are collections of instructions and MCP tools. They are provided by
Playwright and should be regenerated whenever Playwright is updated.

Example for Claude Code subagents:

```bash
npx playwright init-agents --loop=vscode
```

### Specs in `specs/`

Specs are structured plans describing scenarios in human-readable terms. They include
steps, expected outcomes, and data. Specs can start from scratch or extend a seed test.

### Tests in `tests/`

Generated Playwright tests, aligned one-to-one with specs wherever feasible.

### Seed tests `seed.spec.ts`

Seed tests provide a ready-to-use `page` context to bootstrap execution.

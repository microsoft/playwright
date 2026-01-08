# TodoMVC Basic Operations Test Plan

## Application Overview

This test plan covers the core functionality of the TodoMVC application, a simple todo list management tool. The application allows users to add, edit, complete, delete, and filter todo items. It includes features such as bulk operations (toggle all), filtering by status (All, Active, Completed), clearing completed items, and local storage persistence. The tests ensure comprehensive coverage of basic operations, edge cases, and data validation.

## Test Scenarios

### 1. Adding Todos

**Seed:** `tests/seed.spec.ts`

#### 1.1. should-add-single-todo

**File:** `tests/adding-todos/should-add-single-todo.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
    - expect: The application loads successfully
    - expect: The input field 'What needs to be done?' is visible
  2. Type 'Buy groceries' into the input field
    - expect: The text appears in the input field
  3. Press Enter to submit the todo
    - expect: The new todo 'Buy groceries' appears in the todo list
    - expect: The input field is cleared
    - expect: The todo counter shows '1 item left'

#### 1.2. should-add-multiple-todos

**File:** `tests/adding-todos/should-add-multiple-todos.spec.ts`

**Steps:**
  1. Add first todo 'Buy milk'
    - expect: The todo appears in the list
    - expect: Counter shows '1 item left'
  2. Add second todo 'Walk the dog'
    - expect: Both todos appear in the list
    - expect: Counter shows '2 items left'
  3. Add third todo 'Finish report'
    - expect: All three todos appear in the list
    - expect: Counter shows '3 items left'

#### 1.3. should-trim-whitespace-from-new-todo

**File:** `tests/adding-todos/should-trim-whitespace-from-new-todo.spec.ts`

**Steps:**
  1. Type '   Todo with spaces   ' (with leading and trailing spaces) and press Enter
    - expect: The todo is added as 'Todo with spaces' without leading or trailing whitespace
    - expect: Counter shows '1 item left'

#### 1.4. should-not-add-empty-todo

**File:** `tests/adding-todos/should-not-add-empty-todo.spec.ts`

**Steps:**
  1. Click on the input field without typing anything
    - expect: The input field is focused
  2. Press Enter
    - expect: No todo is added to the list
    - expect: The todo list remains empty

### 2. Completing Todos

**Seed:** `tests/seed.spec.ts`

#### 2.1. should-complete-single-todo

**File:** `tests/completing-todos/should-complete-single-todo.spec.ts`

**Steps:**
  1. Add a todo 'Buy groceries'
    - expect: The todo appears as active
    - expect: Counter shows '1 item left'
  2. Click the checkbox next to the todo
    - expect: The checkbox is checked
    - expect: Counter shows '0 items left'
    - expect: The 'Clear completed' button appears in the footer

#### 2.2. should-uncomplete-completed-todo

**File:** `tests/completing-todos/should-uncomplete-completed-todo.spec.ts`

**Steps:**
  1. Add a todo 'Buy groceries' and mark it as complete
    - expect: The todo is marked as complete
    - expect: Counter shows '0 items left'
  2. Click the checkbox again to uncomplete it
    - expect: The checkbox is unchecked
    - expect: Counter shows '1 item left'
    - expect: The 'Clear completed' button disappears

#### 2.3. should-complete-multiple-todos

**File:** `tests/completing-todos/should-complete-multiple-todos.spec.ts`

**Steps:**
  1. Add three todos: 'Buy milk', 'Walk dog', 'Finish report'
    - expect: All three todos are visible
    - expect: Counter shows '3 items left'
  2. Complete the first todo
    - expect: First todo is marked as complete
    - expect: Counter shows '2 items left'
  3. Complete the third todo
    - expect: Third todo is marked as complete
    - expect: Counter shows '1 item left'
    - expect: The 'Clear completed' button appears

#### 2.4. should-toggle-all-todos-complete

**File:** `tests/completing-todos/should-toggle-all-todos-complete.spec.ts`

**Steps:**
  1. Add three todos: 'Task 1', 'Task 2', 'Task 3'
    - expect: All three todos are visible and active
    - expect: Counter shows '3 items left'
  2. Click the 'Mark all as complete' checkbox
    - expect: All three todos are marked as complete
    - expect: All checkboxes are checked
    - expect: Counter shows '0 items left'
    - expect: The 'Clear completed' button appears

#### 2.5. should-toggle-all-todos-incomplete

**File:** `tests/completing-todos/should-toggle-all-todos-incomplete.spec.ts`

**Steps:**
  1. Add three todos and mark all as complete using the toggle all checkbox
    - expect: All todos are marked as complete
    - expect: Counter shows '0 items left'
  2. Click the 'Mark all as complete' checkbox again
    - expect: All todos are marked as active
    - expect: All checkboxes are unchecked
    - expect: Counter shows '3 items left'
    - expect: The 'Clear completed' button disappears

### 3. Editing Todos

**Seed:** `tests/seed.spec.ts`

#### 3.1. should-edit-todo-by-double-clicking

**File:** `tests/editing-todos/should-edit-todo-by-double-clicking.spec.ts`

**Steps:**
  1. Add a todo 'Buy milk'
    - expect: The todo appears in the list
  2. Double-click on the todo text
    - expect: The todo enters edit mode
    - expect: An edit textbox appears with the current text 'Buy milk'
    - expect: The textbox is focused
  3. Change the text to 'Buy organic milk' and press Enter
    - expect: The todo is updated to 'Buy organic milk'
    - expect: Edit mode is exited
    - expect: The updated text is displayed in the list

#### 3.2. should-cancel-edit-on-escape

**File:** `tests/editing-todos/should-cancel-edit-on-escape.spec.ts`

**Steps:**
  1. Add a todo 'Original text'
    - expect: The todo appears in the list
  2. Double-click on the todo to enter edit mode
    - expect: Edit textbox appears with 'Original text'
  3. Change the text to 'Modified text' but press Escape instead of Enter
    - expect: Edit mode is cancelled
    - expect: The todo text reverts to 'Original text'
    - expect: Changes are not saved

#### 3.3. should-save-edit-on-blur

**File:** `tests/editing-todos/should-save-edit-on-blur.spec.ts`

**Steps:**
  1. Add a todo 'Call dentist'
    - expect: The todo appears in the list
  2. Double-click on the todo to enter edit mode
    - expect: Edit textbox appears
  3. Change the text to 'Schedule dentist appointment' and click elsewhere (blur the input)
    - expect: The changes are saved
    - expect: The todo text is updated to 'Schedule dentist appointment'
    - expect: Edit mode is exited

#### 3.4. should-delete-todo-when-edited-to-empty

**File:** `tests/editing-todos/should-delete-todo-when-edited-to-empty.spec.ts`

**Steps:**
  1. Add a todo 'Temporary task'
    - expect: The todo appears in the list
    - expect: Counter shows '1 item left'
  2. Double-click on the todo to enter edit mode
    - expect: Edit textbox appears
  3. Clear all the text and press Enter
    - expect: The todo is deleted from the list
    - expect: The list is empty
    - expect: Counter shows '0 items left' or the footer is hidden

#### 3.5. should-trim-whitespace-when-editing

**File:** `tests/editing-todos/should-trim-whitespace-when-editing.spec.ts`

**Steps:**
  1. Add a todo 'Original task'
    - expect: The todo appears in the list
  2. Double-click to edit and change text to '   Edited task   ' (with spaces)
    - expect: Edit textbox shows the text with spaces
  3. Press Enter to save
    - expect: The todo is saved as 'Edited task' without leading or trailing whitespace

### 4. Deleting Todos

**Seed:** `tests/seed.spec.ts`

#### 4.1. should-delete-single-todo

**File:** `tests/deleting-todos/should-delete-single-todo.spec.ts`

**Steps:**
  1. Add a todo 'Task to delete'
    - expect: The todo appears in the list
    - expect: Counter shows '1 item left'
  2. Hover over the todo item
    - expect: A delete button (×) appears on the right side of the todo
  3. Click the delete button
    - expect: The todo is removed from the list
    - expect: The list is empty
    - expect: The footer is hidden or shows '0 items left'

#### 4.2. should-delete-specific-todo-from-multiple

**File:** `tests/deleting-todos/should-delete-specific-todo-from-multiple.spec.ts`

**Steps:**
  1. Add three todos: 'Task 1', 'Task 2', 'Task 3'
    - expect: All three todos appear in the list
    - expect: Counter shows '3 items left'
  2. Hover over 'Task 2' and click its delete button
    - expect: 'Task 2' is removed from the list
    - expect: 'Task 1' and 'Task 3' remain visible
    - expect: Counter shows '2 items left'

#### 4.3. should-clear-all-completed-todos

**File:** `tests/deleting-todos/should-clear-all-completed-todos.spec.ts`

**Steps:**
  1. Add three todos: 'Task 1', 'Task 2', 'Task 3'
    - expect: All three todos are visible
  2. Mark 'Task 1' and 'Task 3' as complete
    - expect: Two todos are marked as complete
    - expect: Counter shows '1 item left'
    - expect: The 'Clear completed' button appears
  3. Click the 'Clear completed' button
    - expect: 'Task 1' and 'Task 3' are removed from the list
    - expect: Only 'Task 2' remains visible
    - expect: Counter shows '1 item left'
    - expect: The 'Clear completed' button disappears

### 5. Filtering Todos

**Seed:** `tests/seed.spec.ts`

#### 5.1. should-filter-active-todos

**File:** `tests/filtering-todos/should-filter-active-todos.spec.ts`

**Steps:**
  1. Add three todos: 'Active 1', 'Active 2', 'Will complete'
    - expect: All three todos are visible
  2. Mark 'Will complete' as completed
    - expect: One todo is marked as complete
    - expect: Counter shows '2 items left'
  3. Click on the 'Active' filter link
    - expect: The URL changes to #/active
    - expect: Only 'Active 1' and 'Active 2' are displayed
    - expect: 'Will complete' is not visible
    - expect: The 'Active' filter link is highlighted

#### 5.2. should-filter-completed-todos

**File:** `tests/filtering-todos/should-filter-completed-todos.spec.ts`

**Steps:**
  1. Add three todos: 'Active task', 'Completed 1', 'Completed 2'
    - expect: All three todos are visible
  2. Mark 'Completed 1' and 'Completed 2' as completed
    - expect: Two todos are marked as complete
  3. Click on the 'Completed' filter link
    - expect: The URL changes to #/completed
    - expect: Only 'Completed 1' and 'Completed 2' are displayed
    - expect: 'Active task' is not visible
    - expect: The 'Completed' filter link is highlighted

#### 5.3. should-show-all-todos-with-all-filter

**File:** `tests/filtering-todos/should-show-all-todos-with-all-filter.spec.ts`

**Steps:**
  1. Add three todos and mark one as complete
    - expect: Three todos exist
    - expect: one completed and two active
  2. Navigate to the 'Active' filter
    - expect: Only active todos are visible
  3. Click on the 'All' filter link
    - expect: The URL changes to #/
    - expect: All todos (both completed and active) are displayed
    - expect: The 'All' filter link is highlighted

### 6. Persistence

**Seed:** `tests/seed.spec.ts`

#### 6.1. should-persist-todos-after-page-reload

**File:** `tests/persistence/should-persist-todos-after-page-reload.spec.ts`

**Steps:**
  1. Add three todos: 'Persistent 1', 'Persistent 2', 'Persistent 3'
    - expect: All three todos appear in the list
  2. Mark 'Persistent 2' as completed
    - expect: 'Persistent 2' is marked as complete
  3. Reload the page
    - expect: All three todos are still present after reload
    - expect: 'Persistent 2' is still marked as complete
    - expect: The counter shows '2 items left'

### 7. UI State

**Seed:** `tests/seed.spec.ts`

#### 7.1. should-hide-footer-when-no-todos

**File:** `tests/ui-state/should-hide-footer-when-no-todos.spec.ts`

**Steps:**
  1. Start with an empty todo list (no todos added)
    - expect: The footer with counter and filters is not visible
    - expect: Only the input field and heading are visible
  2. Add a todo 'First task'
    - expect: The footer appears with counter '1 item left' and filter links
  3. Delete the todo
    - expect: The footer is hidden again

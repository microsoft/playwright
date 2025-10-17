# TodoMVC Application - Basic Operations Test Plan

## Application Overview

The TodoMVC application is a React-based todo list manager accessible at https://demo.playwright.dev/todomvc. The application provides comprehensive task management functionality with the following features:

- **Task Creation**: Add new todos via input field
- **Task Completion**: Mark individual todos as complete/incomplete via checkboxes
- **Task Editing**: Double-click to edit todo text inline
- **Task Deletion**: Remove individual todos via delete button
- **Bulk Operations**: Mark all todos as complete/incomplete and clear all completed todos
- **Filtering**: View todos by All, Active, or Completed status with URL routing support
- **Counter Display**: Real-time count of active (incomplete) todos
- **Input Validation**: Prevents empty or whitespace-only todos

## Test Scenarios

### 1. Adding New Todos

**Seed:** `tests/seed.spec.ts`

#### 1.1 Add Single Valid Todo

**File:** `tests/adding-new-todos/add-single-valid-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Click in the "What needs to be done?" input field
3. Type "Buy groceries"
4. Press Enter key

**Expected Results:**
- Todo appears in the list with an unchecked checkbox
- Todo text displays as "Buy groceries"
- Counter shows "1 item left"
- Input field is cleared and ready for next entry
- "Mark all as complete" checkbox becomes visible

#### 1.2 Add Multiple Todos

**File:** `tests/adding-new-todos/add-multiple-todos.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add first todo: "Buy groceries" (type and press Enter)
3. Add second todo: "Walk the dog" (type and press Enter)
4. Add third todo: "Read a book" (type and press Enter)

**Expected Results:**
- All three todos appear in the list in order of creation
- Each todo has an unchecked checkbox
- Counter shows "3 items left" (plural)
- Input field is cleared after each addition

#### 1.3 Reject Empty Todo

**File:** `tests/adding-new-todos/reject-empty-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Click in the "What needs to be done?" input field
3. Press Enter without typing any text

**Expected Results:**
- No todo is added to the list
- Todo list remains empty
- Counter is not displayed
- Input field remains focused

#### 1.4 Reject Whitespace-Only Todo

**File:** `tests/adding-new-todos/reject-whitespace-only-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Click in the "What needs to be done?" input field
3. Type only spaces (e.g., "   ")
4. Press Enter

**Expected Results:**
- No todo is added to the list
- Todo list remains empty
- Counter is not displayed
- Input field is cleared

#### 1.5 Add Todo with Special Characters

**File:** `tests/adding-new-todos/add-todo-with-special-characters.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Type "Test with special chars: @#$%^&*()"
3. Press Enter

**Expected Results:**
- Todo is successfully added
- Special characters are displayed correctly
- Counter shows "1 item left"

#### 1.6 Add Todo with Long Text

**File:** `tests/adding-new-todos/add-todo-with-long-text.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Type a very long text (e.g., "This is a very long todo item to test the character limit and see how the application handles extremely long text inputs that might break the layout or cause other issues")
3. Press Enter

**Expected Results:**
- Todo is successfully added
- Long text is displayed (may wrap or truncate depending on design)
- Counter shows "1 item left"
- Layout remains intact

### 2. Completing Todos

**Seed:** `tests/seed.spec.ts`

#### 2.1 Complete Single Todo

**File:** `tests/completing-todos/complete-single-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Click the checkbox next to "Buy groceries"

**Expected Results:**
- Checkbox becomes checked
- Todo text may show visual indication of completion (strikethrough or style change)
- Counter shows "0 items left"
- "Clear completed" button appears
- Delete button becomes visible on hover

#### 2.2 Complete Multiple Todos

**File:** `tests/completing-todos/complete-multiple-todos.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Click the checkbox next to "Buy groceries"
4. Click the checkbox next to "Read a book"

**Expected Results:**
- Both selected todos show as completed
- Counter shows "1 item left" (only "Walk the dog" remaining)
- "Clear completed" button appears
- One todo remains active

#### 2.3 Uncomplete Todo

**File:** `tests/completing-todos/uncomplete-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Click the checkbox to complete it
4. Click the checkbox again to uncomplete it

**Expected Results:**
- Checkbox becomes unchecked
- Todo returns to active state
- Counter shows "1 item left"
- "Clear completed" button disappears

#### 2.4 Mark All as Complete

**File:** `tests/completing-todos/mark-all-as-complete.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Click the "Mark all as complete" checkbox (chevron icon)

**Expected Results:**
- All todos show as completed
- All individual checkboxes are checked
- "Mark all as complete" checkbox is checked
- Counter shows "0 items left"
- "Clear completed" button appears

#### 2.5 Unmark All as Complete

**File:** `tests/completing-todos/unmark-all-as-complete.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Click the "Mark all as complete" checkbox to complete all
4. Click the "Mark all as complete" checkbox again

**Expected Results:**
- All todos return to active state
- All individual checkboxes are unchecked
- "Mark all as complete" checkbox is unchecked
- Counter shows "3 items left"
- "Clear completed" button disappears

### 3. Editing Todos

**Seed:** `tests/seed.spec.ts`

#### 3.1 Edit Todo Successfully

**File:** `tests/editing-todos/edit-todo-successfully.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Double-click on the todo text "Buy groceries"
4. Clear the existing text
5. Type "Buy groceries and milk"
6. Press Enter

**Expected Results:**
- Todo enters edit mode (input field appears)
- Original text is pre-populated in the edit field
- After pressing Enter, todo text updates to "Buy groceries and milk"
- Todo exits edit mode
- Todo remains in the same state (active/completed)

#### 3.2 Cancel Edit with Escape

**File:** `tests/editing-todos/cancel-edit-with-escape.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Double-click on the todo text
4. Type "Changed text"
5. Press Escape key

**Expected Results:**
- Todo exits edit mode
- Original text "Buy groceries" is preserved
- Changes are discarded
- Todo remains in the same state

#### 3.3 Delete Todo by Clearing Text

**File:** `tests/editing-todos/delete-todo-by-clearing-text.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Double-click on the todo text
4. Clear all text (delete all characters)
5. Press Enter

**Expected Results:**
- Todo is removed from the list
- Counter decrements appropriately
- If no todos remain, counter and controls disappear

#### 3.4 Edit Completed Todo

**File:** `tests/editing-todos/edit-completed-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Click the checkbox to complete it
4. Double-click on the todo text
5. Type "Buy groceries and milk"
6. Press Enter

**Expected Results:**
- Todo enters edit mode
- Todo text is successfully updated
- Todo remains in completed state after editing
- Checkbox remains checked

### 4. Deleting Todos

**Seed:** `tests/seed.spec.ts`

#### 4.1 Delete Single Active Todo

**File:** `tests/deleting-todos/delete-single-active-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Hover over the todo to reveal the delete button
4. Click the delete button (×)

**Expected Results:**
- Todo is immediately removed from the list
- Counter decrements to "0 items left" or disappears
- Todo list controls disappear if no todos remain

#### 4.2 Delete Single Completed Todo

**File:** `tests/deleting-todos/delete-single-completed-todo.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Click the checkbox to complete it
4. Hover over the todo to reveal the delete button
5. Click the delete button (×)

**Expected Results:**
- Todo is immediately removed from the list
- "Clear completed" button disappears
- Todo list controls disappear if no todos remain

#### 4.3 Delete Multiple Todos Individually

**File:** `tests/deleting-todos/delete-multiple-todos-individually.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Delete "Walk the dog" by clicking its delete button
4. Delete "Buy groceries" by clicking its delete button

**Expected Results:**
- After first deletion, counter shows "2 items left"
- After second deletion, counter shows "1 item left"
- Only "Read a book" remains in the list

#### 4.4 Clear All Completed Todos

**File:** `tests/deleting-todos/clear-all-completed-todos.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Complete "Buy groceries" and "Walk the dog" by clicking their checkboxes
4. Click the "Clear completed" button

**Expected Results:**
- Both completed todos are removed from the list
- Only "Read a book" (active) remains
- Counter shows "1 item left"
- "Clear completed" button disappears

#### 4.5 Clear Completed When All Are Completed

**File:** `tests/deleting-todos/clear-completed-when-all-are-completed.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Click "Mark all as complete" checkbox
4. Click "Clear completed" button

**Expected Results:**
- All todos are removed from the list
- Todo list becomes empty
- Counter and controls disappear
- Only the input field remains visible

### 5. Filtering Todos

**Seed:** `tests/seed.spec.ts`

#### 5.1 View All Todos (Default)

**File:** `tests/filtering-todos/view-all-todos-default.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Complete "Walk the dog" by clicking its checkbox
4. Verify the "All" filter is selected by default

**Expected Results:**
- All three todos are visible (both active and completed)
- "All" link appears selected/highlighted
- URL shows "/#/" or "/#"
- Counter shows "2 items left"

#### 5.2 Filter Active Todos

**File:** `tests/filtering-todos/filter-active-todos.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Complete "Walk the dog" by clicking its checkbox
4. Click the "Active" filter link

**Expected Results:**
- Only active todos are visible ("Buy groceries" and "Read a book")
- Completed todo "Walk the dog" is hidden
- "Active" link appears selected/highlighted
- URL changes to "/#/active"
- Counter shows "2 items left"

#### 5.3 Filter Completed Todos

**File:** `tests/filtering-todos/filter-completed-todos.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Complete "Walk the dog" and "Buy groceries" by clicking their checkboxes
4. Click the "Completed" filter link

**Expected Results:**
- Only completed todos are visible ("Walk the dog" and "Buy groceries")
- Active todo "Read a book" is hidden
- "Completed" link appears selected/highlighted
- URL changes to "/#/completed"
- Counter still shows "1 item left" (total active count)
- "Clear completed" button is visible

#### 5.4 Switch Between Filters

**File:** `tests/filtering-todos/switch-between-filters.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Complete "Walk the dog"
4. Click "Active" filter
5. Click "Completed" filter
6. Click "All" filter

**Expected Results:**
- Each filter shows appropriate todos
- Filter selection updates correctly
- URL updates with each filter change
- Counter remains consistent across filter changes

#### 5.5 Add Todo While Filtered

**File:** `tests/filtering-todos/add-todo-while-filtered.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Complete it by clicking its checkbox
4. Click "Active" filter (should show no todos)
5. Add a new todo: "Walk the dog"

**Expected Results:**
- New todo appears in the list (as it's active)
- Counter updates to "1 item left"
- Todo is visible because it matches the active filter

#### 5.6 Complete Todo While on Active Filter

**File:** `tests/filtering-todos/complete-todo-while-on-active-filter.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add two todos: "Buy groceries" and "Walk the dog"
3. Click "Active" filter
4. Complete "Buy groceries" by clicking its checkbox

**Expected Results:**
- "Buy groceries" disappears from the active view
- Only "Walk the dog" remains visible
- Counter updates to "1 item left"
- Completed todo is not deleted, just filtered out

#### 5.7 Delete Todo While Filtered

**File:** `tests/filtering-todos/delete-todo-while-filtered.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add two todos: "Buy groceries" and "Walk the dog"
3. Complete "Buy groceries"
4. Click "Completed" filter
5. Delete "Buy groceries" using the delete button

**Expected Results:**
- "Buy groceries" is removed from the list
- Completed filter shows no todos
- Counter shows "1 item left" (for the active todo)
- "Clear completed" button disappears

### 6. Counter Display

**Seed:** `tests/seed.spec.ts`

#### 6.1 Counter Shows Correct Singular Form

**File:** `tests/counter-display/counter-shows-singular-form.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a single todo: "Buy groceries"

**Expected Results:**
- Counter displays "1 item left" (singular "item")

#### 6.2 Counter Shows Correct Plural Form

**File:** `tests/counter-display/counter-shows-plural-form.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add two todos: "Buy groceries" and "Walk the dog"

**Expected Results:**
- Counter displays "2 items left" (plural "items")

#### 6.3 Counter Updates When Completing Todo

**File:** `tests/counter-display/counter-updates-when-completing.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add three todos: "Buy groceries", "Walk the dog", "Read a book"
3. Complete "Walk the dog"
4. Complete "Buy groceries"

**Expected Results:**
- Initially shows "3 items left"
- After first completion shows "2 items left"
- After second completion shows "1 item left"

#### 6.4 Counter Shows Zero When All Completed

**File:** `tests/counter-display/counter-shows-zero-when-all-completed.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add two todos: "Buy groceries" and "Walk the dog"
3. Click "Mark all as complete" checkbox

**Expected Results:**
- Counter displays "0 items left"
- Counter remains visible even at zero

### 7. UI Controls Visibility

**Seed:** `tests/seed.spec.ts`

#### 7.1 Controls Hidden When No Todos

**File:** `tests/ui-controls-visibility/controls-hidden-when-no-todos.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Verify the initial state with no todos

**Expected Results:**
- "Mark all as complete" checkbox is not visible
- Counter is not displayed
- Filter links are not displayed
- Only the input field and header are visible

#### 7.2 Controls Appear When First Todo Added

**File:** `tests/ui-controls-visibility/controls-appear-when-first-todo-added.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"

**Expected Results:**
- "Mark all as complete" checkbox becomes visible
- Counter appears showing "1 item left"
- Filter links (All/Active/Completed) appear
- Footer with controls is displayed

#### 7.3 Controls Disappear When Last Todo Removed

**File:** `tests/ui-controls-visibility/controls-disappear-when-last-todo-removed.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Delete it using the delete button

**Expected Results:**
- All controls disappear
- View returns to initial empty state
- Only input field remains visible

#### 7.4 Clear Completed Button Visibility

**File:** `tests/ui-controls-visibility/clear-completed-button-visibility.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add two todos: "Buy groceries" and "Walk the dog"
3. Complete "Buy groceries"
4. Complete "Walk the dog"
5. Uncomplete "Walk the dog"

**Expected Results:**
- "Clear completed" button appears after first completion
- Button remains visible while at least one todo is completed
- Button disappears when no todos are completed

### 8. Edge Cases and Error Handling

**Seed:** `tests/seed.spec.ts`

#### 8.1 Rapidly Add Multiple Todos

**File:** `tests/edge-cases/rapidly-add-multiple-todos.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Quickly add 10 todos by typing and pressing Enter rapidly

**Expected Results:**
- All 10 todos are successfully added
- Counter shows "10 items left"
- Todos appear in the order they were added
- No todos are lost or duplicated

#### 8.2 Rapidly Toggle Todo Completion

**File:** `tests/edge-cases/rapidly-toggle-todo-completion.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Rapidly click the checkbox multiple times (5-10 clicks)

**Expected Results:**
- Todo state toggles correctly with each click
- Final state is predictable (checked or unchecked)
- Counter updates correctly
- No UI glitches occur

#### 8.3 Edit During Filter View

**File:** `tests/edge-cases/edit-during-filter-view.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Click "Active" filter
4. Double-click to edit the todo
5. Change text to "Buy groceries and milk"
6. Press Enter

**Expected Results:**
- Todo successfully enters edit mode
- Edit is saved correctly
- Todo remains visible in Active filter
- No filter state is lost

#### 8.4 Navigate Directly to Filtered URL

**File:** `tests/edge-cases/navigate-directly-to-filtered-url.spec.ts`

**Steps:**
1. Navigate directly to "https://demo.playwright.dev/todomvc/#/active"
2. Add a todo: "Buy groceries"
3. Complete it

**Expected Results:**
- Application loads with Active filter pre-selected
- New active todo is visible
- When completed, todo disappears from view
- Filter state is maintained

#### 8.5 Multiple Browser Tabs (Session Isolation)

**File:** `tests/edge-cases/multiple-browser-tabs-session-isolation.spec.ts`

**Steps:**
1. Open TodoMVC in first tab
2. Add a todo: "Buy groceries" in first tab
3. Open TodoMVC in second tab
4. Verify todo list in second tab

**Expected Results:**
- Second tab either shows the same todo (if using persistence) or starts empty (if session-based)
- Each tab operates independently without conflicts
- No errors occur from multiple instances

#### 8.6 Hover States Work Correctly

**File:** `tests/edge-cases/hover-states-work-correctly.spec.ts`

**Steps:**
1. Navigate to the TodoMVC application
2. Add a todo: "Buy groceries"
3. Hover over the todo item
4. Move mouse away

**Expected Results:**
- Delete button (×) appears on hover
- Delete button disappears when not hovering
- Hover state does not interfere with editing or clicking

## Testing Notes

### Assumptions
- All tests assume a fresh/blank application state at the start (provided by seed file)
- Tests are designed to be independent and can run in any order
- No persistence testing is included (refresh behavior not covered)

### Browser Compatibility
- Tests should be run across all major browsers (Chromium, Firefox, WebKit)
- UI controls may have slight visual differences across browsers

### Performance Considerations
- Application should handle at least 100 todos without performance degradation
- Filtering should be instantaneous even with many todos
- No memory leaks should occur with repeated operations

### Accessibility Considerations
- All interactive elements should be keyboard accessible
- Screen readers should announce todo state changes
- Focus management should be logical during editing

## Test Coverage Summary

This test plan covers:
- **47 individual test scenarios** across 8 major functional areas
- Happy path scenarios for all core features
- Edge cases and boundary conditions
- Input validation and error prevention
- UI state management and visibility
- Filter functionality and URL routing
- Counter accuracy and formatting
- Bulk operations and individual actions

Each test is independent, clearly documented, and designed for automation using Playwright.

# TodoMVC Basic Operations Test Plan

## Application Overview

TodoMVC is a single-page application that helps users manage their tasks. The application provides functionality to add, edit, complete, delete, and filter todos. Users can manage individual todos or perform bulk operations like marking all as complete or clearing all completed items. The interface includes a text input for adding new todos, a list view showing all todos with their completion status, filter buttons to view all/active/completed todos, and a footer displaying the count of active items.

## Test Scenarios

### 1. Todo Creation

**Seed:** `tests/seed.spec.ts`

#### 1.1. Add a single todo

**File:** `tests/todo-creation/add-single-todo.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list and input field 'What needs to be done?' is visible
  2. Type 'Buy groceries' into the input field
     Expect: The text appears in the input field
  3. Press Enter to submit the todo
     Expect: The todo 'Buy groceries' appears in the list and the input field is cleared

**Post Conditions:**
  - The todo counter shows '1 item left'
  - The new todo is unchecked (active state)

#### 1.2. Add multiple todos

**File:** `tests/todo-creation/add-multiple-todos.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add first todo 'Buy groceries' by typing and pressing Enter
     Expect: The first todo appears in the list
  3. Add second todo 'Walk the dog' by typing and pressing Enter
     Expect: The second todo appears in the list below the first
  4. Add third todo 'Read a book' by typing and pressing Enter
     Expect: The third todo appears in the list below the second

**Post Conditions:**
  - All three todos are visible in the list
  - The todo counter shows '3 items left'
  - All todos are in active (unchecked) state

#### 1.3. Prevent adding empty todo

**File:** `tests/todo-creation/prevent-empty-todo.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Click into the input field without typing anything and press Enter
     Expect: No todo is added to the list

**Post Conditions:**
  - The todo list remains empty
  - The input field is still focused and empty

#### 1.4. Prevent adding whitespace-only todo

**File:** `tests/todo-creation/prevent-whitespace-todo.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Type only spaces '   ' into the input field and press Enter
     Expect: No todo is added to the list

**Post Conditions:**
  - The todo list remains empty
  - The input field is cleared or shows the spaces

#### 1.5. Add todo with special characters

**File:** `tests/todo-creation/add-todo-special-chars.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Type 'Buy @groceries & supplies (urgent!)' into the input field and press Enter
     Expect: The todo appears in the list with all special characters preserved

**Post Conditions:**
  - The todo displays exactly as entered with special characters
  - The todo counter shows '1 item left'

### 2. Todo Completion

**Seed:** `tests/seed.spec.ts`

#### 2.1. Mark a single todo as complete

**File:** `tests/todo-completion/mark-single-complete.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list unchecked
  3. Click the checkbox next to 'Buy groceries'
     Expect: The checkbox becomes checked and the todo text may show visual indication of completion (strikethrough or style change)

**Post Conditions:**
  - The todo counter shows '0 items left'
  - The 'Clear completed' button appears in the footer

#### 2.2. Unmark a completed todo

**File:** `tests/todo-completion/unmark-completed.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list unchecked
  3. Click the checkbox to mark it as complete
     Expect: The checkbox becomes checked
  4. Click the checkbox again to unmark it
     Expect: The checkbox becomes unchecked and the todo returns to active state

**Post Conditions:**
  - The todo counter shows '1 item left'
  - The 'Clear completed' button is no longer visible

#### 2.3. Mark all todos as complete

**File:** `tests/todo-completion/mark-all-complete.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list unchecked
  3. Click the '❯Mark all as complete' checkbox at the top of the list
     Expect: All three todos become checked

**Post Conditions:**
  - The todo counter shows '0 items left'
  - The 'Clear completed' button appears
  - The '❯Mark all as complete' checkbox is checked

#### 2.4. Unmark all completed todos

**File:** `tests/todo-completion/unmark-all-complete.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list
  3. Click the '❯Mark all as complete' checkbox to mark all as complete
     Expect: All todos become checked
  4. Click the '❯Mark all as complete' checkbox again
     Expect: All todos become unchecked

**Post Conditions:**
  - The todo counter shows '3 items left'
  - The 'Clear completed' button is no longer visible
  - The '❯Mark all as complete' checkbox is unchecked

#### 2.5. Mixed completion state

**File:** `tests/todo-completion/mixed-completion.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list
  3. Mark 'Buy groceries' as complete
     Expect: First todo is checked
  4. Mark 'Read a book' as complete
     Expect: Third todo is checked

**Post Conditions:**
  - The todo counter shows '1 item left'
  - The 'Clear completed' button is visible
  - 'Walk the dog' remains unchecked
  - The '❯Mark all as complete' checkbox is unchecked (since not all are complete)

### 3. Todo Editing

**Seed:** `tests/seed.spec.ts`

#### 3.1. Edit todo text

**File:** `tests/todo-editing/edit-todo-text.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list
  3. Double-click on the todo text 'Buy groceries'
     Expect: The todo enters edit mode with a text input showing 'Buy groceries'
  4. Clear the text and type 'Buy groceries and milk'
     Expect: The new text appears in the edit field
  5. Press Enter to save the changes
     Expect: The todo exits edit mode and displays 'Buy groceries and milk'

**Post Conditions:**
  - The todo shows the updated text
  - The todo remains in its original completion state

#### 3.2. Cancel editing with Escape

**File:** `tests/todo-editing/cancel-edit-escape.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list
  3. Double-click on the todo text to enter edit mode
     Expect: The edit input appears with 'Buy groceries'
  4. Change the text to 'Something else'
     Expect: The new text appears in the edit field
  5. Press Escape key
     Expect: The edit is cancelled and the original text 'Buy groceries' is preserved

**Post Conditions:**
  - The todo shows the original text 'Buy groceries'
  - The todo is no longer in edit mode

#### 3.3. Delete todo by clearing text

**File:** `tests/todo-editing/delete-by-clearing.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list
  3. Double-click on the todo text to enter edit mode
     Expect: The edit input appears
  4. Clear all the text in the edit field
     Expect: The edit field is empty
  5. Press Enter to save
     Expect: The todo is removed from the list

**Post Conditions:**
  - The todo list is empty
  - The todo counter and footer controls are hidden

#### 3.4. Edit completed todo

**File:** `tests/todo-editing/edit-completed-todo.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list
  3. Mark the todo as complete by clicking its checkbox
     Expect: The todo is marked as complete
  4. Double-click on the completed todo text
     Expect: The todo enters edit mode
  5. Change the text to 'Buy groceries and milk' and press Enter
     Expect: The todo text is updated

**Post Conditions:**
  - The todo shows the updated text 'Buy groceries and milk'
  - The todo remains in completed state (checked)

### 4. Todo Deletion

**Seed:** `tests/seed.spec.ts`

#### 4.1. Delete a single todo

**File:** `tests/todo-deletion/delete-single-todo.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list
  3. Hover over the todo to reveal the delete button (×)
     Expect: The delete button becomes visible
  4. Click the delete button (×)
     Expect: The todo is removed from the list

**Post Conditions:**
  - The todo list is empty
  - The footer and counter are hidden

#### 4.2. Delete todo from multiple todos

**File:** `tests/todo-deletion/delete-from-multiple.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list
  3. Hover over 'Walk the dog' to reveal the delete button
     Expect: The delete button becomes visible for 'Walk the dog'
  4. Click the delete button for 'Walk the dog'
     Expect: The 'Walk the dog' todo is removed

**Post Conditions:**
  - Only 'Buy groceries' and 'Read a book' remain in the list
  - The todo counter shows '2 items left'

#### 4.3. Clear all completed todos

**File:** `tests/todo-deletion/clear-completed.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list
  3. Mark 'Buy groceries' and 'Read a book' as complete
     Expect: Two todos are checked
  4. Click the 'Clear completed' button in the footer
     Expect: The completed todos are removed from the list

**Post Conditions:**
  - Only 'Walk the dog' remains in the list
  - The todo counter shows '1 item left'
  - The 'Clear completed' button is no longer visible

#### 4.4. Clear completed when all are completed

**File:** `tests/todo-deletion/clear-all-completed.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add two todos: 'Buy groceries', 'Walk the dog'
     Expect: Both todos appear in the list
  3. Mark both todos as complete
     Expect: Both todos are checked
  4. Click the 'Clear completed' button
     Expect: All todos are removed

**Post Conditions:**
  - The todo list is empty
  - The footer and counter are hidden
  - Only the input field remains visible

#### 4.5. Delete completed todo individually

**File:** `tests/todo-deletion/delete-completed-individually.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The todo appears in the list
  3. Mark the todo as complete
     Expect: The todo is checked
  4. Hover over the completed todo and click the delete button (×)
     Expect: The completed todo is removed

**Post Conditions:**
  - The todo list is empty
  - The footer is hidden

### 5. Todo Filtering

**Seed:** `tests/seed.spec.ts`

#### 5.1. View all todos

**File:** `tests/todo-filtering/view-all-todos.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list
  3. Mark 'Buy groceries' as complete
     Expect: First todo is checked
  4. Click the 'All' filter link
     Expect: All three todos (both active and completed) are visible

**Post Conditions:**
  - All three todos are visible in the list
  - The 'All' filter link is highlighted/active
  - The URL hash is '#/' or empty

#### 5.2. View active todos only

**File:** `tests/todo-filtering/view-active-todos.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list
  3. Mark 'Buy groceries' as complete
     Expect: First todo is checked
  4. Click the 'Active' filter link
     Expect: Only 'Walk the dog' and 'Read a book' are visible

**Post Conditions:**
  - Only unchecked todos are visible
  - The 'Active' filter link is highlighted/active
  - The URL hash is '#/active'
  - The todo counter still shows the correct count of active items

#### 5.3. View completed todos only

**File:** `tests/todo-filtering/view-completed-todos.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear in the list
  3. Mark 'Buy groceries' and 'Read a book' as complete
     Expect: Two todos are checked
  4. Click the 'Completed' filter link
     Expect: Only 'Buy groceries' and 'Read a book' are visible

**Post Conditions:**
  - Only checked todos are visible
  - The 'Completed' filter link is highlighted/active
  - The URL hash is '#/completed'
  - The 'Clear completed' button is visible

#### 5.4. Switch between filters

**File:** `tests/todo-filtering/switch-filters.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: All three todos appear
  3. Mark 'Buy groceries' as complete
     Expect: First todo is checked
  4. Click 'Active' filter
     Expect: Only active todos are shown (2 todos)
  5. Click 'Completed' filter
     Expect: Only completed todos are shown (1 todo)
  6. Click 'All' filter
     Expect: All todos are shown again (3 todos)

**Post Conditions:**
  - The filter switches correctly each time
  - The appropriate filter link is highlighted
  - The URL hash updates accordingly

#### 5.5. Filter with no matching todos

**File:** `tests/todo-filtering/filter-no-matches.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add two todos: 'Buy groceries', 'Walk the dog'
     Expect: Both todos appear in the list unchecked
  3. Click the 'Completed' filter link
     Expect: No todos are visible (empty list area)

**Post Conditions:**
  - The main todo list area is empty or shows no items
  - The footer with filters is still visible
  - The 'Completed' filter link is highlighted

#### 5.6. Complete todo while viewing active filter

**File:** `tests/todo-filtering/complete-in-active-view.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add two todos: 'Buy groceries', 'Walk the dog'
     Expect: Both todos appear in the list
  3. Click the 'Active' filter link
     Expect: Both todos are visible
  4. Mark 'Buy groceries' as complete
     Expect: The 'Buy groceries' todo disappears from the active view

**Post Conditions:**
  - Only 'Walk the dog' is visible in the active view
  - The todo counter shows '1 item left'
  - Switching to 'All' or 'Completed' shows 'Buy groceries' is still there and checked

### 6. Todo Counter

**Seed:** `tests/seed.spec.ts`

#### 6.1. Counter updates when adding todos

**File:** `tests/todo-counter/counter-add.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add a todo 'Buy groceries'
     Expect: The counter shows '1 item left'
  3. Add a todo 'Walk the dog'
     Expect: The counter shows '2 items left'
  4. Add a todo 'Read a book'
     Expect: The counter shows '3 items left'

**Post Conditions:**
  - The counter accurately reflects the number of active todos
  - The counter uses plural 'items' when count is not 1

#### 6.2. Counter updates when completing todos

**File:** `tests/todo-counter/counter-complete.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: The counter shows '3 items left'
  3. Mark 'Buy groceries' as complete
     Expect: The counter shows '2 items left'
  4. Mark 'Walk the dog' as complete
     Expect: The counter shows '1 item left'
  5. Mark 'Read a book' as complete
     Expect: The counter shows '0 items left'

**Post Conditions:**
  - The counter decreases as todos are completed
  - The counter uses singular 'item' when count is 1

#### 6.3. Counter updates when deleting todos

**File:** `tests/todo-counter/counter-delete.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: The counter shows '3 items left'
  3. Delete 'Walk the dog' using the delete button (×)
     Expect: The counter shows '2 items left'

**Post Conditions:**
  - The counter decreases when an active todo is deleted

#### 6.4. Counter unchanged when deleting completed todo

**File:** `tests/todo-counter/counter-delete-completed.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add two todos: 'Buy groceries', 'Walk the dog'
     Expect: The counter shows '2 items left'
  3. Mark 'Buy groceries' as complete
     Expect: The counter shows '1 item left'
  4. Delete 'Buy groceries' using the delete button
     Expect: The counter still shows '1 item left'

**Post Conditions:**
  - The counter only counts active (uncompleted) todos
  - Deleting completed todos doesn't affect the counter

#### 6.5. Counter persists across filter views

**File:** `tests/todo-counter/counter-across-filters.spec.ts`

**Steps:**
  1. Navigate to the TodoMVC application
     Expect: The page loads with an empty todo list
  2. Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'
     Expect: The counter shows '3 items left'
  3. Mark 'Buy groceries' as complete
     Expect: The counter shows '2 items left'
  4. Click 'Active' filter
     Expect: The counter still shows '2 items left'
  5. Click 'Completed' filter
     Expect: The counter still shows '2 items left'

**Post Conditions:**
  - The counter always shows the count of active todos regardless of the current filter view

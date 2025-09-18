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

#### 1.1 Add Valid Todo
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Click in the "What needs to be done?" input field
3. Type "Buy groceries"
4. Press Enter key

**Expected Results:**
- Todo appears in the list with unchecked checkbox
- Counter shows "1 item left"
- Input field is cleared and ready for next entry
- Todo list controls become visible (Mark all as complete checkbox)

#### 1.2 Add Multiple Todos
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add first todo: "Buy groceries" and press Enter
3. Add second todo: "Walk the dog" and press Enter
4. Add third todo: "Call dentist" and press Enter

**Expected Results:**
- All three todos appear in the list in the order added
- Counter shows "3 items left"
- Each todo has its own unchecked checkbox
- Input field remains active and cleared after each addition

#### 1.3 Add Todo with Special Characters
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Type "Buy coffee & donuts (2-3 pieces) @$5.99!" in input field
3. Press Enter

**Expected Results:**
- Todo appears exactly as typed with all special characters preserved
- Counter shows "1 item left"
- No encoding or display issues with special characters

#### 1.4 Add Empty Todo (Negative Test)
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Click in input field but don't type anything
3. Press Enter

**Expected Results:**
- No todo is added to the list
- List remains empty
- No counter appears
- Input field remains focused and empty

#### 1.5 Add Todo with Only Whitespace (Negative Test)
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Type only spaces "   " in input field
3. Press Enter

**Expected Results:**
- No todo is added to the list
- List remains empty
- Input field is cleared
- No counter appears

### 2. Marking Todos Complete/Incomplete

#### 2.1 Mark Single Todo Complete
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todo "Buy groceries"
3. Click the checkbox next to "Buy groceries"

**Expected Results:**
- Checkbox becomes checked
- Todo text may show strikethrough or completed styling
- Counter shows "0 items left"
- "Clear completed" button appears
- Delete button (×) becomes visible on hover

#### 2.2 Mark Multiple Todos Complete
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Click checkbox for "Buy groceries"
4. Click checkbox for "Call dentist"

**Expected Results:**
- Two todos show as completed
- Counter shows "1 item left" (for "Walk the dog")
- "Clear completed" button appears
- Only "Walk the dog" remains unchecked

#### 2.3 Toggle Todo Back to Incomplete
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todo "Buy groceries"
3. Click checkbox to mark complete
4. Click checkbox again to mark incomplete

**Expected Results:**
- Checkbox becomes unchecked
- Completed styling is removed
- Counter shows "1 item left"
- "Clear completed" button disappears if no other completed todos exist

#### 2.4 Mark All Todos Complete
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Click the "Mark all as complete" checkbox

**Expected Results:**
- All todo checkboxes become checked
- Counter shows "0 items left"
- "Clear completed" button appears
- "Mark all as complete" checkbox shows as checked

#### 2.5 Toggle All Todos Back to Incomplete
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog"
3. Click "Mark all as complete" checkbox
4. Click "Mark all as complete" checkbox again

**Expected Results:**
- All todo checkboxes become unchecked
- Counter shows "2 items left"
- "Clear completed" button disappears
- "Mark all as complete" checkbox shows as unchecked

### 3. Editing Todos

#### 3.1 Edit Todo Text
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todo "Buy groceries"
3. Double-click on the todo text "Buy groceries"
4. Clear text and type "Buy organic groceries"
5. Press Enter

**Expected Results:**
- Todo enters edit mode with text selected
- Text changes to "Buy organic groceries"
- Todo exits edit mode
- Counter remains "1 item left"

#### 3.2 Cancel Edit with Escape
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todo "Buy groceries"
3. Double-click on the todo text
4. Change text to "Buy organic groceries"
5. Press Escape key

**Expected Results:**
- Todo exits edit mode
- Text reverts to original "Buy groceries"
- No changes are saved
- Todo remains in its original state

#### 3.3 Edit Todo to Empty Text (Negative Test)
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todo "Buy groceries"
3. Double-click on the todo text
4. Clear all text
5. Press Enter

**Expected Results:**
- Todo should be deleted/removed from list
- Counter decrements appropriately
- List becomes empty if this was the only todo

#### 3.4 Edit Multiple Todos
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog"
3. Double-click "Buy groceries", change to "Buy organic groceries", press Enter
4. Double-click "Walk the dog", change to "Walk the cat", press Enter

**Expected Results:**
- Both todos are updated with new text
- Counter remains "2 items left"
- Both todos maintain their completion state

### 4. Deleting Todos

#### 4.1 Delete Single Todo
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todo "Buy groceries"
3. Hover over the todo item
4. Click the delete button (×)

**Expected Results:**
- Todo is removed from the list
- List becomes empty
- Counter disappears
- Todo controls (filters, mark all) disappear

#### 4.2 Delete Multiple Todos
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Hover over "Walk the dog" and click delete (×)
4. Hover over "Call dentist" and click delete (×)

**Expected Results:**
- Only "Buy groceries" remains in the list
- Counter shows "1 item left"
- List controls remain visible

#### 4.3 Delete Completed Todo
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog"
3. Mark "Buy groceries" as complete
4. Hover over "Buy groceries" and click delete (×)

**Expected Results:**
- "Buy groceries" is removed from list
- Only "Walk the dog" remains
- Counter shows "1 item left"
- "Clear completed" button disappears

#### 4.4 Clear All Completed Todos
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Mark "Buy groceries" and "Call dentist" as complete
4. Click "Clear completed" button

**Expected Results:**
- Both completed todos are removed
- Only "Walk the dog" remains
- Counter shows "1 item left"
- "Clear completed" button disappears

### 5. Filtering Todos

#### 5.1 Filter by All
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Mark "Buy groceries" as complete
4. Click "All" filter link

**Expected Results:**
- All todos are visible (both completed and active)
- URL shows "#/"
- "All" filter appears active/highlighted
- Counter shows "2 items left"

#### 5.2 Filter by Active
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Mark "Buy groceries" as complete
4. Click "Active" filter link

**Expected Results:**
- Only incomplete todos are visible ("Walk the dog", "Call dentist")
- Completed todo "Buy groceries" is hidden
- URL shows "#/active"
- "Active" filter appears active/highlighted
- Counter shows "2 items left"

#### 5.3 Filter by Completed
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Mark "Buy groceries" and "Walk the dog" as complete
4. Click "Completed" filter link

**Expected Results:**
- Only completed todos are visible ("Buy groceries", "Walk the dog")
- Active todo "Call dentist" is hidden
- URL shows "#/completed"
- "Completed" filter appears active/highlighted
- Counter still shows "1 item left" (maintains global count)

#### 5.4 Navigate Between Filters
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog"
3. Mark "Buy groceries" as complete
4. Click "Active" filter
5. Click "Completed" filter
6. Click "All" filter

**Expected Results:**
- Each filter shows appropriate todos
- URL updates correctly for each filter
- Active filter is highlighted appropriately
- Counter remains consistent across filters
- Todos maintain their state when switching views

### 6. Counter and Status Display

#### 6.1 Counter with Single Item
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add one todo "Buy groceries"

**Expected Results:**
- Counter displays "1 item left" (singular form)
- Counter updates immediately when todo is added

#### 6.2 Counter with Multiple Items
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog"

**Expected Results:**
- Counter displays "2 items left" (plural form)
- Counter shows correct count

#### 6.3 Counter Updates with Completion
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Mark "Buy groceries" as complete
4. Mark "Walk the dog" as complete

**Expected Results:**
- Counter starts at "3 items left"
- After first completion: "2 items left"
- After second completion: "1 item left"
- Counter updates immediately with each change

#### 6.4 Counter with All Items Complete
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todo "Buy groceries"
3. Mark it as complete

**Expected Results:**
- Counter shows "0 items left"
- "Clear completed" button is visible
- Filter links remain functional

### 7. Bulk Operations

#### 7.1 Mark All Complete When None Completed
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Click "Mark all as complete" checkbox

**Expected Results:**
- All todos become checked/completed
- Counter shows "0 items left"
- "Clear completed" button appears
- "Mark all as complete" checkbox shows as checked

#### 7.2 Mark All Incomplete When All Completed
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog"
3. Mark both todos as complete individually
4. Click "Mark all as complete" checkbox

**Expected Results:**
- All todos become unchecked/incomplete
- Counter shows "2 items left"
- "Clear completed" button disappears
- "Mark all as complete" checkbox shows as unchecked

#### 7.3 Mark All with Mixed State
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
3. Mark "Buy groceries" as complete
4. Click "Mark all as complete" checkbox

**Expected Results:**
- All todos become completed (including the already completed one)
- Counter shows "0 items left"
- "Mark all as complete" checkbox shows as checked

### 8. Edge Cases and Error Handling

#### 8.1 Very Long Todo Text
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Type a very long todo text (200+ characters)
3. Press Enter

**Expected Results:**
- Todo is added successfully
- Text wraps appropriately in the display
- Interface remains usable
- Edit functionality works with long text

#### 8.2 Rapid Sequential Actions
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Quickly add multiple todos by typing and pressing Enter rapidly
3. Quickly toggle completion states
4. Rapidly switch between filters

**Expected Results:**
- All actions are processed correctly
- Counter updates accurately
- No todos are lost or duplicated
- Interface remains responsive

#### 8.3 Direct URL Navigation
**Steps:**
1. Navigate directly to `{base_url}#/active`
2. Navigate directly to `{base_url}#/completed`
3. Navigate directly to `{base_url}#/`

**Expected Results:**
- Page loads correctly for each URL
- Appropriate filter is active
- Interface is fully functional
- No JavaScript errors occur

#### 8.4 Todo Operations Across Filters
**Steps:**
1. Use seed test `tests/seed.spec.ts` to initialize page
2. Add todos: "Buy groceries", "Walk the dog"
3. Navigate to "Active" filter
4. Mark "Buy groceries" as complete
5. Navigate to "Completed" filter
6. Delete "Buy groceries"

**Expected Results:**
- Operations work correctly across filter views
- Todo states are maintained when switching filters
- Counter updates appropriately
- UI remains consistent

## Test Data Considerations

- **Todo Text Variations**: Test with short text, long text, special characters, Unicode characters, HTML entities
- **Volume Testing**: Test with 1, 2, 10, 50+ todos to ensure performance
- **State Combinations**: Test all combinations of completed/incomplete todos with different filters
- **Boundary Values**: Test edge cases like exactly 0 items, exactly 1 item, maximum reasonable todo count

## Success Criteria

All test scenarios should pass without:
- JavaScript console errors
- Visual layout issues
- Incorrect counter displays
- Lost or corrupted todo data
- Non-functional UI elements
- Accessibility violations

The application should maintain consistent behavior across all supported browsers and provide a smooth, intuitive user experience for basic todo management operations.
## Adding Todos

- seed: ./seed.spec.md

### should add single todo

- tag: @one @two
- tag: @three
- annotation: link=https://playwright.dev
- annotation: link2=https://demo.playwright.dev

* Type 'Buy groceries' into the input field
* expect: The text appears in the input field
- Press Enter to submit the todo
- group: Verify todo is added to the list
  - expect: The new todo 'Buy groceries' appears in the todo list
  - expect: The input field is cleared
  - expect: The todo counter shows '1 item left'

### should add multiple todos

1. Add first todo 'Buy milk'
  - expect: The todo appears in the list
  - expect: Counter shows '1 item left'
2. Add second todo 'Walk the dog'
  - expect: Both todos appear in the list
  - expect: Counter shows '2 items left'
3. // this is a comment
4. Add third todo 'Finish report'
  - expect: All three todos appear in the list
  - // this is a comment
  - expect: Counter shows '3 items left'

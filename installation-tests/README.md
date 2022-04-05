# Installation Tests

These tests check end-to-end installation and operation of Playwright.
Each test is set with a separate folder that contains all scripts from
`fixture-scripts` folder and dummy package.json.

To create a new test, create a new file that starts with `test_*.sh`
with the following header:
    ```bash
    #!/bin/bash
    source ./initialize_test.sh && initialize_test "$@" # initialize test
    ```

To run all tests:

```bash
./run_all_tests.sh
```

To install local builds of `playwright` packages in tests, do `npm_i playwright`.

Each test run will get its own npm state. You can use `local-playwright-registry <package>` to
ensure it was installed as part of the test run, and that it was a local copy.

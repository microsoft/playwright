# class: Suite
* langs: js

`Suite` is a group of tests. All tests in Playwright Test form the following hierarchy:

* Root suite has a child suite for each [TestProject].
  * Project suite #1. Has a child suite for each test file in the project.
    * File suite #1
      * [TestCase] #1
      * [TestCase] #2
      * Suite corresponding to a [`method: Test.describe`] group
        * [TestCase] #1 in a group
        * [TestCase] #2 in a group
      * < more test cases ... >
    * File suite #2
    * < more file suites ... >
  * Project suite #2
  * < more project suites ... >

Reporter is given a root suite in the [`method: Reporter.onBegin`] method.

## method: Suite.allTests
- returns: <[Array]<[TestCase]>>

Returns the list of all test cases in this suite and its descendants, as opposite to [`property: Suite.tests`].

## property: Suite.location
- type: <[Location]>

Optional location in the source where the suite is defined. Missing for root and project suites.

## property: Suite.parent
- type: <[Suite]>

Optional parent suite, missing for the root suite.

## method: Suite.project
- returns: <[void]|[TestProject]>

Configuration of the project this suite belongs to, or [void] for the root suite.

## property: Suite.suites
- type: <[Array]<[Suite]>>

Child suites. See [Suite] for the hierarchy of suites.

## property: Suite.tests
- type: <[Array]<[TestCase]>>

Test cases in the suite. Note that only test cases defined directly in this suite are in the list. Any test cases defined in nested [`method: Test.describe`] groups are listed
in the child [`property: Suite.suites`].

## property: Suite.title
- type: <[string]>

Suite title.
* Empty for root suite.
* Project name for project suite.
* File path for file suite.
* Title passed to [`method: Test.describe`] for a group suite.

## method: Suite.titlePath
- returns: <[Array]<[string]>>

Returns a list of titles from the root down to this suite.

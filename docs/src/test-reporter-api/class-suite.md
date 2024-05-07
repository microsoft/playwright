# class: Suite
* since: v1.10
* langs: js

`Suite` is a group of tests. All tests in Playwright Test form the following hierarchy:

* Root suite has a child suite for each [FullProject].
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
* since: v1.10
- returns: <[Array]<[TestCase]>>

Returns the list of all test cases in this suite and its descendants, as opposite to [`property: Suite.tests`].

## method: Suite.entries
* since: v1.44
- type: <[Array]<[TestCase]|[Suite]>>

Test cases and suites defined directly in this suite. The elements are returned in their declaration order. You can differentiate between various entry types by using [`property: TestCase.type`] and [`property: Suite.type`].

## property: Suite.location
* since: v1.10
- type: ?<[Location]>

Location in the source where the suite is defined. Missing for root and project suites.

## property: Suite.parent
* since: v1.10
- type: ?<[Suite]>

Parent suite, missing for the root suite.

## method: Suite.project
* since: v1.10
- returns: <[FullProject]|[undefined]>

Configuration of the project this suite belongs to, or [void] for the root suite.

## property: Suite.suites
* since: v1.10
- type: <[Array]<[Suite]>>

Child suites. See [Suite] for the hierarchy of suites.

## property: Suite.tests
* since: v1.10
- type: <[Array]<[TestCase]>>

Test cases in the suite. Note that only test cases defined directly in this suite are in the list. Any test cases defined in nested [`method: Test.describe`] groups are listed
in the child [`property: Suite.suites`].

## property: Suite.title
* since: v1.10
- type: <[string]>

Suite title.
* Empty for root suite.
* Project name for project suite.
* File path for file suite.
* Title passed to [`method: Test.describe`] for a group suite.

## method: Suite.titlePath
* since: v1.10
- returns: <[Array]<[string]>>

Returns a list of titles from the root down to this suite.

## property: Suite.type
* since: v1.44
- returns: <[SuiteType]<"root"|"project"|"file"|"describe">>

Returns the type of the suite. The Suites form the following hierarchy:
`root` -> `project` -> `file` -> `describe` -> ...`describe` -> `test`.

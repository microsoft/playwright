---
id: api-testing
title: "API testing"
---

## Introduction

Playwright can be used to get access to the [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) API of
your application.

Sometimes you may want to send requests to the server directly from Java without loading a page and running js code in it.
A few examples where it may come in handy:
- Test your server API.
- Prepare server side state before visiting the web application in a test.
- Validate server side post-conditions after running some actions in the browser.

All of that could be achieved via [APIRequestContext] methods.

## Writing API Test

[APIRequestContext] can send all kinds of HTTP(S) requests over network.

The following example demonstrates how to use Playwright to test issues creation via [GitHub API](https://docs.github.com/en/rest). The test suite will do the following:
- Create a new repository before running tests.
- Create a few issues and validate server state.
- Delete the repository after running tests.

### Configure

GitHub API requires authorization, so we'll configure the token once for all tests. While at it, we'll also set the `baseURL` to simplify the tests.

```java
package org.example;

import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.Playwright;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;

import java.util.HashMap;
import java.util.Map;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestGitHubAPI {
  private static final String API_TOKEN = System.getenv("GITHUB_API_TOKEN");

  private Playwright playwright;
  private APIRequestContext request;

  void createPlaywright() {
    playwright = Playwright.create();
  }

  void createAPIRequestContext() {
    Map<String, String> headers = new HashMap<>();
    // We set this header per GitHub guidelines.
    headers.put("Accept", "application/vnd.github.v3+json");
    // Add authorization token to all requests.
    // Assuming personal access token available in the environment.
    headers.put("Authorization", "token " + API_TOKEN);

    request = playwright.request().newContext(new APIRequest.NewContextOptions()
      // All requests we send go to this API endpoint.
      .setBaseURL("https://api.github.com")
      .setExtraHTTPHeaders(headers));
  }

  @BeforeAll
  void beforeAll() {
    createPlaywright();
    createAPIRequestContext();
  }

  void disposeAPIRequestContext() {
    if (request != null) {
      request.dispose();
      request = null;
    }
  }

  void closePlaywright() {
    if (playwright != null) {
      playwright.close();
      playwright = null;
    }
  }

  @AfterAll
  void afterAll() {
    disposeAPIRequestContext();
    closePlaywright();
  }
}
```

### Write tests

Now that we initialized request object we can add a few tests that will create new issues in the repository.
```java
package org.example;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestGitHubAPI {
  private static final String REPO = "test-repo-2";
  private static final String USER = System.getenv("GITHUB_USER");
  private static final String API_TOKEN = System.getenv("GITHUB_API_TOKEN");

  private Playwright playwright;
  private APIRequestContext request;

  // ...

  @Test
  void shouldCreateBugReport() {
    Map<String, String> data = new HashMap<>();
    data.put("title", "[Bug] report 1");
    data.put("body", "Bug description");
    APIResponse newIssue = request.post("/repos/" + USER + "/" + REPO + "/issues",
      RequestOptions.create().setData(data));
    assertTrue(newIssue.ok());

    APIResponse issues = request.get("/repos/" + USER + "/" + REPO + "/issues");
    assertTrue(issues.ok());
    JsonArray json = new Gson().fromJson(issues.text(), JsonArray.class);
    JsonObject issue = null;
    for (JsonElement item : json) {
      JsonObject itemObj = item.getAsJsonObject();
      if (!itemObj.has("title")) {
        continue;
      }
      if ("[Bug] report 1".equals(itemObj.get("title").getAsString())) {
        issue = itemObj;
        break;
      }
    }
    assertNotNull(issue);
    assertEquals("Bug description", issue.get("body").getAsString(), issue.toString());
  }

  @Test
  void shouldCreateFeatureRequest() {
    Map<String, String> data = new HashMap<>();
    data.put("title", "[Feature] request 1");
    data.put("body", "Feature description");
    APIResponse newIssue = request.post("/repos/" + USER + "/" + REPO + "/issues",
      RequestOptions.create().setData(data));
    assertTrue(newIssue.ok());

    APIResponse issues = request.get("/repos/" + USER + "/" + REPO + "/issues");
    assertTrue(issues.ok());
    JsonArray json = new Gson().fromJson(issues.text(), JsonArray.class);
    JsonObject issue = null;
    for (JsonElement item : json) {
      JsonObject itemObj = item.getAsJsonObject();
      if (!itemObj.has("title")) {
        continue;
      }
      if ("[Feature] request 1".equals(itemObj.get("title").getAsString())) {
        issue = itemObj;
        break;
      }
    }
    assertNotNull(issue);
    assertEquals("Feature description", issue.get("body").getAsString(), issue.toString());
  }
}

```

### Setup and teardown

These tests assume that repository exists. You probably want to create a new one before running tests and delete it afterwards. Use `@BeforeAll` and `@AfterAll` hooks for that.

```java
  // ...

  void createTestRepository() {
    APIResponse newRepo = request.post("/user/repos",
      RequestOptions.create().setData(Collections.singletonMap("name", REPO)));
    assertTrue(newRepo.ok(), newRepo.text());
  }

  @BeforeAll
  void beforeAll() {
    createPlaywright();
    createAPIRequestContext();
    createTestRepository();
  }

  void deleteTestRepository() {
    if (request != null) {
      APIResponse deletedRepo = request.delete("/repos/" + USER + "/" + REPO);
      assertTrue(deletedRepo.ok());
    }
  }
  // ...

  @AfterAll
  void afterAll() {
    deleteTestRepository();
    disposeAPIRequestContext();
    closePlaywright();
  }
```

### Complete test example

Here is the complete example of an API test:

```java
package org.example;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TestGitHubAPI {
  private static final String REPO = "test-repo-2";
  private static final String USER = System.getenv("GITHUB_USER");
  private static final String API_TOKEN = System.getenv("GITHUB_API_TOKEN");

  private Playwright playwright;
  private APIRequestContext request;

  void createPlaywright() {
    playwright = Playwright.create();
  }

  void createAPIRequestContext() {
    Map<String, String> headers = new HashMap<>();
    // We set this header per GitHub guidelines.
    headers.put("Accept", "application/vnd.github.v3+json");
    // Add authorization token to all requests.
    // Assuming personal access token available in the environment.
    headers.put("Authorization", "token " + API_TOKEN);

    request = playwright.request().newContext(new APIRequest.NewContextOptions()
      // All requests we send go to this API endpoint.
      .setBaseURL("https://api.github.com")
      .setExtraHTTPHeaders(headers));
  }

  void createTestRepository() {
    APIResponse newRepo = request.post("/user/repos",
      RequestOptions.create().setData(Collections.singletonMap("name", REPO)));
    assertTrue(newRepo.ok(), newRepo.text());
  }

  @BeforeAll
  void beforeAll() {
    createPlaywright();
    createAPIRequestContext();
    createTestRepository();
  }

  void deleteTestRepository() {
    if (request != null) {
      APIResponse deletedRepo = request.delete("/repos/" + USER + "/" + REPO);
      assertTrue(deletedRepo.ok());
    }
  }

  void disposeAPIRequestContext() {
    if (request != null) {
      request.dispose();
      request = null;
    }
  }

  void closePlaywright() {
    if (playwright != null) {
      playwright.close();
      playwright = null;
    }
  }

  @AfterAll
  void afterAll() {
    deleteTestRepository();
    disposeAPIRequestContext();
    closePlaywright();
  }

  @Test
  void shouldCreateBugReport() {
    Map<String, String> data = new HashMap<>();
    data.put("title", "[Bug] report 1");
    data.put("body", "Bug description");
    APIResponse newIssue = request.post("/repos/" + USER + "/" + REPO + "/issues",
      RequestOptions.create().setData(data));
    assertTrue(newIssue.ok());

    APIResponse issues = request.get("/repos/" + USER + "/" + REPO + "/issues");
    assertTrue(issues.ok());
    JsonArray json = new Gson().fromJson(issues.text(), JsonArray.class);
    JsonObject issue = null;
    for (JsonElement item : json) {
      JsonObject itemObj = item.getAsJsonObject();
      if (!itemObj.has("title")) {
        continue;
      }
      if ("[Bug] report 1".equals(itemObj.get("title").getAsString())) {
        issue = itemObj;
        break;
      }
    }
    assertNotNull(issue);
    assertEquals("Bug description", issue.get("body").getAsString(), issue.toString());
  }

  @Test
  void shouldCreateFeatureRequest() {
    Map<String, String> data = new HashMap<>();
    data.put("title", "[Feature] request 1");
    data.put("body", "Feature description");
    APIResponse newIssue = request.post("/repos/" + USER + "/" + REPO + "/issues",
      RequestOptions.create().setData(data));
    assertTrue(newIssue.ok());

    APIResponse issues = request.get("/repos/" + USER + "/" + REPO + "/issues");
    assertTrue(issues.ok());
    JsonArray json = new Gson().fromJson(issues.text(), JsonArray.class);
    JsonObject issue = null;
    for (JsonElement item : json) {
      JsonObject itemObj = item.getAsJsonObject();
      if (!itemObj.has("title")) {
        continue;
      }
      if ("[Feature] request 1".equals(itemObj.get("title").getAsString())) {
        issue = itemObj;
        break;
      }
    }
    assertNotNull(issue);
    assertEquals("Feature description", issue.get("body").getAsString(), issue.toString());
  }
}
```

See experimental [JUnit integration](./junit.md) to automatically initialize Playwright objects and more.

## Prepare server state via API calls

The following test creates a new issue via API and then navigates to the list of all issues in the
project to check that it appears at the top of the list. The check is performed using [LocatorAssertions].

```java
@Test
void lastCreatedIssueShouldBeFirstInTheList() {
  Map<String, String> data = new HashMap<>();
  data.put("title", "[Feature] request 1");
  data.put("body", "Feature description");
  APIResponse newIssue = request.post("/repos/" + USER + "/" + REPO + "/issues",
    RequestOptions.create().setData(data));
  assertTrue(newIssue.ok());

  page.navigate("https://github.com/" + USER + "/" + REPO + "/issues");
  Locator firstIssue = page.locator("a[data-hovercard-type='issue']").first();
  assertThat(firstIssue).hasText("[Feature] request 1");
}
```

## Check the server state after running user actions

The following test creates a new issue via user interface in the browser and then checks via API if
it was created:

```java
@Test
void lastCreatedIssueShouldBeOnTheServer() {
  page.navigate("https://github.com/" + USER + "/" + REPO + "/issues");
  page.locator("text=New Issue").click();
  page.locator("[aria-label='Title']").fill("Bug report 1");
  page.locator("[aria-label='Comment body']").fill("Bug description");
  page.locator("text=Submit new issue").click();
  String issueId = page.url().substring(page.url().lastIndexOf('/'));

  APIResponse newIssue = request.get("https://github.com/" + USER + "/" + REPO + "/issues/" + issueId);
  assertThat(newIssue).isOK();
  assertTrue(newIssue.text().contains("Bug report 1"));
}
```

## Reuse authentication state

Web apps use cookie-based or token-based authentication, where authenticated
state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies).
Playwright provides [`method: APIRequestContext.storageState`] method that can be used to
retrieve storage state from an authenticated context and then create new contexts with that state.

Storage state is interchangeable between [BrowserContext] and [APIRequestContext]. You can
use it to log in via API calls and then create a new context with cookies already there.
The following code snippet retrieves state from an authenticated [APIRequestContext] and
creates a new [BrowserContext] with that state.

```java
APIRequestContext requestContext = playwright.request().newContext(
  new APIRequest.NewContextOptions().setHttpCredentials("user", "passwd"));
requestContext.get("https://api.example.com/login");
// Save storage state into a variable.
String state = requestContext.storageState();

// Create a new context with the saved storage state.
BrowserContext context = browser.newContext(new Browser.NewContextOptions().setStorageState(state));
```

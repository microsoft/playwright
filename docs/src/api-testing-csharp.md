---
id: api-testing
title: "API testing"
---

## Introduction

Playwright can be used to get access to the [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) API of
your application.

Sometimes you may want to send requests to the server directly from .NET without loading a page and running js code in it.
A few examples where it may come in handy:
- Test your server API.
- Prepare server side state before visiting the web application in a test.
- Validate server side post-conditions after running some actions in the browser.

All of that could be achieved via [APIRequestContext] methods.

The following examples rely on the [`Microsoft.Playwright.MSTest`](./test-runners.md) package which creates a Playwright and Page instance for each test.

## Writing API Test

[APIRequestContext] can send all kinds of HTTP(S) requests over network.

The following example demonstrates how to use Playwright to test issues creation via [GitHub API](https://docs.github.com/en/rest). The test suite will do the following:
- Create a new repository before running tests.
- Create a few issues and validate server state.
- Delete the repository after running tests.

### Configure

GitHub API requires authorization, so we'll configure the token once for all tests. While at it, we'll also set the `baseURL` to simplify the tests.

```csharp
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class TestGitHubAPI : PlaywrightTest
{
    static string? API_TOKEN = Environment.GetEnvironmentVariable("GITHUB_API_TOKEN");

    private IAPIRequestContext Request = null!;

    [TestInitialize]
    public async Task SetUpAPITesting()
    {
        await CreateAPIRequestContext();
    }

    private async Task CreateAPIRequestContext()
    {
        var headers = new Dictionary<string, string>();
        // We set this header per GitHub guidelines.
        headers.Add("Accept", "application/vnd.github.v3+json");
        // Add authorization token to all requests.
        // Assuming personal access token available in the environment.
        headers.Add("Authorization", "token " + API_TOKEN);

        Request = await this.Playwright.APIRequest.NewContextAsync(new() {
            // All requests we send go to this API endpoint.
            BaseURL = "https://api.github.com",
            ExtraHTTPHeaders = headers,
        });
    }

    [TestCleanup]
    public async Task TearDownAPITesting()
    {
        await Request.DisposeAsync();
    }
}
```

### Write tests

Now that we initialized request object we can add a few tests that will create new issues in the repository.
```csharp
using System.Text.Json;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class TestGitHubAPI : PlaywrightTest
{
    static string REPO = "test";
    static string USER = Environment.GetEnvironmentVariable("GITHUB_USER");
    static string? API_TOKEN = Environment.GetEnvironmentVariable("GITHUB_API_TOKEN");

    private IAPIRequestContext Request = null!;

    [TestMethod]
    public async Task ShouldCreateBugReport()
    {
        var data = new Dictionary<string, string>
        {
            { "title", "[Bug] report 1" },
            { "body", "Bug description" }
        };
        var newIssue = await Request.PostAsync("/repos/" + USER + "/" + REPO + "/issues", new() { DataObject = data });
        await Expect(newIssue).ToBeOKAsync();

        var issues = await Request.GetAsync("/repos/" + USER + "/" + REPO + "/issues");
        await Expect(newIssue).ToBeOKAsync();
        var issuesJsonResponse = await issues.JsonAsync();
        JsonElement? issue = null;
        foreach (JsonElement issueObj in issuesJsonResponse?.EnumerateArray())
        {
            if (issueObj.TryGetProperty("title", out var title) == true)
            {
                if (title.GetString() == "[Bug] report 1")
                {
                    issue = issueObj;
                }
            }
        }
        Assert.IsNotNull(issue);
        Assert.AreEqual("Bug description", issue?.GetProperty("body").GetString());
    }

    [TestMethod]
    public async Task ShouldCreateFeatureRequests()
    {
        var data = new Dictionary<string, string>
        {
            { "title", "[Feature] request 1" },
            { "body", "Feature description" }
        };
        var newIssue = await Request.PostAsync("/repos/" + USER + "/" + REPO + "/issues", new() { DataObject = data });
        await Expect(newIssue).ToBeOKAsync();

        var issues = await Request.GetAsync("/repos/" + USER + "/" + REPO + "/issues");
        await Expect(newIssue).ToBeOKAsync();
        var issuesJsonResponse = await issues.JsonAsync();

        JsonElement? issue = null;
        foreach (JsonElement issueObj in issuesJsonResponse?.EnumerateArray())
        {
            if (issueObj.TryGetProperty("title", out var title) == true)
            {
                if (title.GetString() == "[Feature] request 1")
                {
                    issue = issueObj;
                }
            }
        }
        Assert.IsNotNull(issue);
        Assert.AreEqual("Feature description", issue?.GetProperty("body").GetString());
    }

    // ...
}
```

### Setup and teardown

These tests assume that repository exists. You probably want to create a new one before running tests and delete it afterwards. Use `[SetUp]` and `[TearDown]` hooks for that.

```csharp
using System.Text.Json;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class TestGitHubAPI : PlaywrightTest
{
    // ...
    [TestInitialize]
    public async Task SetUpAPITesting()
    {
        await CreateAPIRequestContext();
        await CreateTestRepository();
    }

    private async Task CreateTestRepository()
    {
        var resp = await Request.PostAsync("/user/repos", new()
        {
            DataObject = new Dictionary<string, string>()
            {
                ["name"] = REPO,
            },
        });
        await Expect(resp).ToBeOKAsync();
    }

    [TestCleanup]
    public async Task TearDownAPITesting()
    {
        await DeleteTestRepository();
        await Request.DisposeAsync();
    }

    private async Task DeleteTestRepository()
    {
        var resp = await Request.DeleteAsync("/repos/" + USER + "/" + REPO);
        await Expect(resp).ToBeOKAsync();
    }
}
```

### Complete test example

Here is the complete example of an API test:

```csharp
using System.Text.Json;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class TestGitHubAPI : PlaywrightTest
{
    static string REPO = "test-repo-2";
    static string USER = Environment.GetEnvironmentVariable("GITHUB_USER");
    static string? API_TOKEN = Environment.GetEnvironmentVariable("GITHUB_API_TOKEN");

    private IAPIRequestContext Request = null!;

    [TestMethod]
    public async Task ShouldCreateBugReport()
    {
        var data = new Dictionary<string, string>
        {
            { "title", "[Bug] report 1" },
            { "body", "Bug description" }
        };
        var newIssue = await Request.PostAsync("/repos/" + USER + "/" + REPO + "/issues", new() { DataObject = data });
        await Expect(newIssue).ToBeOKAsync();

        var issues = await Request.GetAsync("/repos/" + USER + "/" + REPO + "/issues");
        await Expect(newIssue).ToBeOKAsync();
        var issuesJsonResponse = await issues.JsonAsync();
        JsonElement? issue = null;
        foreach (JsonElement issueObj in issuesJsonResponse?.EnumerateArray())
        {
            if (issueObj.TryGetProperty("title", out var title) == true)
            {
                if (title.GetString() == "[Bug] report 1")
                {
                    issue = issueObj;
                }
            }
        }
        Assert.IsNotNull(issue);
        Assert.AreEqual("Bug description", issue?.GetProperty("body").GetString());
    }

    [TestMethod]
    public async Task ShouldCreateFeatureRequests()
    {
        var data = new Dictionary<string, string>
        {
            { "title", "[Feature] request 1" },
            { "body", "Feature description" }
        };
        var newIssue = await Request.PostAsync("/repos/" + USER + "/" + REPO + "/issues", new() { DataObject = data });
        await Expect(newIssue).ToBeOKAsync();

        var issues = await Request.GetAsync("/repos/" + USER + "/" + REPO + "/issues");
        await Expect(newIssue).ToBeOKAsync();
        var issuesJsonResponse = await issues.JsonAsync();

        JsonElement? issue = null;
        foreach (JsonElement issueObj in issuesJsonResponse?.EnumerateArray())
        {
            if (issueObj.TryGetProperty("title", out var title) == true)
            {
                if (title.GetString() == "[Feature] request 1")
                {
                    issue = issueObj;
                }
            }
        }
        Assert.IsNotNull(issue);
        Assert.AreEqual("Feature description", issue?.GetProperty("body").GetString());
    }

    [TestInitialize]
    public async Task SetUpAPITesting()
    {
        await CreateAPIRequestContext();
        await CreateTestRepository();
    }

    private async Task CreateAPIRequestContext()
    {
        var headers = new Dictionary<string, string>
        {
            // We set this header per GitHub guidelines.
            { "Accept", "application/vnd.github.v3+json" },
            // Add authorization token to all requests.
            // Assuming personal access token available in the environment.
            { "Authorization", "token " + API_TOKEN }
        };

        Request = await Playwright.APIRequest.NewContextAsync(new()
        {
            // All requests we send go to this API endpoint.
            BaseURL = "https://api.github.com",
            ExtraHTTPHeaders = headers,
        });
    }

    private async Task CreateTestRepository()
    {
        var resp = await Request.PostAsync("/user/repos", new()
        {
            DataObject = new Dictionary<string, string>()
            {
                ["name"] = REPO,
            },
        });
        await Expect(resp).ToBeOKAsync();
    }

    [TestCleanup]
    public async Task TearDownAPITesting()
    {
        await DeleteTestRepository();
        await Request.DisposeAsync();
    }

    private async Task DeleteTestRepository()
    {
        var resp = await Request.DeleteAsync("/repos/" + USER + "/" + REPO);
        await Expect(resp).ToBeOKAsync();
    }
}
```

## Prepare server state via API calls

The following test creates a new issue via API and then navigates to the list of all issues in the
project to check that it appears at the top of the list. The check is performed using [LocatorAssertions].

```csharp
class TestGitHubAPI : PageTest
{
    [TestMethod]
    public async Task LastCreatedIssueShouldBeFirstInTheList()
    {
        var data = new Dictionary<string, string>
        {
            { "title", "[Feature] request 1" },
            { "body", "Feature description" }
        };
        var newIssue = await Request.PostAsync("/repos/" + USER + "/" + REPO + "/issues", new() { DataObject = data });
        await Expect(newIssue).ToBeOKAsync();

        // When inheriting from 'PlaywrightTest' it only gives you a Playwright instance. To get a Page instance, either start
        // a browser, context, and page manually or inherit from 'PageTest' which will launch it for you.
        await Page.GotoAsync("https://github.com/" + USER + "/" + REPO + "/issues");
        var firstIssue = Page.Locator("a[data-hovercard-type='issue']").First;
        await Expect(firstIssue).ToHaveTextAsync("[Feature] request 1");
    }
}
```

## Check the server state after running user actions

The following test creates a new issue via user interface in the browser and then checks via API if
it was created:

```csharp
// Make sure to extend from PageTest if you want to use the Page class.
class GitHubTests : PageTest
{
    [TestMethod]
    public async Task LastCreatedIssueShouldBeOnTheServer()
    {
        await Page.GotoAsync("https://github.com/" + USER + "/" + REPO + "/issues");
        await Page.Locator("text=New Issue").ClickAsync();
        await Page.Locator("[aria-label='Title']").FillAsync("Bug report 1");
        await Page.Locator("[aria-label='Comment body']").FillAsync("Bug description");
        await Page.Locator("text=Submit new issue").ClickAsync();
        var issueId = Page.Url.Substring(Page.Url.LastIndexOf('/'));

        var newIssue = await Request.GetAsync("https://github.com/" + USER + "/" + REPO + "/issues/" + issueId);
        await Expect(newIssue).ToBeOKAsync();
        StringAssert.Contains(await newIssue.TextAsync(), "Bug report 1");
    }
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

```csharp
var requestContext = await Playwright.APIRequest.NewContextAsync(new()
{
    HttpCredentials = new()
    {
        Username = "user",
        Password = "passwd"
    },
});
await requestContext.GetAsync("https://api.example.com/login");
// Save storage state into a variable.
var state = await requestContext.StorageStateAsync();

// Create a new context with the saved storage state.
var context = await Browser.NewContextAsync(new() { StorageState = state });
```

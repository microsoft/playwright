# Example recipes

### [Authentication](authentication.js)

This script logs in on GitHub.com through Chromium, and then reuses the login cookies state in WebKit. This recipe can be used to speed up tests by logging in once and reusing login state.

### [File uploads](upload.js)

This script uploads a file to an `input` element that accepts file uploads.

<!--
Other examples
* Request interception/server response stub/mock
* Geolocation and mobile emulation
* Handling a popup, eg, accept dialog
* Page navigation and wait for load
  * Async page load (see #662)
-->

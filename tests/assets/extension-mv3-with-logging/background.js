console.log("Service worker script loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});
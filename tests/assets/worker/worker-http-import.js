console.log("hello from worker-http-import.js");
importScripts("./import-me.js")
console.log("successfully imported");
self.postMessage("finished");

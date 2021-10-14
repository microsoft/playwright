var hljs = require('./core');

hljs.registerLanguage('javascript', require('./languages/javascript'));
hljs.registerLanguage('python', require('./languages/python'));
hljs.registerLanguage('csharp', require('./languages/csharp'));
hljs.registerLanguage('java', require('./languages/java'));

module.exports = hljs;
var hljs = require('./core');

hljs.registerLanguage('javascript', require('./languages/javascript'));
hljs.registerLanguage('python', require('./languages/python'));
hljs.registerLanguage('csharp', require('./languages/csharp'));

module.exports = hljs;
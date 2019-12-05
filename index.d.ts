import * as chromium from './chromium';
import * as firefox from './firefox';
import * as webkit from './webkit';
declare function pickBrowser(browser: 'chromium'): typeof chromium;
declare function pickBrowser(browser: 'firefox'): typeof firefox;
declare function pickBrowser(browser: 'webkit'): typeof webkit;
export = pickBrowser;
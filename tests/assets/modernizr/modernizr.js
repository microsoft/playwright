(()=>{var j=(e,A)=>()=>(A||e((A={exports:{}}).exports,A),A.exports);var Y=j((exports,module)=>{(function(scriptGlobalObject,window,document,undefined){var tests=[],ModernizrProto={_version:"4.0.0-alpha",_config:{classPrefix:"",enableClasses:!0,enableJSClass:!0,usePrefixes:!0},_q:[],on:function(e,A){var t=this;setTimeout(function(){A(t[e])},0)},addTest:function(e,A,t){tests.push({name:e,fn:A,options:t})},addAsyncTest:function(e){tests.push({name:null,fn:e})}},Modernizr=function(){};Modernizr.prototype=ModernizrProto,Modernizr=new Modernizr;var classes=[];function is(e,A){return typeof e===A}function testRunner(){var e,A,t,r,n,o,a;for(var l in tests)if(tests.hasOwnProperty(l)){if(e=[],A=tests[l],A.name&&(e.push(A.name.toLowerCase()),A.options&&A.options.aliases&&A.options.aliases.length))for(t=0;t<A.options.aliases.length;t++)e.push(A.options.aliases[t].toLowerCase());for(r=is(A.fn,"function")?A.fn():A.fn,n=0;n<e.length;n++)o=e[n],a=o.split("."),a.length===1?Modernizr[a[0]]=r:((!Modernizr[a[0]]||Modernizr[a[0]]&&!(Modernizr[a[0]]instanceof Boolean))&&(Modernizr[a[0]]=new Boolean(Modernizr[a[0]])),Modernizr[a[0]][a[1]]=r),classes.push((r?"":"no-")+a.join("-"))}}var docElement=document.documentElement,isSVG=docElement.nodeName.toLowerCase()==="svg";function setClasses(e){var A=docElement.className,t=Modernizr._config.classPrefix||"";if(isSVG&&(A=A.baseVal),Modernizr._config.enableJSClass){var r=new RegExp("(^|\\s)"+t+"no-js(\\s|$)");A=A.replace(r,"$1"+t+"js$2")}Modernizr._config.enableClasses&&(e.length>0&&(A+=" "+t+e.join(" "+t)),isSVG?docElement.className.baseVal=A:docElement.className=A)}var hasOwnProp;(function(){var e={}.hasOwnProperty;!is(e,"undefined")&&!is(e.call,"undefined")?hasOwnProp=function(A,t){return e.call(A,t)}:hasOwnProp=function(A,t){return t in A&&is(A.constructor.prototype[t],"undefined")}})(),ModernizrProto._l={},ModernizrProto.on=function(e,A){this._l[e]||(this._l[e]=[]),this._l[e].push(A),Modernizr.hasOwnProperty(e)&&setTimeout(function(){Modernizr._trigger(e,Modernizr[e])},0)},ModernizrProto._trigger=function(e,A){if(this._l[e]){var t=this._l[e];setTimeout(function(){var r,n;for(r=0;r<t.length;r++)n=t[r],n(A)},0),delete this._l[e]}};function addTest(e,A){if(typeof e=="object")for(var t in e)hasOwnProp(e,t)&&addTest(t,e[t]);else{e=e.toLowerCase();var r=e.split("."),n=Modernizr[r[0]];if(r.length===2&&(n=n[r[1]]),typeof n<"u")return Modernizr;A=typeof A=="function"?A():A,r.length===1?Modernizr[r[0]]=A:(Modernizr[r[0]]&&!(Modernizr[r[0]]instanceof Boolean)&&(Modernizr[r[0]]=new Boolean(Modernizr[r[0]])),Modernizr[r[0]][r[1]]=A),setClasses([(A&&A!==!1?"":"no-")+r.join("-")]),Modernizr._trigger(e,A)}return Modernizr}Modernizr._q.push(function(){ModernizrProto.addTest=addTest});var omPrefixes="Moz O ms Webkit",cssomPrefixes=ModernizrProto._config.usePrefixes?omPrefixes.split(" "):[];ModernizrProto._cssomPrefixes=cssomPrefixes;var atRule=function(e){var A=prefixes.length,t=window.CSSRule,r;if(typeof t>"u")return undefined;if(!e)return!1;if(e=e.replace(/^@/,""),r=e.replace(/-/g,"_").toUpperCase()+"_RULE",r in t)return"@"+e;for(var n=0;n<A;n++){var o=prefixes[n],a=o.toUpperCase()+"_"+r;if(a in t)return"@-"+o.toLowerCase()+"-"+e}return!1};ModernizrProto.atRule=atRule;var domPrefixes=ModernizrProto._config.usePrefixes?omPrefixes.toLowerCase().split(" "):[];ModernizrProto._domPrefixes=domPrefixes;function createElement(){return typeof document.createElement!="function"?document.createElement(arguments[0]):isSVG?document.createElementNS.call(document,"http://www.w3.org/2000/svg",arguments[0]):document.createElement.apply(document,arguments)}var hasEvent=function(){var e=!("onblur"in docElement);function A(t,r){var n;return t?((!r||typeof r=="string")&&(r=createElement(r||"div")),t="on"+t,n=t in r,!n&&e&&(r.setAttribute||(r=createElement("div")),r.setAttribute(t,""),n=typeof r[t]=="function",r[t]!==undefined&&(r[t]=undefined),r.removeAttribute(t)),n):!1}return A}();ModernizrProto.hasEvent=hasEvent;var html5;if(!isSVG){(function(e,A){var t="3.7.3",r=e.html5||{},n=/^<|^(?:button|map|select|textarea|object|iframe|option|optgroup)$/i,o=/^(?:a|b|code|div|fieldset|h1|h2|h3|h4|h5|h6|i|label|li|ol|p|q|span|strong|style|table|tbody|td|th|tr|ul)$/i,a,l="_html5shiv",s=0,f={},u;(function(){try{var d=A.createElement("a");d.innerHTML="<xyz></xyz>",a="hidden"in d,u=d.childNodes.length==1||function(){A.createElement("a");var c=A.createDocumentFragment();return typeof c.cloneNode>"u"||typeof c.createDocumentFragment>"u"||typeof c.createElement>"u"}()}catch{a=!0,u=!0}})();function m(d,c){var p=d.createElement("p"),w=d.getElementsByTagName("head")[0]||d.documentElement;return p.innerHTML="x<style>"+c+"</style>",w.insertBefore(p.lastChild,w.firstChild)}function g(){var d=h.elements;return typeof d=="string"?d.split(" "):d}function P(d,c){var p=h.elements;typeof p!="string"&&(p=p.join(" ")),typeof d!="string"&&(d=d.join(" ")),h.elements=p+" "+d,z(c)}function M(d){var c=f[d[l]];return c||(c={},s++,d[l]=s,f[s]=c),c}function b(d,c,p){if(c||(c=A),u)return c.createElement(d);p||(p=M(c));var w;return p.cache[d]?w=p.cache[d].cloneNode():o.test(d)?w=(p.cache[d]=p.createElem(d)).cloneNode():w=p.createElem(d),w.canHaveChildren&&!n.test(d)&&!w.tagUrn?p.frag.appendChild(w):w}function k(d,c){if(d||(d=A),u)return d.createDocumentFragment();c=c||M(d);for(var p=c.frag.cloneNode(),w=0,v=g(),E=v.length;w<E;w++)p.createElement(v[w]);return p}function q(d,c){c.cache||(c.cache={},c.createElem=d.createElement,c.createFrag=d.createDocumentFragment,c.frag=c.createFrag()),d.createElement=function(p){return h.shivMethods?b(p,d,c):c.createElem(p)},d.createDocumentFragment=Function("h,f","return function(){var n=f.cloneNode(),c=n.createElement;h.shivMethods&&("+g().join().replace(/[\w\-:]+/g,function(p){return c.createElem(p),c.frag.createElement(p),'c("'+p+'")'})+");return n}")(h,c.frag)}function z(d){d||(d=A);var c=M(d);return h.shivCSS&&!a&&!c.hasCSS&&(c.hasCSS=!!m(d,"article,aside,dialog,figcaption,figure,footer,header,hgroup,main,nav,section{display:block}mark{background:#FF0;color:#000}template{display:none}")),u||q(d,c),d}var h={elements:r.elements||"abbr article aside audio bdi canvas data datalist details dialog figcaption figure footer header hgroup main mark meter nav output picture progress section summary template time video",version:t,shivCSS:r.shivCSS!==!1,supportsUnknownElements:u,shivMethods:r.shivMethods!==!1,type:"default",shivDocument:z,createElement:b,createDocumentFragment:k,addElements:P};e.html5=h,z(A);var U=/^$|\b(?:all|print)\b/,T="html5shiv",V=!u&&function(){var d=A.documentElement;return!(typeof A.namespaces>"u"||typeof A.parentWindow>"u"||typeof d.applyElement>"u"||typeof d.removeNode>"u"||typeof e.attachEvent>"u")}();function F(d){for(var c,p=d.getElementsByTagName("*"),w=p.length,v=RegExp("^(?:"+g().join("|")+")$","i"),E=[];w--;)c=p[w],v.test(c.nodeName)&&E.push(c.applyElement(W(c)));return E}function W(d){for(var c,p=d.attributes,w=p.length,v=d.ownerDocument.createElement(T+":"+d.nodeName);w--;)c=p[w],c.specified&&v.setAttribute(c.nodeName,c.nodeValue);return v.style.cssText=d.style.cssText,v}function G(d){for(var c,p=d.split("{"),w=p.length,v=RegExp("(^|[\\s,>+~])("+g().join("|")+")(?=[[\\s,>+~#.:]|$)","gi"),E="$1"+T+"\\:$2";w--;)c=p[w]=p[w].split("}"),c[c.length-1]=c[c.length-1].replace(v,E),p[w]=c.join("}");return p.join("{")}function Z(d){for(var c=d.length;c--;)d[c].removeNode()}function S(d){var c,p,w=M(d),v=d.namespaces,E=d.parentWindow;if(!V||d.printShived)return d;typeof v[T]>"u"&&v.add(T);function I(){clearTimeout(w._removeSheetTimer),c&&c.removeNode(!0),c=null}return E.attachEvent("onbeforeprint",function(){I();for(var Q,x,D,R=d.styleSheets,B=[],y=R.length,C=Array(y);y--;)C[y]=R[y];for(;D=C.pop();)if(!D.disabled&&U.test(D.media)){try{Q=D.imports,x=Q.length}catch{x=0}for(y=0;y<x;y++)C.push(Q[y]);try{B.push(D.cssText)}catch{}}B=G(B.reverse().join("")),p=F(d),c=m(d,B)}),E.attachEvent("onafterprint",function(){Z(p),clearTimeout(w._removeSheetTimer),w._removeSheetTimer=setTimeout(I,500)}),d.printShived=!0,d}h.type+=" print",h.shivPrint=S,S(A),typeof module=="object"&&module.exports&&(module.exports=h)})(typeof window<"u"?window:this,document)}var err=function(){},warn=function(){};window.console&&(err=function(){var e=console.error?"error":"log";window.console[e].apply(window.console,Array.prototype.slice.call(arguments))},warn=function(){var e=console.warn?"warn":"log";window.console[e].apply(window.console,Array.prototype.slice.call(arguments))}),ModernizrProto.load=function(){"yepnope"in window?(warn(`yepnope.js (aka Modernizr.load) is no longer included as part of Modernizr. yepnope appears to be available on the page, so we\u2019ll use it to handle this call to Modernizr.load, but please update your code to use yepnope directly.
 See http://github.com/Modernizr/Modernizr/issues/1182 for more information.`),window.yepnope.apply(window,[].slice.call(arguments,0))):err("yepnope.js (aka Modernizr.load) is no longer included as part of Modernizr. Get it from http://yepnopejs.com. See http://github.com/Modernizr/Modernizr/issues/1182 for more information.")};function getBody(){var e=document.body;return e||(e=createElement(isSVG?"svg":"body"),e.fake=!0),e}function injectElementWithStyles(e,A,t,r){var n="modernizr",o,a,l,s,f=createElement("div"),u=getBody();if(parseInt(t,10))for(;t--;)l=createElement("div"),l.id=r?r[t]:n+(t+1),f.appendChild(l);return o=createElement("style"),o.type="text/css",o.id="s"+n,(u.fake?u:f).appendChild(o),u.appendChild(f),o.styleSheet?o.styleSheet.cssText=e:o.appendChild(document.createTextNode(e)),f.id=n,u.fake&&(u.style.background="",u.style.overflow="hidden",s=docElement.style.overflow,docElement.style.overflow="hidden",docElement.appendChild(u)),a=A(f,e),u.fake&&u.parentNode?(u.parentNode.removeChild(u),docElement.style.overflow=s,docElement.offsetHeight):f.parentNode.removeChild(f),!!a}function computedStyle(e,A,t){var r;if("getComputedStyle"in window){r=getComputedStyle.call(window,e,A);var n=window.console;if(r!==null)t&&(r=r.getPropertyValue(t));else if(n){var o=n.error?"error":"log";n[o].call(n,"getComputedStyle returning null, its possible modernizr test results are inaccurate")}}else r=!A&&e.currentStyle&&e.currentStyle[t];return r}var mq=function(){var e=window.matchMedia||window.msMatchMedia;return e?function(A){var t=e(A);return t&&t.matches||!1}:function(A){var t=!1;return injectElementWithStyles("@media "+A+" { #modernizr { position: absolute; } }",function(r){t=computedStyle(r,null,"position")==="absolute"}),t}}();ModernizrProto.mq=mq;function contains(e,A){return!!~(""+e).indexOf(A)}var modElem={elem:createElement("modernizr")};Modernizr._q.push(function(){delete modElem.elem});var mStyle={style:modElem.elem.style};Modernizr._q.unshift(function(){delete mStyle.style});function domToCSS(e){return e.replace(/([A-Z])/g,function(A,t){return"-"+t.toLowerCase()}).replace(/^ms-/,"-ms-")}function nativeTestProps(e,A){var t=e.length;if("CSS"in window&&"supports"in window.CSS){for(;t--;)if(window.CSS.supports(domToCSS(e[t]),A))return!0;return!1}else if("CSSSupportsRule"in window){for(var r=[];t--;)r.push("("+domToCSS(e[t])+":"+A+")");return r=r.join(" or "),injectElementWithStyles("@supports ("+r+") { #modernizr { position: absolute; } }",function(n){return computedStyle(n,null,"position")==="absolute"})}return undefined}function cssToDOM(e){return e.replace(/([a-z])-([a-z])/g,function(A,t,r){return t+r.toUpperCase()}).replace(/^-/,"")}function testProps(e,A,t,r){if(r=is(r,"undefined")?!1:r,!is(t,"undefined")){var n=nativeTestProps(e,t);if(!is(n,"undefined"))return n}for(var o,a,l,s,f,u=["modernizr","tspan","samp"];!mStyle.style&&u.length;)o=!0,mStyle.modElem=createElement(u.shift()),mStyle.style=mStyle.modElem.style;function m(){o&&(delete mStyle.style,delete mStyle.modElem)}for(l=e.length,a=0;a<l;a++)if(s=e[a],f=mStyle.style[s],contains(s,"-")&&(s=cssToDOM(s)),mStyle.style[s]!==undefined)if(!r&&!is(t,"undefined")){try{mStyle.style[s]=t}catch{}if(mStyle.style[s]!==f)return m(),A==="pfx"?s:!0}else return m(),A==="pfx"?s:!0;return m(),!1}function fnBind(e,A){return function(){return e.apply(A,arguments)}}function testDOMProps(e,A,t){var r;for(var n in e)if(e[n]in A)return t===!1?e[n]:(r=A[e[n]],is(r,"function")?fnBind(r,t||A):r);return!1}function testPropsAll(e,A,t,r,n){var o=e.charAt(0).toUpperCase()+e.slice(1),a=(e+" "+cssomPrefixes.join(o+" ")+o).split(" ");return is(A,"string")||is(A,"undefined")?testProps(a,A,r,n):(a=(e+" "+domPrefixes.join(o+" ")+o).split(" "),testDOMProps(a,A,t))}ModernizrProto.testAllProps=testPropsAll;var prefixed=ModernizrProto.prefixed=function(e,A,t){return e.indexOf("@")===0?atRule(e):(e.indexOf("-")!==-1&&(e=cssToDOM(e)),A?testPropsAll(e,A,t):testPropsAll(e,"pfx"))},prefixes=ModernizrProto._config.usePrefixes?" -webkit- -moz- -o- -ms- ".split(" "):["",""];ModernizrProto._prefixes=prefixes;var prefixedCSS=ModernizrProto.prefixedCSS=function(e){var A=prefixed(e);return A&&domToCSS(A)};function testAllProps(e,A,t){return testPropsAll(e,undefined,undefined,A,t)}ModernizrProto.testAllProps=testAllProps;var testProp=ModernizrProto.testProp=function(e,A,t){return testProps([e],undefined,A,t)},testStyles=ModernizrProto.testStyles=injectElementWithStyles;Modernizr.addTest("adownload",!window.externalHost&&"download"in createElement("a"));Modernizr.addTest("aping",!window.externalHost&&"ping"in createElement("a"));Modernizr.addTest("areaping",!window.externalHost&&"ping"in createElement("area"));Modernizr.addTest("ambientlight",hasEvent("devicelight",window));Modernizr.addTest("applicationcache","applicationCache"in window);(function(){var e=createElement("audio");Modernizr.addTest("audio",function(){var A=!1;try{A=!!e.canPlayType,A&&(A=new Boolean(A))}catch{}return A});try{e.canPlayType&&(Modernizr.addTest("audio.ogg",e.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/,"")),Modernizr.addTest("audio.mp3",e.canPlayType('audio/mpeg; codecs="mp3"').replace(/^no$/,"")),Modernizr.addTest("audio.opus",e.canPlayType('audio/ogg; codecs="opus"')||e.canPlayType('audio/webm; codecs="opus"').replace(/^no$/,"")),Modernizr.addTest("audio.wav",e.canPlayType('audio/wav; codecs="1"').replace(/^no$/,"")),Modernizr.addTest("audio.m4a",(e.canPlayType("audio/x-m4a;")||e.canPlayType("audio/aac;")).replace(/^no$/,"")))}catch{}})();Modernizr.addAsyncTest(function(){var e,A=200,t=5,r=0,n=createElement("audio"),o=n.style;function a(l){r++,clearTimeout(e);var s=l&&l.type==="playing"||n.currentTime!==0;if(!s&&r<t){e=setTimeout(a,A);return}n.removeEventListener("playing",a,!1),addTest("audioautoplay",s),n.parentNode&&n.parentNode.removeChild(n)}if(!Modernizr.audio||!("autoplay"in n)){addTest("audioautoplay",!1);return}o.position="absolute",o.height=0,o.width=0;try{if(Modernizr.audio.mp3)n.src="data:audio/mpeg;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8Ir/JGq3/+MYxDsLIj5QMYcoAP0dv9HIjUcH//yYSg+CIbkGP//8w0bLVjUP///3Z0x5QCAv/yLjwtGKTEFNRTMuOTeqqqqqqqqqqqqq/+MYxEkNmdJkUYc4AKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";else if(Modernizr.audio.wav)n.src="data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAEAAAABAAAAABAAgAZGF0YRAAAAB/f39/f39/f39/f39/f39/";else{addTest("audioautoplay",!1);return}}catch{addTest("audioautoplay",!1);return}n.setAttribute("autoplay",""),o.cssText="display:none",docElement.appendChild(n),setTimeout(function(){n.addEventListener("playing",a,!1),e=setTimeout(a,A)},0)});Modernizr.addTest("audioloop","loop"in createElement("audio"));Modernizr.addAsyncTest(function(){var e,A=300,t=createElement("audio"),r=t.style;function n(o){clearTimeout(e);var a=o!==undefined&&o.type==="loadeddata";t.removeEventListener("loadeddata",n,!1),addTest("audiopreload",a),t.parentNode&&t.parentNode.removeChild(t)}if(!Modernizr.audio||!("preload"in t)){addTest("audiopreload",!1);return}r.position="absolute",r.height=0,r.width=0;try{if(Modernizr.audio.mp3)t.src="data:audio/mpeg;base64,//MUxAAB6AXgAAAAAPP+c6nf//yi/6f3//MUxAMAAAIAAAjEcH//0fTX6C9Lf//0//MUxA4BeAIAAAAAAKX2/6zv//+IlR4f//MUxBMCMAH8AAAAABYWalVMQU1FMy45//MUxBUB0AH0AAAAADkuM1VVVVVVVVVV//MUxBgBUATowAAAAFVVVVVVVVVVVVVV";else if(Modernizr.audio.m4a)t.src="data:audio/x-m4a;base64,AAAAGGZ0eXBNNEEgAAACAGlzb21pc28yAAAACGZyZWUAAAAfbWRhdN4EAABsaWJmYWFjIDEuMjgAAAFoAQBHAAACiG1vb3YAAABsbXZoZAAAAAB8JbCAfCWwgAAAA+gAAAAYAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAG0dHJhawAAAFx0a2hkAAAAD3wlsIB8JbCAAAAAAQAAAAAAAAAYAAAAAAAAAAAAAAAAAQAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAABUG1kaWEAAAAgbWRoZAAAAAB8JbCAfCWwgAAArEQAAAQAVcQAAAAAAC1oZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAPttaW5mAAAAEHNtaGQAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAL9zdGJsAAAAW3N0c2QAAAAAAAAAAQAAAEttcDRhAAAAAAAAAAEAAAAAAAAAAAACABAAAAAArEQAAAAAACdlc2RzAAAAAAMZAAEABBFAFQAAAAABftAAAAAABQISCAYBAgAAABhzdHRzAAAAAAAAAAEAAAABAAAEAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAAXAAAAAQAAABRzdGNvAAAAAAAAAAEAAAAoAAAAYHVkdGEAAABYbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAraWxzdAAAACOpdG9vAAAAG2RhdGEAAAABAAAAAExhdmY1Mi42NC4y";else if(Modernizr.audio.ogg)t.src="data:audio/ogg;base64,T2dnUwACAAAAAAAAAAD/QwAAAAAAAM2LVKsBHgF2b3JiaXMAAAAAAUSsAAAAAAAAgLsAAAAAAAC4AU9nZ1MAAAAAAAAAAAAA/0MAAAEAAADmvOe6Dy3/////////////////MgN2b3JiaXMdAAAAWGlwaC5PcmcgbGliVm9yYmlzIEkgMjAwNzA2MjIAAAAAAQV2b3JiaXMfQkNWAQAAAQAYY1QpRplS0kqJGXOUMUaZYpJKiaWEFkJInXMUU6k515xrrLm1IIQQGlNQKQWZUo5SaRljkCkFmVIQS0kldBI6J51jEFtJwdaYa4tBthyEDZpSTCnElFKKQggZU4wpxZRSSkIHJXQOOuYcU45KKEG4nHOrtZaWY4updJJK5yRkTEJIKYWSSgelU05CSDWW1lIpHXNSUmpB6CCEEEK2IIQNgtCQVQAAAQDAQBAasgoAUAAAEIqhGIoChIasAgAyAAAEoCiO4iiOIzmSY0kWEBqyCgAAAgAQAADAcBRJkRTJsSRL0ixL00RRVX3VNlVV9nVd13Vd13UgNGQVAAABAEBIp5mlGiDCDGQYCA1ZBQAgAAAARijCEANCQ1YBAAABAABiKDmIJrTmfHOOg2Y5aCrF5nRwItXmSW4q5uacc845J5tzxjjnnHOKcmYxaCa05pxzEoNmKWgmtOacc57E5kFrqrTmnHPGOaeDcUYY55xzmrTmQWo21uaccxa0pjlqLsXmnHMi5eZJbS7V5pxzzjnnnHPOOeecc6oXp3NwTjjnnHOi9uZabkIX55xzPhmne3NCOOecc84555xzzjnnnHOC0JBVAAAQAABBGDaGcacgSJ+jgRhFiGnIpAfdo8MkaAxyCqlHo6ORUuoglFTGSSmdIDRkFQAACAAAIYQUUkghhRRSSCGFFFKIIYYYYsgpp5yCCiqppKKKMsoss8wyyyyzzDLrsLPOOuwwxBBDDK20EktNtdVYY62555xrDtJaaa211koppZRSSikIDVkFAIAAABAIGWSQQUYhhRRSiCGmnHLKKaigAkJDVgEAgAAAAgAAADzJc0RHdERHdERHdERHdETHczxHlERJlERJtEzL1ExPFVXVlV1b1mXd9m1hF3bd93Xf93Xj14VhWZZlWZZlWZZlWZZlWZZlWYLQkFUAAAgAAIAQQgghhRRSSCGlGGPMMeegk1BCIDRkFQAACAAgAAAAwFEcxXEkR3IkyZIsSZM0S7M8zdM8TfREURRN01RFV3RF3bRF2ZRN13RN2XRVWbVdWbZt2dZtX5Zt3/d93/d93/d93/d93/d1HQgNWQUASAAA6EiOpEiKpEiO4ziSJAGhIasAABkAAAEAKIqjOI7jSJIkSZakSZ7lWaJmaqZneqqoAqEhqwAAQAAAAQAAAAAAKJriKabiKaLiOaIjSqJlWqKmaq4om7Lruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7rui4QGrIKAJAAANCRHMmRHEmRFEmRHMkBQkNWAQAyAAACAHAMx5AUybEsS9M8zdM8TfRET/RMTxVd0QVCQ1YBAIAAAAIAAAAAADAkw1IsR3M0SZRUS7VUTbVUSxVVT1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTVN0zRNIDRkJQAABADAYo3B5SAhJSXl3hDCEJOeMSYhtV4hBJGS3jEGFYOeMqIMct5C4xCDHggNWREARAEAAMYgxxBzyDlHqZMSOeeodJQa5xyljlJnKcWYYs0oldhSrI1zjlJHraOUYiwtdpRSjanGAgAAAhwAAAIshEJDVgQAUQAAhDFIKaQUYow5p5xDjCnnmHOGMeYcc44556B0UirnnHROSsQYc445p5xzUjonlXNOSiehAACAAAcAgAALodCQFQFAnACAQZI8T/I0UZQ0TxRFU3RdUTRd1/I81fRMU1U90VRVU1Vt2VRVWZY8zzQ901RVzzRV1VRVWTZVVZZFVdVt03V123RV3ZZt2/ddWxZ2UVVt3VRd2zdV1/Zd2fZ9WdZ1Y/I8VfVM03U903Rl1XVtW3VdXfdMU5ZN15Vl03Vt25VlXXdl2fc103Rd01Vl2XRd2XZlV7ddWfZ903WF35VlX1dlWRh2XfeFW9eV5XRd3VdlVzdWWfZ9W9eF4dZ1YZk8T1U903RdzzRdV3VdX1dd19Y105Rl03Vt2VRdWXZl2fddV9Z1zzRl2XRd2zZdV5ZdWfZ9V5Z13XRdX1dlWfhVV/Z1WdeV4dZt4Tdd1/dVWfaFV5Z14dZ1Ybl1XRg+VfV9U3aF4XRl39eF31luXTiW0XV9YZVt4VhlWTl+4ViW3feVZXRdX1ht2RhWWRaGX/id5fZ943h1XRlu3efMuu8Mx++k+8rT1W1jmX3dWWZfd47hGDq/8OOpqq+brisMpywLv+3rxrP7vrKMruv7qiwLvyrbwrHrvvP8vrAso+z6wmrLwrDatjHcvm4sv3Acy2vryjHrvlG2dXxfeArD83R1XXlmXcf2dXTjRzh+ygAAgAEHAIAAE8pAoSErAoA4AQCPJImiZFmiKFmWKIqm6LqiaLqupGmmqWmeaVqaZ5qmaaqyKZquLGmaaVqeZpqap5mmaJqua5qmrIqmKcumasqyaZqy7LqybbuubNuiacqyaZqybJqmLLuyq9uu7Oq6pFmmqXmeaWqeZ5qmasqyaZquq3meanqeaKqeKKqqaqqqraqqLFueZ5qa6KmmJ4qqaqqmrZqqKsumqtqyaaq2bKqqbbuq7Pqybeu6aaqybaqmLZuqatuu7OqyLNu6L2maaWqeZ5qa55mmaZqybJqqK1uep5qeKKqq5ommaqqqLJumqsqW55mqJ4qq6omea5qqKsumatqqaZq2bKqqLZumKsuubfu+68qybqqqbJuqauumasqybMu+78qq7oqmKcumqtqyaaqyLduy78uyrPuiacqyaaqybaqqLsuybRuzbPu6aJqybaqmLZuqKtuyLfu6LNu678qub6uqrOuyLfu67vqucOu6MLyybPuqrPq6K9u6b+sy2/Z9RNOUZVM1bdtUVVl2Zdn2Zdv2fdE0bVtVVVs2TdW2ZVn2fVm2bWE0Tdk2VVXWTdW0bVmWbWG2ZeF2Zdm3ZVv2ddeVdV/XfePXZd3murLty7Kt+6qr+rbu+8Jw667wCgAAGHAAAAgwoQwUGrISAIgCAACMYYwxCI1SzjkHoVHKOecgZM5BCCGVzDkIIZSSOQehlJQy5yCUklIIoZSUWgshlJRSawUAABQ4AAAE2KApsThAoSErAYBUAACD41iW55miatqyY0meJ4qqqaq27UiW54miaaqqbVueJ4qmqaqu6+ua54miaaqq6+q6aJqmqaqu67q6Lpqiqaqq67qyrpumqqquK7uy7Oumqqqq68quLPvCqrquK8uybevCsKqu68qybNu2b9y6ruu+7/vCka3rui78wjEMRwEA4AkOAEAFNqyOcFI0FlhoyEoAIAMAgDAGIYMQQgYhhJBSSiGllBIAADDgAAAQYEIZKDRkRQAQJwAAGEMppJRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkgppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkqppJRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoplVJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSCgCQinAAkHowoQwUGrISAEgFAACMUUopxpyDEDHmGGPQSSgpYsw5xhyUklLlHIQQUmktt8o5CCGk1FJtmXNSWosx5hgz56SkFFvNOYdSUoux5ppr7qS0VmuuNedaWqs115xzzbm0FmuuOdecc8sx15xzzjnnGHPOOeecc84FAOA0OACAHtiwOsJJ0VhgoSErAYBUAAACGaUYc8456BBSjDnnHIQQIoUYc845CCFUjDnnHHQQQqgYc8w5CCGEkDnnHIQQQgghcw466CCEEEIHHYQQQgihlM5BCCGEEEooIYQQQgghhBA6CCGEEEIIIYQQQgghhFJKCCGEEEIJoZRQAABggQMAQIANqyOcFI0FFhqyEgAAAgCAHJagUs6EQY5Bjw1BylEzDUJMOdGZYk5qMxVTkDkQnXQSGWpB2V4yCwAAgCAAIMAEEBggKPhCCIgxAABBiMwQCYVVsMCgDBoc5gHAA0SERACQmKBIu7iALgNc0MVdB0IIQhCCWBxAAQk4OOGGJ97whBucoFNU6iAAAAAAAAwA4AEA4KAAIiKaq7C4wMjQ2ODo8AgAAAAAABYA+AAAOD6AiIjmKiwuMDI0Njg6PAIAAAAAAAAAAICAgAAAAAAAQAAAAICAT2dnUwAE7AwAAAAAAAD/QwAAAgAAADuydfsFAQEBAQEACg4ODg==";else if(Modernizr.audio.wav)t.src="data:audio/wav;base64,UklGRvwZAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YdgZAAAAAAEA/v8CAP//AAABAP////8DAPz/BAD9/wEAAAAAAAAAAAABAP7/AgD//wAAAQD//wAAAQD//wAAAQD+/wIA//8AAAAAAAD//wIA/v8BAAAA//8BAAAA//8BAP//AQAAAP//AQD//wEAAAD//wEA//8BAP//AQD//wEA//8BAP//AQD+/wMA/f8DAP3/AgD+/wIA/////wMA/f8CAP7/AgD+/wMA/f8CAP7/AgD//wAAAAAAAAAAAQD+/wIA/v8CAP7/AwD9/wIA/v8BAAEA/v8CAP7/AQAAAAAAAAD//wEAAAD//wIA/f8DAP7/AQD//wEAAAD//wEA//8CAP7/AQD//wIA/v8CAP7/AQAAAAAAAAD//wEAAAAAAAAA//8BAP//AgD9/wQA+/8FAPz/AgAAAP//AgD+/wEAAAD//wIA/v8CAP3/BAD8/wQA/P8DAP7/AwD8/wQA/P8DAP7/AQAAAAAA//8BAP//AgD+/wEAAAD//wIA/v8BAP//AQD//wEAAAD//wEA//8BAAAAAAAAAP//AgD+/wEAAAAAAAAAAAD//wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AgD+/wIA/v8BAP//AQABAP7/AQD//wIA/v8CAP3/AwD/////AgD9/wMA/v8BAP//AQAAAP//AQD//wEA//8BAP//AAABAP//AAABAP//AQD//wAAAAACAP3/AwD9/wIA//8BAP//AQD//wEA//8BAP//AgD9/wMA/v8AAAIA/f8CAAAA/v8EAPv/BAD9/wIAAAD+/wQA+v8HAPr/BAD+/wEAAAD//wIA/f8EAPz/BAD7/wUA/P8EAPz/AwD+/wEAAAD//wEAAAAAAP//AgD8/wUA+/8FAPz/AwD9/wIA//8AAAEA/v8CAP//AQD//wAAAAABAP//AgD9/wMA/f8EAPz/AwD+/wAAAwD7/wUA/P8DAP7/AQAAAP//AgD+/wEAAQD+/wIA/v8BAAEA/v8CAP7/AQAAAP//AgD9/wMA/f8DAP7/AgD+/wEAAAAAAAEA//8AAAEA/v8DAP3/AgD//wEA//8BAP7/AwD9/wMA/v8BAP//AQAAAP//AgD9/wMA/v8BAP//AQAAAP//AgD+/wEAAQD+/wIA/////wIA//8AAAEA/f8DAP//AAABAP////8DAP3/AwD+/wEA//8BAP//AQAAAAAA//8BAP//AQD//wEA//8BAP//AAAAAAEA//8BAP7/AgD//wEA//8AAAAAAAAAAAAAAAD//wIA/v8BAAAA//8BAAEA/v8BAAAA//8DAPz/AwD+/wIA/v8CAP3/AwD+/wEAAAD//wEA//8BAAAA//8BAAAA/v8EAPv/BAD+/wAAAAABAP7/AgD//wAAAAABAP7/AgD//wAAAAAAAAAAAAABAP3/BAD8/wQA/f8BAAAAAAABAP7/AgD+/wIA/v8CAP7/AgD+/wIA/v8BAAAAAAD//wIA/f8DAP7/AAABAP//AAACAPz/BAD9/wIA//8AAP//AwD9/wMA/P8EAP3/AwD9/wIA//8BAP//AQD+/wMA/f8DAP7/AAABAP//AQAAAP//AQD//wIA/f8DAP7/AQAAAP//AQAAAAAA//8CAP7/AQABAP7/AgD+/wEAAQD+/wIA/v8CAP////8CAP7/AgD//wAAAAABAP7/AwD9/wIAAAD+/wMA/f8CAP//AQD+/wMA/f8CAP//AAACAPz/BQD6/wUA/v///wIA/v8CAP3/BAD7/wYA+v8FAPz/AwD/////AgD+/wEAAAD//wEAAAD//wIA/f8DAP7/AQAAAP//AgD//wAA//8BAAAAAAAAAP//AQD//wEA//8AAAIA/f8DAP3/AgAAAP//AQD//wEA//8AAAEA//8BAP////8CAP//AAABAP3/BAD9/wIA/v8BAAEA//8BAP7/AgD//wEA//8AAAEA//8BAP//AAAAAAEA//8BAP7/AgD//wEA//8AAAAAAQD+/wIA/v8BAAAAAAD//wIA/v8BAAAAAAAAAAAAAQD+/wMA/f8CAP//AQD//wIA/f8DAP7/AQD//wEA//8CAP7/AAABAP7/AwD9/wMA/v8AAAEA//8BAAAAAAD//wIA/v8BAAAA//8CAP7/AgD+/wEA//8CAP7/AgD//wAAAAAAAAAAAQD//wEA/v8DAPz/BQD8/wIA//8AAAEAAAD//wEA//8BAP//AQAAAAAA//8BAP//AgD+/wEAAAAAAP//AQD+/wMA/////wEA/v8CAP//AQD//wEA//8AAAEA//8BAAAA/v8EAPz/AwD+/wEAAAAAAAAA//8CAP7/AQD//wEA//8BAP//AAABAP7/AwD9/wIA//8BAP//AQD//wEA//8AAAEA/v8EAPv/BAD9/wIA//8BAP7/AwD9/wIA//8AAAEA//8BAP//AQD//wAAAQD//wEAAAD+/wMA/v8AAAIA/f8DAP7/AQD//wAAAQD+/wMA/f8CAP//AAABAP7/AgD+/wMA/f8CAP7/AQABAP7/AgD+/wIA/v8CAP7/AwD8/wMA//8AAAEA//8AAAAAAAABAP//AQD//wAAAQD//wIA/f8DAP3/AwD+/wAAAgD9/wIA//8AAAEAAAD+/wMA/P8FAPv/BAD9/wIA//8AAP//AgD+/wIA/v8BAAAAAAD//wEAAAAAAP//AQD//wEA//8BAP//AAABAP7/AwD9/wIA//8BAP//AAABAP//AQD//wAAAQD//wEA//8BAP//AAABAAAA//8BAP7/AwD9/wMA/f8DAP3/AgD//wEA//8BAP7/AgD//wAAAgD8/wQA/f8CAP//AQD+/wMA/f8CAP7/AgD//wAAAAAAAAAAAAABAP7/AwD9/wIA/v8DAP3/AwD9/wIA/v8DAPz/BQD7/wQA/f8CAP7/AwD9/wMA/f8CAP//AQAAAP7/AwD+/wEA//8AAAEAAAAAAP//AAABAP//AQAAAP7/AwD9/wMA/f8CAP//AQD//wEA//8AAAIA/f8CAAAA//8BAAAA//8BAAAA/v8EAPv/BAD9/wIA//8AAAEA/v8CAP//AAABAP//AAABAP//AAABAP7/AwD8/wQA/f8CAAAA/v8DAP3/AwD9/wMA/v8BAAAA//8BAAAA//8CAP7/AQAAAAAAAAAAAAAA//8CAP7/AgD+/wIA/v8CAP7/AgD//wAAAQD//wAAAQD//wAAAQD//wAAAQD+/wIA//8AAAAAAQD+/wMA/f8CAP//AQD//wEA//8AAAEA/v8DAP3/AgD//wAAAAABAP7/AwD9/wIA//8AAAEA/v8DAP3/AgD//wAAAAABAP7/AwD8/wMA/v8CAP//AAD//wIA/v8CAP7/AQABAP7/AQAAAP//AgD/////AQD//wEAAAD//wEA/v8EAPv/BAD9/wMA/v8BAAAA//8BAAEA/P8GAPr/BQD8/wMA/v8BAAAA//8CAP7/AQABAP3/BAD7/wYA+/8EAPz/AwD//wEA//8BAP7/BAD8/wMA/v8AAAIA/v8BAAAA//8BAAAA//8BAAAA//8CAP3/AwD+/wAAAgD8/wUA/P8DAP7/AAABAAAAAAD//wEAAAD//wIA/f8DAP7/AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAEA/f8EAPz/AwD/////AgD+/wIA/f8DAP7/AgD+/wEA//8CAP7/AQD//wEAAAAAAP//AQAAAP//AgD9/wMA/v8BAAAA//8BAP//AQAAAP//AAACAP3/BAD7/wQA/v8BAAAA//8BAP//AQAAAP//AQAAAP7/BAD7/wUA+/8EAP3/AgD//wAAAQD+/wIA//8AAAEA/v8CAP//AQD+/wEAAAAAAAAAAAD//wEA//8CAP3/AwD9/wIA//8AAAAAAAAAAAAA//8BAP//AgD+/wEA//8CAP7/AQAAAP//AgD/////AgD/////AgD+/wIA//8AAP//AQABAP7/AgD9/wMA/v8CAP////8BAAAAAAAAAAAA//8CAP////8DAPz/AwD+/wEAAAAAAP//AQD//wEAAAD//wEAAAD+/wQA+/8FAPz/AgAAAP//AgD9/wMA/v8BAAAAAAD//wEAAAD//wIA/v8BAAAAAAD//wIA/v8BAAAA//8BAAAA//8CAP7/AQD//wEA//8BAAAA//8BAP//AAABAP//AQAAAP7/AgD//wEA//8AAAAAAQD+/wMA/P8EAP7///8DAPz/BQD8/wEAAQD+/wMA/v8AAAEA//8BAP//AQD//wEA/v8CAP//AQD//wAAAAABAAAA//8BAP//AQAAAAAA//8BAP//AgD+/wAAAQD//wIA/f8CAP//AQAAAP7/AwD9/wMA/v8BAP//AAABAP//AgD9/wIA//8BAAAA//8BAAAA//8CAP3/AwD+/wEAAAD+/wQA/P8DAP7/AAACAP7/AQAAAP//AQAAAP//AQAAAP//AgD9/wIAAAD//wIA/f8DAP7/AQD//wEA//8CAP7/AQD//wAAAQD//wEA//8AAAAAAQD//wEAAAD9/wUA+/8FAPz/AgD//wAAAQD//wAAAQD+/wMA/f8BAAEA/v8CAP7/AgD+/wIA/v8BAAAAAAAAAAAAAAD//wIA/v8CAP////8CAP7/AgD+/wIA/v8CAP7/AQAAAP//AQAAAP//AQD//wAAAQD//wAAAQD+/wMA/f8CAAAA/v8DAP3/AgAAAP//AQAAAP7/AwD9/wMA/v8BAP//AQD//wEAAAD+/wMA/f8CAAAA/v8CAP//AAAAAAEA//8AAAEA/v8DAP3/AwD9/wIA//8BAP//AgD8/wQA/v8BAAAA/v8CAP//AQD//wAAAAAAAAEA/f8EAPz/BAD9/wIA//8AAAAAAAABAP//AAAAAAAAAAABAP3/BAD9/wIA/v8BAAEA//8AAAAA//8CAP7/AgD9/wQA+/8FAPv/BQD8/wMA/f8DAP3/AwD+/wAAAgD9/wMA/f8CAAAA/v8EAPv/BQD7/wUA/P8DAP///v8DAP3/BAD8/wMA/f8DAP7/AQD//wEAAAD//wEA/v8CAAAA/v8CAP7/AgD//wAAAAAAAAAAAQD+/wIA//8AAAEA/v8DAPz/BAD9/wIA//8AAP//AgD//wEA/v8BAAAAAQD//wAAAAAAAAEA//8AAAEA//8BAP//AAABAP//AQD+/wIA/v8DAPz/BAD8/wQA/f8BAAAAAQD+/wMA/P8DAP//AAAAAAAAAAD//wMA+/8FAP3/AQABAP3/BAD8/wMA/v8BAAAA//8CAP3/AwD+/wEAAQD9/wMA/f8EAPz/BAD7/wQA/v8BAAEA/f8DAP7/AQAAAP//AgD+/wEAAAD//wIA/v8CAP7/AgD+/wEAAQD//wEA/v8CAP7/BAD7/wQA/f8CAAAA//8AAAAAAAABAP//AQD+/wEAAQD+/wMA/f8BAAEA/v8DAPz/AwD/////AwD8/wQA/P8DAP7/AgD//wAA//8BAAAAAAAAAP//AgD+/wEAAAD//wIA/v8BAAAA//8CAP3/AgD//wAAAQD+/wIA/v8BAAAA//8CAP7/AgD+/wEA//8CAP3/BAD7/wQA/v8BAAAA//8AAAEAAAD//wIA/f8DAP7/AgD+/wIA/v8CAP7/AgD+/wEAAAAAAP//AgD9/wMA/v8BAP//AgD9/wMA/v8AAAEA//8BAP//AQD//wEA//8AAAEA/v8EAPz/AgD//wAAAQAAAP//AAABAP//AQD//wEAAAD//wEA//8BAAEA/f8DAP7/AQABAP3/AwD+/wIA/////wEAAAAAAAAAAAD//wIA/v8CAP////8CAP7/AgD//wAA//8CAP3/BAD9/wAAAgD9/wMA/v8BAP//AQAAAP//AQAAAP//AgD9/wMA/f8EAPz/AwD+/wEAAAAAAAAAAAD//wIA/f8EAP3/AAABAAAA//8CAP7/AQAAAP//AQAAAAAA//8BAP//AQAAAP//AQAAAP//AQAAAP//AgD9/wMA/v8BAP//AQAAAP//AQD//wIA/v8CAP3/BAD9/wEAAAD//wEAAQD9/wMA/f8CAAAA/v8DAP3/AgD//wAAAQD+/wIA/v8CAP7/AQAAAP//AgD+/wEAAAAAAP//AwD7/wUA/f8BAAEA/v8BAAEA/v8DAP3/AgD//wEA//8BAP//AQD//wEA//8CAP3/BAD7/wQA/////wIA/v8AAAIA/v8CAP3/BAD7/wUA/P8DAP3/AwD9/wMA/v8AAAIA/v8CAP7/AgD+/wIA//8AAAEA/v8CAP7/AgD//wAAAAD//wEAAAAAAAAA//8BAP7/BAD7/wUA/P8CAAAA//8BAP//AQAAAP//AgD9/wMA/v8BAAAA//8BAAAA//8CAP3/AwD+/wEA//8CAP3/AwD+/wAAAwD8/wIAAAD//wIA/////wIA/v8CAP7/AgD+/wEAAAAAAAAAAAAAAP//AgD+/wIA//8AAAAA//8CAP7/AgD+/wEA//8CAP3/AwD9/wMA/v8BAP7/AwD9/wMA/f8CAP//AQD+/wIA//8BAP//AQD+/wMA/v8BAAAA//8BAAAA//8CAP7/AQAAAP//AgD+/wIA/v8CAP//AAAAAAEA//8BAP//AAABAAAA//8BAP//AQD//wEA//8BAP//AQAAAP//AQD//wEAAAD//wIA/f8CAAAA//8BAAAA//8BAP//AAABAP//AQD//wAAAAAAAAEA/v8CAP//AQD//wAAAAABAP7/AwD9/wIAAAD+/wIA//8BAP//AgD9/wMA/f8DAP7/AgD+/wEAAAAAAAEA/v8CAP7/AgD//wAAAAAAAAAAAAAAAP//AgD/////AgD9/wQA/f8BAAAAAAAAAAEA/f8DAP////8DAP3/AQABAP7/AgD//wAAAQD+/wMA/f8CAP7/AQABAP7/AwD7/wYA+v8FAP3/AQABAP7/AgD+/wMA/f8CAP7/AwD+/wEA//8BAP//AQAAAP7/BQD5/wcA+v8FAPz/AwD+/wIA/v8BAAAA//8DAPv/BQD8/wMA/////wEAAAAAAAAAAAD//wIA/f8DAP7/AQAAAP//AQAAAP//AgD+/wIA/v8BAAEA/f8EAPz/AwD+/wEA//8CAP7/AQD//wEA//8CAP7/AQAAAP//AgD+/wEAAAAAAAAAAAAAAAAAAAD//wIA/f8EAPz/AwD+/wEA//8CAP7/AgD+/wEAAQD+/wEAAQD+/wIA/////wIA//8AAAAAAAAAAAAAAAD//wEAAAAAAP//AgD9/wMA/v8BAP//AQAAAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQAAAP7/AwD9/wMA/v8BAP7/AwD9/wMA/v8BAP//AAABAP//AQD//wAAAAABAP//AAAAAAAAAQD//wEA/v8CAAAA/v8EAPv/BAD9/wIAAAD+/wMA/P8DAP//AAAAAP//AQD//wIA/f8DAP3/AwD9/wMA/v8BAAAA//8BAAAA//8CAP3/AwD9/wQA+/8FAPv/BQD8/wMA/v8BAAAA//8BAP//AgD+/wEAAAD//wIA/v8BAAEA/f8DAP3/AgAAAP//AQD//wAAAQD//wEA//8BAP//AQD//wEA/v8DAP3/AgAAAP7/AwD9/wIAAAD//wEAAAD//wIA/f8DAP7/AgD9/wQA+/8FAPz/AgAAAP//AgD9/wIA//8BAP//AQD//wEA//8BAP//AQD//wIA/f8DAP3/AgD//wAAAQD+/wIA/v8BAAEA/v8CAP7/AgD+/wMA/P8DAP//AAABAP7/AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEA/v8CAP3/BAD8/wMA/v8BAAAAAAD//wEAAAAAAAAAAAD//wEAAAAAAAAA//8BAP//AgD+/wEA//8CAP3/AwD9/wMA/f8EAPv/BAD+/wAAAQD//wEA//8BAP//AAABAP//AQD//wEAAAD//wEA//8BAP//AgD9/wMA/v8AAAIA/f8DAP7/AAACAP3/AwD+/wEA//8BAP//AQAAAP//AQAAAP7/AwD9/wMA/v8AAAEA//8BAP//AAAAAAEA//8AAAEA/v8CAP//AAAAAAEA/v8DAPz/BAD9/wEAAQD+/wEAAQD9/wQA/P8DAP7/AQAAAAAAAAAAAAAAAAAAAAAAAQD+/wIA/////wIA/v8BAAAA//8BAP//AQD//wEA//8BAAAA/v8EAPz/AwD///7/BAD8/wMA/////wIA/v8CAP////8CAP7/AgD+/wIA/v8CAP////8CAP7/AwD9/wIA/v8CAP//AAABAP7/AwD9/wEAAQD+/wMA/f8CAP//AAAAAAEA/v8DAPz/BAD9/wIA/v8CAP7/AgD//wAAAAD//wIA/v8CAP7/AQAAAAAA//8CAP7/AgD+/wIA/v8CAP7/AwD8/wUA+v8GAPv/AwD//wAAAAAAAAAA//8DAPv/BQD9/wAAAgD9/wMA/v8BAP//AQAAAP//AgD9/wMA/v8BAAAA//8BAAAAAAAAAP//AQAAAAAAAAD//wEA//8CAP3/AwD+/wAAAgD+/wEAAAD//wIA/v8CAP7/AgD/////AwD8/wUA/P8CAP//AQD//wIA/f8DAP3/AwD+/wAAAQD+/wMA/f8DAP3/AgD//wAAAQD//wEA//8BAP7/AwD+/wEA//8AAAEA//8CAPz/BAD9/wIA//8AAAEA/v8DAPz/BAD9/wIA//8AAAEA/v8CAP7/AgD//wEA/f8EAPz/BAD+////AgD//wAAAQD//wAAAQD//wEA//8BAP7/AwD+/wEA";else{addTest("audiopreload",!1);return}}catch{addTest("audiopreload",!1);return}t.setAttribute("preload","auto"),t.style.cssText="display:none",docElement.appendChild(t),setTimeout(function(){t.addEventListener("loadeddata",n,!1),e=setTimeout(n,A)},0)});Modernizr.addTest("webaudio",function(){var e="webkitAudioContext"in window,A="AudioContext"in window;return Modernizr._config.usePrefixes&&e||A});Modernizr.addTest("batteryapi",!!prefixed("battery",navigator)||!!prefixed("getBattery",navigator),{aliases:["battery-api"]});Modernizr.addTest("lowbattery",function(){var e=.2,A=prefixed("battery",navigator);return!!(A&&!A.charging&&A.level<=e)});Modernizr.addTest("blobconstructor",function(){try{return!!new Blob}catch{return!1}},{aliases:["blob-constructor"]});Modernizr.addTest("broadcastchannel","BroadcastChannel"in window);Modernizr.addTest("canvas",function(){var e=createElement("canvas");return!!(e.getContext&&e.getContext("2d"))});Modernizr.addTest("canvasblending",function(){if(Modernizr.canvas===!1)return!1;var e=createElement("canvas").getContext("2d");try{e.globalCompositeOperation="screen"}catch{}return e.globalCompositeOperation==="screen"});var canvas=createElement("canvas");Modernizr.addTest("todataurljpeg",function(){var e=!1;try{e=!!Modernizr.canvas&&canvas.toDataURL("image/jpeg").indexOf("data:image/jpeg")===0}catch{}return e}),Modernizr.addTest("todataurlpng",function(){var e=!1;try{e=!!Modernizr.canvas&&canvas.toDataURL("image/png").indexOf("data:image/png")===0}catch{}return e}),Modernizr.addTest("todataurlwebp",function(){var e=!1;try{e=!!Modernizr.canvas&&canvas.toDataURL("image/webp").indexOf("data:image/webp")===0}catch{}return e});Modernizr.addTest("canvaswinding",function(){if(Modernizr.canvas===!1)return!1;var e=createElement("canvas").getContext("2d");return e.rect(0,0,10,10),e.rect(2,2,6,6),e.isPointInPath(5,5,"evenodd")===!1});Modernizr.addTest("canvastext",function(){return Modernizr.canvas===!1?!1:typeof createElement("canvas").getContext("2d").fillText=="function"});Modernizr.addAsyncTest(function(){var e,A=["read","readText","write","writeText"];if(navigator.clipboard){addTest("clipboard",!0);for(var t=0;t<A.length;t++)navigator.clipboard[A[t]]?e=!0:e=!1,addTest("clipboard."+A[t].toLowerCase(),e)}else addTest("clipboard",!1)});Modernizr.addTest("contenteditable",function(){if("contentEditable"in docElement){var e=createElement("div");return e.contentEditable=!0,e.contentEditable==="true"}});Modernizr.addTest("contextmenu","contextMenu"in docElement&&"HTMLMenuItemElement"in window);Modernizr.addTest("cors","XMLHttpRequest"in window&&"withCredentials"in new XMLHttpRequest);var crypto=prefixed("crypto",window);Modernizr.addTest("crypto",!!prefixed("subtle",crypto));var crypto=prefixed("crypto",window),supportsGetRandomValues;if(crypto&&"getRandomValues"in crypto&&"Uint32Array"in window){var array=new Uint32Array(10),values=crypto.getRandomValues(array);supportsGetRandomValues=values&&is(values[0],"number")}Modernizr.addTest("getrandomvalues",!!supportsGetRandomValues);Modernizr.addTest("cssall","all"in docElement.style);Modernizr.addTest("cssanimations",testAllProps("animationName","a",!0));Modernizr.addTest("appearance",testAllProps("appearance"));Modernizr.addTest("aspectratio",function(){if(typeof CSS!="object"&&typeof CSS.supports=="function")return CSS.supports("aspect-ratio","1 / 1");var e=createElement("p"),A=e.style;return"aspectRatio"in A?(A.cssText="aspect-ratio:1 / 1",e.remove(),A.aspectRatio==="1 / 1"):(e.remove(),!1)});Modernizr.addTest("backdropfilter",testAllProps("backdropFilter"));Modernizr.addTest("backgroundblendmode",prefixed("backgroundBlendMode","text"));Modernizr.addTest("backgroundcliptext",function(){return testAllProps("backgroundClip","text")});Modernizr.addTest("bgpositionshorthand",function(){var e=createElement("a"),A=e.style,t="right 10px bottom 10px";return A.cssText="background-position: "+t+";",A.backgroundPosition===t});Modernizr.addTest("bgpositionxy",function(){return testAllProps("backgroundPositionX","3px",!0)&&testAllProps("backgroundPositionY","5px",!0)});Modernizr.addTest("bgrepeatround",testAllProps("backgroundRepeat","round")),Modernizr.addTest("bgrepeatspace",testAllProps("backgroundRepeat","space"));Modernizr.addTest("backgroundsize",testAllProps("backgroundSize","100%",!0));Modernizr.addTest("bgsizecover",testAllProps("backgroundSize","cover"));Modernizr.addTest("borderimage",testAllProps("borderImage","url() 1",!0));Modernizr.addTest("borderradius",testAllProps("borderRadius","0px",!0));Modernizr.addTest("boxdecorationbreak",testAllProps("boxDecorationBreak","slice"));Modernizr.addTest("boxshadow",testAllProps("boxShadow","1px 1px",!0));Modernizr.addTest("boxsizing",testAllProps("boxSizing","border-box",!0)&&(document.documentMode===undefined||document.documentMode>7));Modernizr.addTest("csscalc",function(){var e="width:",A="calc(10px);",t=createElement("a");return t.style.cssText=e+prefixes.join(A+e),!!t.style.length});Modernizr.addTest("checked",function(){return testStyles("#modernizr {position:absolute} #modernizr input {margin-left:10px} #modernizr :checked {margin-left:20px;display:block}",function(e){var A=createElement("input");return A.setAttribute("type","checkbox"),A.setAttribute("checked","checked"),e.appendChild(A),A.offsetLeft===20})});Modernizr.addTest("csschunit",function(){var e=modElem.elem.style,A;try{e.fontSize="3ch",A=e.fontSize.indexOf("ch")!==-1}catch{A=!1}return A});(function(){Modernizr.addTest("csscolumns",function(){var n=!1,o=testAllProps("columnCount");try{n=!!o,n&&(n=new Boolean(n))}catch{}return n});for(var e=["Width","Span","Fill","Gap","Rule","RuleColor","RuleStyle","RuleWidth","BreakBefore","BreakAfter","BreakInside"],A,t,r=0;r<e.length;r++)A=e[r].toLowerCase(),t=testAllProps("column"+e[r]),(A==="breakbefore"||A==="breakafter"||A==="breakinside")&&(t=t||testAllProps(e[r])),Modernizr.addTest("csscolumns."+A,t)})();Modernizr.addTest("cssgridlegacy",testAllProps("grid-columns","10px",!0)),Modernizr.addTest("cssgrid",testAllProps("grid-template-rows","none",!0));Modernizr.addTest("cubicbezierrange",function(){var e=createElement("a");return e.style.cssText=prefixes.join("transition-timing-function:cubic-bezier(1,0,0,1.1); "),!!e.style.length});var supportsFn=window.CSS&&window.CSS.supports.bind(window.CSS)||window.supportsCSS;Modernizr.addTest("customproperties",!!supportsFn&&(supportsFn("--f:0")||supportsFn("--f",0)));Modernizr.addTest("displayrunin",testAllProps("display","run-in"),{aliases:["display-runin"]});testStyles("#modernizr{display: table; direction: ltr}#modernizr div{display: table-cell; padding: 10px}",function(e){var A,t=e.childNodes;A=t[0].offsetLeft<t[1].offsetLeft,Modernizr.addTest("displaytable",A,{aliases:["display-table"]})},2);Modernizr.addTest("ellipsis",testAllProps("textOverflow","ellipsis"));var CSS=window.CSS;Modernizr.addTest("cssescape",CSS?typeof CSS.escape=="function":!1);Modernizr.addTest("cssexunit",function(){var e=modElem.elem.style,A;try{e.fontSize="3ex",A=e.fontSize.indexOf("ex")!==-1}catch{A=!1}return A});var newSyntax="CSS"in window&&"supports"in window.CSS,oldSyntax="supportsCSS"in window;Modernizr.addTest("supports",newSyntax||oldSyntax);Modernizr.addTest("cssfilters",function(){if(Modernizr.supports)return testAllProps("filter","blur(2px)");var e=createElement("a");return e.style.cssText=prefixes.join("filter:blur(2px); "),!!e.style.length&&(document.documentMode===undefined||document.documentMode>9)});Modernizr.addTest("flexbox",testAllProps("flexBasis","1px",!0));Modernizr.addTest("flexboxlegacy",testAllProps("boxDirection","reverse",!0));Modernizr.addTest("flexboxtweener",testAllProps("flexAlign","end",!0));Modernizr.addTest("flexgap",function(){var e=createElement("div");e.style.display="flex",e.style.flexDirection="column",e.style.rowGap="1px",e.appendChild(createElement("div")),e.appendChild(createElement("div")),docElement.appendChild(e);var A=e.scrollHeight===1;return e.parentNode.removeChild(e),A});Modernizr.addTest("flexwrap",testAllProps("flexWrap","wrap",!0));Modernizr.addTest("focusvisible",function(){try{document.querySelector(":focus-visible")}catch{return!1}return!0});Modernizr.addTest("focuswithin",function(){try{document.querySelector(":focus-within")}catch{return!1}return!0});Modernizr.addTest("fontDisplay",testProp("font-display"));var unsupportedUserAgent=function(){var e=navigator.userAgent,A=e.match(/w(eb)?osbrowser/gi),t=e.match(/windows phone/gi)&&e.match(/iemobile\/([0-9])+/gi)&&parseFloat(RegExp.$1)>=9;return A||t}();unsupportedUserAgent?Modernizr.addTest("fontface",!1):testStyles('@font-face {font-family:"font";src:url("https://")}',function(e,A){var t=document.getElementById("smodernizr"),r=t.sheet||t.styleSheet,n=r?r.cssRules&&r.cssRules[0]?r.cssRules[0].cssText:r.cssText||"":"",o=/src/i.test(n)&&n.indexOf(A.split(" ")[0])===0;Modernizr.addTest("fontface",o)});testStyles('#modernizr{font:0/0 a}#modernizr:after{content:":)";visibility:hidden;font:7px/1 a}',function(e){Modernizr.addTest("generatedcontent",e.offsetHeight>=6)});Modernizr.addTest("cssgradients",function(){for(var e="background-image:",A="gradient(linear,left top,right bottom,from(#9f9),to(white));",t="",r,n=0,o=prefixes.length-1;n<o;n++)r=n===0?"to ":"",t+=e+prefixes[n]+"linear-gradient("+r+"left top, #9f9, white);";Modernizr._config.usePrefixes&&(t+=e+"-webkit-"+A);var a=createElement("a"),l=a.style;return l.cssText=t,(""+l.backgroundImage).indexOf("gradient")>-1});Modernizr.addTest("hairline",function(){return testStyles("#modernizr {border:.5px solid transparent}",function(e){return e.offsetHeight===1})});Modernizr.addTest("hsla",function(){var e=createElement("a").style;return e.cssText="background-color:hsla(120,40%,100%,.5)",contains(e.backgroundColor,"rgba")||contains(e.backgroundColor,"hsla")});Modernizr.addAsyncTest(function(){var e=300;setTimeout(A,e);function A(){if(!document.body&&!document.getElementsByTagName("body")[0]){setTimeout(A,e);return}function t(){try{var o=createElement("div"),a=createElement("span"),l=o.style,s=0,f=0,u=!1,m=document.body.firstElementChild||document.body.firstChild;return o.lang="en",o.appendChild(a),a.innerHTML="Bacon ipsum dolor sit amet jerky velit in culpa hamburger et. Laborum dolor proident, enim dolore duis commodo et strip steak. Salami anim et, veniam consectetur dolore qui tenderloin jowl velit sirloin. Et ad culpa, fatback cillum jowl ball tip ham hock nulla short ribs pariatur aute. Pig pancetta ham bresaola, ut boudin nostrud commodo flank esse cow tongue culpa. Pork belly bresaola enim pig, ea consectetur nisi. Fugiat officia turkey, ea cow jowl pariatur ullamco proident do laborum velit sausage. Magna biltong sint tri-tip commodo sed bacon, esse proident aliquip. Ullamco ham sint fugiat, velit in enim sed mollit nulla cow ut adipisicing nostrud consectetur. Proident dolore beef ribs, laborum nostrud meatball ea laboris rump cupidatat labore culpa. Shankle minim beef, velit sint cupidatat fugiat tenderloin pig et ball tip. Ut cow fatback salami, bacon ball tip et in shank strip steak bresaola. In ut pork belly sed mollit tri-tip magna culpa veniam, short ribs qui in andouille ham consequat. Dolore bacon t-bone, velit short ribs enim strip steak nulla. Voluptate labore ut, biltong swine irure jerky. Cupidatat excepteur aliquip salami dolore. Ball tip strip steak in pork dolor. Ad in esse biltong. Dolore tenderloin exercitation ad pork loin t-bone, dolore in chicken ball tip qui pig. Ut culpa tongue, sint ribeye dolore ex shank voluptate hamburger. Jowl et tempor, boudin pork chop labore ham hock drumstick consectetur tri-tip elit swine meatball chicken ground round. Proident shankle mollit dolore. Shoulder ut duis t-bone quis reprehenderit. Meatloaf dolore minim strip steak, laboris ea aute bacon beef ribs elit shank in veniam drumstick qui. Ex laboris meatball cow tongue pork belly. Ea ball tip reprehenderit pig, sed fatback boudin dolore flank aliquip laboris eu quis. Beef ribs duis beef, cow corned beef adipisicing commodo nisi deserunt exercitation. Cillum dolor t-bone spare ribs, ham hock est sirloin. Brisket irure meatloaf in, boudin pork belly sirloin ball tip. Sirloin sint irure nisi nostrud aliqua. Nostrud nulla aute, enim officia culpa ham hock. Aliqua reprehenderit dolore sunt nostrud sausage, ea boudin pork loin ut t-bone ham tempor. Tri-tip et pancetta drumstick laborum. Ham hock magna do nostrud in proident. Ex ground round fatback, venison non ribeye in.",document.body.insertBefore(o,m),l.cssText="position:absolute;top:0;left:0;width:5em;text-align:justify;text-justify:newspaper;",s=a.offsetHeight,f=a.offsetWidth,l.cssText="position:absolute;top:0;left:0;width:5em;text-align:justify;text-justify:newspaper;"+prefixes.join("hyphens:auto; "),u=a.offsetHeight!==s||a.offsetWidth!==f,document.body.removeChild(o),o.removeChild(a),u}catch{return!1}}function r(o,a){try{var l=createElement("div"),s=createElement("span"),f=l.style,u=0,m=!1,g=!1,P=!1,M=document.body.firstElementChild||document.body.firstChild;return f.cssText="position:absolute;top:0;left:0;overflow:visible;width:1.25em;",l.appendChild(s),document.body.insertBefore(l,M),s.innerHTML="mm",u=s.offsetHeight,s.innerHTML="m"+o+"m",g=s.offsetHeight>u,a?(s.innerHTML="m<br />m",u=s.offsetWidth,s.innerHTML="m"+o+"m",P=s.offsetWidth>u):P=!0,g===!0&&P===!0&&(m=!0),document.body.removeChild(l),l.removeChild(s),m}catch{return!1}}function n(o){try{var a=createElement("input"),l=createElement("div"),s="lebowski",f=!1,u,m=document.body.firstElementChild||document.body.firstChild;a.style.cssText="position:fixed;top:0;",l.style.cssText="position:fixed;top:0;",l.innerHTML=s+o+s,document.body.insertBefore(l,m),document.body.insertBefore(a,l),a.setSelectionRange?(a.focus(),a.setSelectionRange(0,0)):a.createTextRange&&(u=a.createTextRange(),u.collapse(!0),u.moveEnd("character",0),u.moveStart("character",0),u.select());try{window.find?f=window.find(s+s):(u=window.self.document.body.createTextRange(),f=u.findText(s+s))}catch{f=!1}return document.body.removeChild(l),document.body.removeChild(a),f}catch{return!1}}addTest("csshyphens",function(){if(!testAllProps("hyphens","auto",!0))return!1;try{return t()}catch{return!1}}),addTest("softhyphens",function(){try{return r("&#173;",!0)&&r("&#8203;",!1)}catch{return!1}}),addTest("softhyphensfind",function(){try{return n("&#173;")&&n("&#8203;")}catch{return!1}})}});Modernizr.addTest("cssinvalid",function(){return testStyles("#modernizr input{height:0;border:0;padding:0;margin:0;width:10px} #modernizr input:invalid{width:50px}",function(e){var A=createElement("input");return A.required=!0,e.appendChild(A),A.clientWidth>10})});testStyles("#modernizr div {width:100px} #modernizr :last-child{width:200px;display:block}",function(e){Modernizr.addTest("lastchild",e.lastChild.offsetWidth>e.firstChild.offsetWidth)},2);Modernizr.addTest("cssmask",testAllProps("maskRepeat","repeat-x",!0));Modernizr.addTest("mediaqueries",mq("only all"));Modernizr.addTest("multiplebgs",function(){var e=createElement("a").style;return e.cssText="background:url(https://),url(https://),red url(https://)",/(url\s*\(.*?){3}/.test(e.background)});testStyles("#modernizr div {width:1px} #modernizr div:nth-child(2n) {width:2px;}",function(e){var A=e.getElementsByTagName("div"),t=A[0].offsetWidth===A[2].offsetWidth&&A[1].offsetWidth===A[3].offsetWidth&&A[0].offsetWidth!==A[1].offsetWidth;Modernizr.addTest("nthchild",t)},4);Modernizr.addTest("objectfit",!!prefixed("objectFit"),{aliases:["object-fit"]});Modernizr.addTest("opacity",function(){var e=createElement("a").style;return e.cssText=prefixes.join("opacity:.55;"),/^0.55$/.test(e.opacity)});Modernizr.addTest("overflowscrolling",testAllProps("overflowScrolling","touch",!0));Modernizr.addTest("csspointerevents",function(){var e=createElement("a").style;return e.cssText="pointer-events:auto",e.pointerEvents==="auto"});Modernizr.addTest("csspositionsticky",function(){var e="position:",A="sticky",t=createElement("a"),r=t.style;return r.cssText=e+prefixes.join(A+";"+e).slice(0,-e.length),r.position.indexOf(A)!==-1});Modernizr.addTest("csspseudoanimations",function(){var e=!1;if(!Modernizr.cssanimations)return e;var A=["@",prefixes.join("keyframes csspseudoanimations { from { font-size: 10px; } }@").replace(/\@$/,""),'#modernizr:before { content:" "; font-size:5px;',prefixes.join("animation:csspseudoanimations 1ms infinite;"),"}"].join("");return testStyles(A,function(t){e=computedStyle(t,":before","font-size")==="10px"}),e});Modernizr.addTest("csstransitions",testAllProps("transition","all",!0));Modernizr.addTest("csspseudotransitions",function(){var e=!1;if(!Modernizr.csstransitions)return e;var A='#modernizr:before { content:" "; font-size:5px;'+prefixes.join("transition:0s 100s;")+"}#modernizr.trigger:before { font-size:10px; }";return testStyles(A,function(t){computedStyle(t,":before","font-size"),t.className+="trigger",e=computedStyle(t,":before","font-size")==="5px"}),e});Modernizr.addTest("cssreflections",testAllProps("boxReflect","above",!0));Modernizr.addTest("regions",function(){if(isSVG)return!1;var e=prefixed("flowFrom"),A=prefixed("flowInto"),t=!1;if(!e||!A)return t;var r=createElement("iframe"),n=createElement("div"),o=createElement("div"),a=createElement("div"),l="modernizr_flow_for_regions_check";o.innerText="M",n.style.cssText="top: 150px; left: 150px; padding: 0px;",a.style.cssText="width: 50px; height: 50px; padding: 42px;",a.style[e]=l,n.appendChild(o),n.appendChild(a),docElement.appendChild(n);var s,f,u=o.getBoundingClientRect();return o.style[A]=l,s=o.getBoundingClientRect(),f=parseInt(s.left-u.left,10),docElement.removeChild(n),f===42?t=!0:(docElement.appendChild(r),u=r.getBoundingClientRect(),r.style[A]=l,s=r.getBoundingClientRect(),u.height>0&&u.height!==s.height&&s.height===0&&(t=!0)),o=a=n=r=undefined,t});Modernizr.addTest("cssremunit",function(){var e=createElement("a").style;try{e.fontSize="3rem"}catch{}return/rem/.test(e.fontSize)});Modernizr.addTest("cssresize",testAllProps("resize","both",!0));Modernizr.addTest("rgba",function(){var e=createElement("a").style;return e.cssText="background-color:rgba(150,255,150,.5)",(""+e.backgroundColor).indexOf("rgba")>-1});testStyles("#modernizr{overflow: scroll; width: 40px; height: 40px; }#"+prefixes.join("scrollbar{width:10px} #modernizr::").split("#").slice(1).join("#")+"scrollbar{width:10px}",function(e){Modernizr.addTest("cssscrollbar","scrollWidth"in e&&e.scrollWidth===30)});Modernizr.addTest("scrollsnappoints",testAllProps("scrollSnapType"));Modernizr.addTest("shapes",testAllProps("shapeOutside","content-box",!0));Modernizr.addTest("siblinggeneral",function(){return testStyles("#modernizr div {width:100px} #modernizr div ~ div {width:200px;display:block}",function(e){return e.lastChild.offsetWidth===200},2)});testStyles("#modernizr{position: absolute; top: -10em; visibility:hidden; font: normal 10px arial;}#subpixel{float: left; font-size: 33.3333%;}",function(e){var A=e.firstChild;A.innerHTML="This is a text written in Arial",Modernizr.addTest("subpixelfont",computedStyle(A,null,"width")!=="44px")},1,["subpixel"]);Modernizr.addTest("target",function(){var e=window.document;if(!("querySelectorAll"in e))return!1;try{return e.querySelectorAll(":target"),!0}catch{return!1}});Modernizr.addTest("textalignlast",testAllProps("textAlignLast"));(function(){Modernizr.addTest("textdecoration",function(){var n=!1,o=testAllProps("textDecoration");try{n=!!o,n&&(n=new Boolean(n))}catch{}return n});for(var e=["Line","Style","Color","Skip","SkipInk"],A,t,r=0;r<e.length;r++)A=e[r].toLowerCase(),t=testAllProps("textDecoration"+e[r]),Modernizr.addTest("textdecoration."+A,t)})();Modernizr.addTest("textshadow",testProp("textShadow","1px 1px"));Modernizr.addTest("csstransforms",function(){return navigator.userAgent.indexOf("Android 2.")===-1&&testAllProps("transform","scale(1)",!0)});Modernizr.addTest("csstransforms3d",function(){return!!testAllProps("perspective","1px",!0)});Modernizr.addTest("csstransformslevel2",function(){return testAllProps("translate","45px",!0)});Modernizr.addTest("preserve3d",function(){var e,A,t=window.CSS,r=!1;return t&&t.supports&&t.supports("(transform-style: preserve-3d)")?!0:(e=createElement("a"),A=createElement("a"),e.style.cssText="display: block; transform-style: preserve-3d; transform-origin: right; transform: rotateY(40deg);",A.style.cssText="display: block; width: 9px; height: 1px; background: #000; transform-origin: right; transform: rotateY(40deg);",e.appendChild(A),docElement.appendChild(e),r=A.getBoundingClientRect(),docElement.removeChild(e),r=r.width&&r.width<4,r)});Modernizr.addTest("userselect",testAllProps("userSelect","none",!0));Modernizr.addTest("cssvalid",function(){return testStyles("#modernizr input{height:0;border:0;padding:0;margin:0;width:10px} #modernizr input:valid{width:50px}",function(e){var A=createElement("input");return e.appendChild(A),A.clientWidth>10})});Modernizr.addTest("variablefonts",testAllProps("fontVariationSettings"));testStyles("#modernizr { height: 50vh; max-height: 10px; }",function(e){var A=parseInt(computedStyle(e,null,"height"),10);Modernizr.addTest("cssvhunit",A===10)});function roundedEquals(e,A){return e-1===A||e===A||e+1===A}testStyles("#modernizr1{width: 50vmax}#modernizr2{width:50px;height:50px;overflow:scroll}#modernizr3{position:fixed;top:0;left:0;bottom:0;right:0}",function(e){var A=e.childNodes[2],t=e.childNodes[1],r=e.childNodes[0],n=parseInt((t.offsetWidth-t.clientWidth)/2,10),o=r.clientWidth/100,a=r.clientHeight/100,l=parseInt(Math.max(o,a)*50,10),s=parseInt(computedStyle(A,null,"width"),10);Modernizr.addTest("cssvmaxunit",roundedEquals(l,s)||roundedEquals(l,s-n))},3);testStyles("#modernizr1{width: 50vm;width:50vmin}#modernizr2{width:50px;height:50px;overflow:scroll}#modernizr3{position:fixed;top:0;left:0;bottom:0;right:0}",function(e){var A=e.childNodes[2],t=e.childNodes[1],r=e.childNodes[0],n=parseInt((t.offsetWidth-t.clientWidth)/2,10),o=r.clientWidth/100,a=r.clientHeight/100,l=parseInt(Math.min(o,a)*50,10),s=parseInt(computedStyle(A,null,"width"),10);Modernizr.addTest("cssvminunit",roundedEquals(l,s)||roundedEquals(l,s-n))},3);testStyles("#modernizr { width: 50vw; }",function(e){var A=parseInt(window.innerWidth/2,10),t=parseInt(computedStyle(e,null,"width"),10);Modernizr.addTest("cssvwunit",roundedEquals(t,A))});Modernizr.addTest("willchange","willChange"in docElement.style);Modernizr.addTest("wrapflow",function(){var e=prefixed("wrapFlow");if(!e||isSVG)return!1;var A=e.replace(/([A-Z])/g,function(a,l){return"-"+l.toLowerCase()}).replace(/^ms-/,"-ms-"),t=createElement("div"),r=createElement("div"),n=createElement("span");r.style.cssText="position: absolute; left: 50px; width: 100px; height: 20px;"+A+":end;",n.innerText="X",t.appendChild(r),t.appendChild(n),docElement.appendChild(t);var o=n.offsetLeft;return docElement.removeChild(t),r=n=t=undefined,o===150});Modernizr.addTest("customelements","customElements"in window);Modernizr.addTest("customprotocolhandler",function(){if(!navigator.registerProtocolHandler)return!1;try{navigator.registerProtocolHandler("thisShouldFail")}catch(e){return e instanceof TypeError}return!1});Modernizr.addTest("dart",!!prefixed("startDart",navigator));Modernizr.addTest("dataview",typeof DataView<"u"&&"getFloat64"in DataView.prototype);Modernizr.addTest("classlist","classList"in docElement);Modernizr.addTest("createelementattrs",function(){try{return createElement('<input name="test" />').getAttribute("name")==="test"}catch{return!1}},{aliases:["createelement-attrs"]});Modernizr.addTest("dataset",function(){var e=createElement("div");return e.setAttribute("data-a-b","c"),!!(e.dataset&&e.dataset.aB==="c")});Modernizr.addTest("documentfragment",function(){return"createDocumentFragment"in document&&"appendChild"in docElement});Modernizr.addTest("hidden","hidden"in createElement("a"));Modernizr.addTest("intersectionobserver","IntersectionObserver"in window);Modernizr.addTest("microdata","getItems"in document);Modernizr.addTest("mutationobserver",!!window.MutationObserver||!!window.WebKitMutationObserver);Modernizr.addTest("passiveeventlisteners",function(){var e=!1;try{var A=Object.defineProperty({},"passive",{get:function(){e=!0}}),t=function(){};window.addEventListener("testPassiveEventSupport",t,A),window.removeEventListener("testPassiveEventSupport",t,A)}catch{}return e});Modernizr.addTest("shadowroot","attachShadow"in createElement("div"));Modernizr.addTest("shadowrootlegacy","createShadowRoot"in createElement("div"));Modernizr.addTest("bdi",function(){var e=createElement("div"),A=createElement("bdi");A.innerHTML="&#1573;",e.appendChild(A),docElement.appendChild(e);var t=computedStyle(A,null,"direction")==="rtl";return docElement.removeChild(e),t});Modernizr.addTest("details",function(){var e=createElement("details"),A;return"open"in e?(testStyles("#modernizr details{display:block}",function(t){t.appendChild(e),e.innerHTML="<summary>a</summary>b",A=e.offsetHeight,e.open=!0,A=A!==e.offsetHeight}),A):!1});Modernizr.addTest("outputelem","value"in createElement("output"));Modernizr.addTest("picture","HTMLPictureElement"in window);Modernizr.addTest("progressbar",createElement("progress").max!==undefined),Modernizr.addTest("meter",createElement("meter").max!==undefined);Modernizr.addTest("ruby",function(){var e=createElement("ruby"),A=createElement("rt"),t=createElement("rp");if(e.appendChild(t),e.appendChild(A),docElement.appendChild(e),computedStyle(t,null,"display")==="none"||computedStyle(e,null,"display")==="ruby"&&computedStyle(A,null,"display")==="ruby-text"||computedStyle(t,null,"fontSize")==="6pt"&&computedStyle(A,null,"fontSize")==="6pt")return r(),!0;return r(),!1;function r(){docElement.removeChild(e),e=null,A=null,t=null}});Modernizr.addTest("template","content"in createElement("template"));Modernizr.addTest("time","valueAsDate"in createElement("time"));Modernizr.addTest("texttrackapi",typeof createElement("video").addTextTrack=="function"),Modernizr.addTest("track","kind"in createElement("track"));Modernizr.addTest("unknownelements",function(){var e=createElement("a");return e.innerHTML="<xyz></xyz>",e.childNodes.length===1});Modernizr.addTest("emoji",function(){if(!Modernizr.canvastext)return!1;var e=createElement("canvas"),A=e.getContext("2d"),t=A.webkitBackingStorePixelRatio||A.mozBackingStorePixelRatio||A.msBackingStorePixelRatio||A.oBackingStorePixelRatio||A.backingStorePixelRatio||1,r=12*t;return A.fillStyle="#f00",A.textBaseline="top",A.font="32px Arial",A.fillText("\u{1F428}",0,0),A.getImageData(r,r,1,1).data[0]!==0});Modernizr.addTest("es5array",function(){return!!(Array.prototype&&Array.prototype.every&&Array.prototype.filter&&Array.prototype.forEach&&Array.prototype.indexOf&&Array.prototype.lastIndexOf&&Array.prototype.map&&Array.prototype.some&&Array.prototype.reduce&&Array.prototype.reduceRight&&Array.isArray)});Modernizr.addTest("es5date",function(){var e="2013-04-12T06:06:37.307Z",A=!1;try{A=!!Date.parse(e)}catch{}return!!(Date.now&&Date.prototype&&Date.prototype.toISOString&&Date.prototype.toJSON&&A)});Modernizr.addTest("es5function",function(){return!!(Function.prototype&&Function.prototype.bind)});Modernizr.addTest("es5object",function(){return!!(Object.keys&&Object.create&&Object.getPrototypeOf&&Object.getOwnPropertyNames&&Object.isSealed&&Object.isFrozen&&Object.isExtensible&&Object.getOwnPropertyDescriptor&&Object.defineProperty&&Object.defineProperties&&Object.seal&&Object.freeze&&Object.preventExtensions)});Modernizr.addTest("strictmode",function(){"use strict";return!this}());Modernizr.addTest("es5string",function(){return!!(String.prototype&&String.prototype.trim)});Modernizr.addTest("json","JSON"in window&&"parse"in JSON&&"stringify"in JSON);Modernizr.addTest("es5syntax",function(){var value,obj,stringAccess,getter,setter,reservedWords,zeroWidthChars;try{return stringAccess=eval('"foobar"[3] === "b"'),getter=eval("({ get x(){ return 1 } }).x === 1"),eval("({ set x(v){ value = v; } }).x = 1"),setter=value===1,eval("obj = ({ if: 1 })"),reservedWords=obj.if===1,zeroWidthChars=eval("_\u200C\u200D = true"),stringAccess&&getter&&setter&&reservedWords&&zeroWidthChars}catch(e){return!1}});Modernizr.addTest("es5undefined",function(){var e,A;try{A=window.undefined,window.undefined=12345,e=typeof window.undefined>"u",window.undefined=A}catch{return!1}return e});Modernizr.addTest("es5",function(){return!!(Modernizr.es5array&&Modernizr.es5date&&Modernizr.es5function&&Modernizr.es5object&&Modernizr.strictmode&&Modernizr.es5string&&Modernizr.json&&Modernizr.es5syntax&&Modernizr.es5undefined)});Modernizr.addTest("es6array",!!(Array.prototype&&Array.prototype.copyWithin&&Array.prototype.fill&&Array.prototype.find&&Array.prototype.findIndex&&Array.prototype.keys&&Array.prototype.entries&&Array.prototype.values&&Array.from&&Array.of));Modernizr.addTest("arrow",function(){try{eval("()=>{}")}catch(e){return!1}return!0});Modernizr.addTest("es6class",function(){try{eval("class A{}")}catch(e){return!1}return!0});Modernizr.addTest("es6collections",!!(window.Map&&window.Set&&window.WeakMap&&window.WeakSet));Modernizr.addTest("generators",function(){try{new Function("function* test() {}")()}catch{return!1}return!0});Modernizr.addTest("es6math",!!(Math&&Math.clz32&&Math.cbrt&&Math.imul&&Math.sign&&Math.log10&&Math.log2&&Math.log1p&&Math.expm1&&Math.cosh&&Math.sinh&&Math.tanh&&Math.acosh&&Math.asinh&&Math.atanh&&Math.hypot&&Math.trunc&&Math.fround));Modernizr.addTest("es6number",!!(Number.isFinite&&Number.isInteger&&Number.isSafeInteger&&Number.isNaN&&Number.parseInt&&Number.parseFloat&&Number.isInteger(Number.MAX_SAFE_INTEGER)&&Number.isInteger(Number.MIN_SAFE_INTEGER)&&Number.isFinite(Number.EPSILON)));Modernizr.addTest("es6object",!!(Object.assign&&Object.is&&Object.setPrototypeOf));Modernizr.addTest("promises",function(){return"Promise"in window&&"resolve"in window.Promise&&"reject"in window.Promise&&"all"in window.Promise&&"race"in window.Promise&&function(){var e;return new window.Promise(function(A){e=A}),typeof e=="function"}()});Modernizr.addTest("restparameters",function(){try{eval("function f(...rest) {}")}catch(e){return!1}return!0});Modernizr.addTest("spreadarray",function(){try{eval("(function f(){})(...[1])")}catch(e){return!1}return!0});Modernizr.addTest("stringtemplate",function(){try{return eval("(function(){var a=1; return `-${a}-`;})()")==="-1-"}catch(e){return!1}});Modernizr.addTest("es6string",!!(String.fromCodePoint&&String.raw&&String.prototype.codePointAt&&String.prototype.repeat&&String.prototype.startsWith&&String.prototype.endsWith&&String.prototype.includes));Modernizr.addTest("es6symbol",!!(typeof Symbol=="function"&&Symbol.for&&Symbol.hasInstance&&Symbol.isConcatSpreadable&&Symbol.iterator&&Symbol.keyFor&&Symbol.match&&Symbol.prototype&&Symbol.replace&&Symbol.search&&Symbol.species&&Symbol.split&&Symbol.toPrimitive&&Symbol.toStringTag&&Symbol.unscopables));Modernizr.addTest("es7array",!!(Array.prototype&&Array.prototype.includes));Modernizr.addTest("restdestructuringarray",function(){try{eval("var [...rest]=[1]")}catch(e){return!1}return!0}),Modernizr.addTest("restdestructuringobject",function(){try{eval("var {...rest}={a:1}")}catch(e){return!1}return!0});Modernizr.addTest("spreadobject",function(){try{eval("var a={...{b:1}}")}catch(e){return!1}return!0});Modernizr.addTest("es8object",!!(Object.entries&&Object.values));Modernizr.addTest("customevent","CustomEvent"in window&&typeof window.CustomEvent=="function");Modernizr.addTest("devicemotion","DeviceMotionEvent"in window),Modernizr.addTest("deviceorientation","DeviceOrientationEvent"in window);Modernizr.addTest("eventlistener","addEventListener"in window);Modernizr.addTest("forcetouch",function(){return hasEvent(prefixed("mouseforcewillbegin",window,!1),window)?MouseEvent.WEBKIT_FORCE_AT_MOUSE_DOWN&&MouseEvent.WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN:!1});Modernizr.addTest("hashchange",function(){return hasEvent("hashchange",window)===!1?!1:document.documentMode===undefined||document.documentMode>7});Modernizr.addTest("oninput",function(){var e=createElement("input"),A;if(e.setAttribute("oninput","return"),e.style.cssText="position:fixed;top:0;",hasEvent("oninput",docElement)||typeof e.oninput=="function")return!0;try{var t=document.createEvent("KeyboardEvent");A=!1;var r=function(n){A=!0,n.preventDefault(),n.stopPropagation()};t.initKeyEvent("keypress",!0,!0,window,!1,!1,!1,!1,0,"e".charCodeAt(0)),docElement.appendChild(e),e.addEventListener("input",r,!1),e.focus(),e.dispatchEvent(t),e.removeEventListener("input",r,!1),docElement.removeChild(e)}catch{A=!1}return A});var domPrefixesAll=[""].concat(domPrefixes);ModernizrProto._domPrefixesAll=domPrefixesAll;Modernizr.addTest("pointerevents",function(){for(var e=0,A=domPrefixesAll.length;e<A;e++)if(hasEvent(domPrefixesAll[e]+"pointerdown"))return!0;return!1});Modernizr.addAsyncTest(function(){var e,A=300;function t(){clearTimeout(e),window.removeEventListener("deviceproximity",t),addTest("proximity",!0)}"ondeviceproximity"in window&&"onuserproximity"in window?(window.addEventListener("deviceproximity",t),e=setTimeout(function(){window.removeEventListener("deviceproximity",t),addTest("proximity",!1)},A)):addTest("proximity",!1)});Modernizr.addTest("filereader",!!(window.File&&window.FileList&&window.FileReader));Modernizr.addTest("filesystem",!!prefixed("requestFileSystem",window));Modernizr.addAsyncTest(function(){var e=function(f){docElement.contains(f)||docElement.appendChild(f)},A=function(f){f.fake&&f.parentNode&&f.parentNode.removeChild(f)},t=function(f,u){var m=!!f;if(m&&(m=new Boolean(m),m.blocked=f==="blocked"),addTest("flash",function(){return m}),u&&a.contains(u)){for(;u.parentNode!==a;)u=u.parentNode;a.removeChild(u)}},r,n;try{n="ActiveXObject"in window&&"Pan"in new window.ActiveXObject("ShockwaveFlash.ShockwaveFlash")}catch{}if(r=!("plugins"in navigator&&"Shockwave Flash"in navigator.plugins||n),r||isSVG)t(!1);else{var o=createElement("embed"),a=getBody(),l,s;if(o.type="application/x-shockwave-flash",a.appendChild(o),!("Pan"in o)&&!n){e(a),t("blocked",o),A(a);return}l=function(){if(e(a),!docElement.contains(a))return a=document.body||a,o=createElement("embed"),o.type="application/x-shockwave-flash",a.appendChild(o),setTimeout(l,1e3);docElement.contains(o)?(s=o.style.cssText,t(s!==""?"blocked":!0,o)):t("blocked"),A(a)},setTimeout(l,10)}});Modernizr.addTest("fullscreen",!!(prefixed("exitFullscreen",document,!1)||prefixed("cancelFullScreen",document,!1)));Modernizr.addTest("gamepads",!!prefixed("getGamepads",navigator));Modernizr.addTest("geolocation","geolocation"in navigator);Modernizr.addTest("hiddenscroll",function(){return testStyles("#modernizr {width:100px;height:100px;overflow:scroll}",function(e){return e.offsetWidth===e.clientWidth})});Modernizr.addTest("history",function(){var e=navigator.userAgent;return!e||(e.indexOf("Android 2.")!==-1||e.indexOf("Android 4.0")!==-1)&&e.indexOf("Mobile Safari")!==-1&&e.indexOf("Chrome")===-1&&e.indexOf("Windows Phone")===-1&&location.protocol!=="file:"?!1:window.history&&"pushState"in window.history});Modernizr.addTest("htmlimports","import"in createElement("link"));Modernizr.addTest("ie8compat",!window.addEventListener&&!!document.documentMode&&document.documentMode===7);Modernizr.addTest("sandbox","sandbox"in createElement("iframe"));Modernizr.addTest("seamless","seamless"in createElement("iframe"));Modernizr.addTest("srcdoc","srcdoc"in createElement("iframe"));Modernizr.addAsyncTest(function(){if(!Modernizr.canvas)return!1;var e=new Image,A=createElement("canvas"),t=A.getContext("2d");e.onload=function(){addTest("apng",function(){return typeof A.getContext>"u"?!1:(t.drawImage(e,0,0),t.getImageData(0,0,1,1).data[3]===0)})},e.src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACGFjVEwAAAABAAAAAcMq2TYAAAANSURBVAiZY2BgYPgPAAEEAQB9ssjfAAAAGmZjVEwAAAAAAAAAAQAAAAEAAAAAAAAAAAD6A+gBAbNU+2sAAAARZmRBVAAAAAEImWNgYGBgAAAABQAB6MzFdgAAAABJRU5ErkJggg=="});Modernizr.addAsyncTest(function(){var e=new Image;e.onload=e.onerror=function(){addTest("avif",e.width===1)},e.src="data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAAEcbWV0YQAAAAAAAABIaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGNhdmlmIC0gaHR0cHM6Ly9naXRodWIuY29tL2xpbmstdS9jYXZpZgAAAAAeaWxvYwAAAAAEQAABAAEAAAAAAUQAAQAAABcAAAAqaWluZgEAAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFJbWFnZQAAAAAOcGl0bQAAAAAAAQAAAHJpcHJwAAAAUmlwY28AAAAQcGFzcAAAAAEAAAABAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAAFmF2MUOBAAwACggYAAYICGgIIAAAABhpcG1hAAAAAAAAAAEAAQUBAoMDhAAAAB9tZGF0CggYAAYICGgIIBoFHiAAAEQiBACwDoA="});Modernizr.addTest("imgcrossorigin","crossOrigin"in createElement("img"));Modernizr.addAsyncTest(function(){var e=new Image;e.onerror=function(){addTest("exiforientation",!1,{aliases:["exif-orientation"]})},e.onload=function(){addTest("exiforientation",e.width!==2,{aliases:["exif-orientation"]})},e.src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/4QAiRXhpZgAASUkqAAgAAAABABIBAwABAAAABgASAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD+/iiiigD/2Q=="});Modernizr.addAsyncTest(function(){var e=new Image;e.onload=e.onerror=function(){addTest("jpeg2000",e.width===1)},e.src="data:image/jp2;base64,/0//UQAyAAAAAAABAAAAAgAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAEBwEBBwEBBwEBBwEB/1IADAAAAAEAAAQEAAH/XAAEQED/ZAAlAAFDcmVhdGVkIGJ5IE9wZW5KUEVHIHZlcnNpb24gMi4wLjD/kAAKAAAAAABYAAH/UwAJAQAABAQAAf9dAAUBQED/UwAJAgAABAQAAf9dAAUCQED/UwAJAwAABAQAAf9dAAUDQED/k8+kEAGvz6QQAa/PpBABr994EAk//9k="});Modernizr.addAsyncTest(function(){var e=new Image;e.onload=e.onerror=function(){addTest("jpegxr",e.width===1,{aliases:["jpeg-xr"]})},e.src="data:image/vnd.ms-photo;base64,SUm8AQgAAAAFAAG8AQAQAAAASgAAAIC8BAABAAAAAQAAAIG8BAABAAAAAQAAAMC8BAABAAAAWgAAAMG8BAABAAAAHwAAAAAAAAAkw91vA07+S7GFPXd2jckNV01QSE9UTwAZAYBxAAAAABP/gAAEb/8AAQAAAQAAAA=="});Modernizr.addTest("lazyloading","loading"in HTMLImageElement.prototype);Modernizr.addAsyncTest(function(){var e,A,t,r=createElement("img"),n="sizes"in r;!n&&"srcset"in r?(A="data:image/gif;base64,R0lGODlhAgABAPAAAP///wAAACH5BAAAAAAALAAAAAACAAEAAAICBAoAOw==",e="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",t=function(){addTest("sizes",r.width===2)},r.onload=t,r.onerror=t,r.setAttribute("sizes","9px"),r.srcset=e+" 1w,"+A+" 8w",r.src=e):addTest("sizes",n)});Modernizr.addTest("srcset","srcset"in createElement("img"));Modernizr.addAsyncTest(function(){var e=new Image;e.onerror=function(){addTest("webpalpha",!1,{aliases:["webp-alpha"]})},e.onload=function(){addTest("webpalpha",e.width===1,{aliases:["webp-alpha"]})},e.src="data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA=="});Modernizr.addAsyncTest(function(){var e=new Image;e.onerror=function(){addTest("webpanimation",!1,{aliases:["webp-animation"]})},e.onload=function(){addTest("webpanimation",e.width===1,{aliases:["webp-animation"]})},e.src="data:image/webp;base64,UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA"});Modernizr.addAsyncTest(function(){var e=new Image;e.onerror=function(){addTest("webplossless",!1,{aliases:["webp-lossless"]})},e.onload=function(){addTest("webplossless",e.width===1,{aliases:["webp-lossless"]})},e.src="data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="});Modernizr.addAsyncTest(function(){var e=[{uri:"data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",name:"webp"},{uri:"data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==",name:"webp.alpha"},{uri:"data:image/webp;base64,UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA",name:"webp.animation"},{uri:"data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=",name:"webp.lossless"}],A=e.shift();function t(r,n,o){var a=new Image;function l(s){var f=s&&s.type==="load"?a.width===1:!1,u=r==="webp";addTest(r,u&&f?new Boolean(f):f),o&&o(s)}a.onerror=l,a.onload=l,a.src=n}t(A.name,A.uri,function(r){if(r&&r.type==="load")for(var n=0;n<e.length;n++)t(e[n].name,e[n].uri)})});Modernizr.addTest("capture","capture"in createElement("input"));Modernizr.addTest("fileinput",function(){var e=navigator.userAgent;if(e.match(/(Android (1.0|1.1|1.5|1.6|2.0|2.1))|(Windows Phone (OS 7|8.0))|(XBLWP)|(ZuneWP)|(w(eb)?OSBrowser)|(webOS)|(Kindle\/(1.0|2.0|2.5|3.0))/)||e.match(/\swv\).+(chrome)\/([\w\.]+)/i))return!1;var A=createElement("input");return A.type="file",!A.disabled});Modernizr.addTest("fileinputdirectory",function(){var e=createElement("input"),A="directory";e.type="file";for(var t=0,r=domPrefixesAll.length;t<r;t++)if(domPrefixesAll[t]+A in e)return!0;return!1});Modernizr.addTest("inputformaction","formAction"in createElement("input"),{aliases:["input-formaction"]});Modernizr.addTest("formattribute",function(){var e=createElement("form"),A=createElement("input"),t=createElement("div"),r="formtest"+new Date().getTime(),n,o=!1;e.id=r;try{A.setAttribute("form",r)}catch{document.createAttribute&&(n=document.createAttribute("form"),n.nodeValue=r,A.setAttributeNode(n))}return t.appendChild(e),t.appendChild(A),docElement.appendChild(t),o=e.elements&&e.elements.length===1&&A.form===e,t.parentNode.removeChild(t),o});Modernizr.addTest("inputformenctype","formEnctype"in createElement("input"),{aliases:["input-formenctype"]});Modernizr.addTest("inputformmethod","formMethod"in createElement("input"));Modernizr.addTest("inputformnovalidate","formNoValidate"in createElement("input"),{aliases:["input-formnovalidate"]});Modernizr.addTest("inputformtarget","formTarget"in createElement("input"),{aliases:["input-formtarget"]});var inputElem=createElement("input");var inputattrs="autocomplete autofocus list placeholder max min multiple pattern required step".split(" "),attrs={};Modernizr.input=function(e){for(var A=0,t=e.length;A<t;A++)attrs[e[A]]=e[A]in inputElem;return attrs.list&&(attrs.list=!!(createElement("datalist")&&window.HTMLDataListElement)),attrs}(inputattrs);(function(){for(var e=["search","tel","url","email","datetime","date","month","week","time","datetime-local","number","range","color"],A="1)",t,r,n,o=0;o<e.length;o++)inputElem.setAttribute("type",t=e[o]),n=inputElem.type!=="text"&&"style"in inputElem,n&&(inputElem.value=A,inputElem.style.cssText="position:absolute;visibility:hidden;",/^range$/.test(t)&&inputElem.style.WebkitAppearance!==undefined?(docElement.appendChild(inputElem),r=document.defaultView,n=r.getComputedStyle&&r.getComputedStyle(inputElem,null).WebkitAppearance!=="textfield"&&inputElem.offsetHeight!==0,docElement.removeChild(inputElem)):/^(search|tel)$/.test(t)||(/^(url|email)$/.test(t)?n=inputElem.checkValidity&&inputElem.checkValidity()===!1:n=inputElem.value!==A)),Modernizr.addTest("inputtypes."+t,!!n)})();Modernizr.addTest("formvalidation",function(){var e=createElement("form");if(!("checkValidity"in e)||!("addEventListener"in e))return!1;if("reportValidity"in e)return!0;var A=!1,t;return Modernizr.formvalidationapi=!0,e.addEventListener("submit",function(r){(!window.opera||window.operamini)&&r.preventDefault(),r.stopPropagation()},!1),e.innerHTML='<input name="modTest" required="required" /><button></button>',testStyles("#modernizr form{position:absolute;top:-99999em}",function(r){r.appendChild(e),t=e.getElementsByTagName("input")[0],t.addEventListener("invalid",function(n){A=!0,n.preventDefault(),n.stopPropagation()},!1),Modernizr.formvalidationmessage=!!t.validationMessage,e.getElementsByTagName("button")[0].click()}),A});Modernizr.addTest("localizednumber",function(){if(!Modernizr.inputtypes.number||!Modernizr.formvalidation)return!1;var e=getBody(),A=createElement("div"),t=e.firstElementChild||e.firstChild,r;e.insertBefore(A,t),A.innerHTML='<input type="number" value="1.0" step="0.1" style="position: fixed; top: 0;" />';var n=A.childNodes[0];e.appendChild(A),n.focus();try{document.execCommand("SelectAll",!1),document.execCommand("InsertText",!1,"1,1")}catch{}return r=n.type==="number"&&n.valueAsNumber===1.1&&n.checkValidity(),e.removeChild(A),e.fake&&e.parentNode&&e.parentNode.removeChild(e),r});Modernizr.addTest("inputsearchevent",hasEvent("search"));Modernizr.addTest("placeholder","placeholder"in createElement("input")&&"placeholder"in createElement("textarea"));Modernizr.addTest("requestautocomplete",!!prefixed("requestAutocomplete",createElement("form")));Modernizr.addTest("intl",!!prefixed("Intl",window));Modernizr.addTest("ligatures",testAllProps("fontFeatureSettings",'"liga" 1'));Modernizr.addTest("olreversed","reversed"in createElement("ol"));Modernizr.addTest("mathml",function(){var e;return testStyles("#modernizr{position:absolute;display:inline-block}",function(A){A.innerHTML+="<math><mfrac><mi>xx</mi><mi>yy</mi></mfrac></math>",e=A.offsetHeight>A.offsetWidth}),e});Modernizr.addTest("mediasource","MediaSource"in window);Modernizr.addTest("hovermq",mq("(hover)"));Modernizr.addTest("pointermq",mq("(pointer:coarse),(pointer:fine),(pointer:none)"));Modernizr.addTest("messagechannel","MessageChannel"in window);Modernizr.addTest("beacon","sendBeacon"in navigator);Modernizr.addTest("effectiveType",function(){var e=navigator.connection||{effectiveType:0};return e.effectiveType!==0});Modernizr.addTest("lowbandwidth",function(){var e=navigator.connection||{type:0,effectiveType:0};return e.type===3||e.type===4||/^[23]g$/.test(e.effectiveType)});Modernizr.addTest("eventsource","EventSource"in window);Modernizr.addTest("fetch","fetch"in window);var testXhrType=function(e){if(typeof XMLHttpRequest>"u")return!1;var A=new XMLHttpRequest;A.open("get","/",!0);try{A.responseType=e}catch{return!1}return"response"in A&&A.responseType===e};Modernizr.addTest("xhrresponsetypearraybuffer",testXhrType("arraybuffer"));Modernizr.addTest("xhrresponsetypeblob",testXhrType("blob"));Modernizr.addTest("xhrresponsetypedocument",testXhrType("document"));Modernizr.addTest("xhrresponsetypejson",testXhrType("json"));Modernizr.addTest("xhrresponsetypetext",testXhrType("text"));Modernizr.addTest("xhrresponsetype",function(){if(typeof XMLHttpRequest>"u")return!1;var e=new XMLHttpRequest;return e.open("get","/",!0),"response"in e}());Modernizr.addTest("xhr2","XMLHttpRequest"in window&&"withCredentials"in new XMLHttpRequest);Modernizr.addTest("notification",function(){if(!window.Notification||!window.Notification.requestPermission)return!1;if(window.Notification.permission==="granted")return!0;try{new window.Notification("")}catch(e){if(e.name==="TypeError")return!1}return!0});Modernizr.addTest("pagevisibility",!!prefixed("hidden",document,!1));Modernizr.addTest("performance",!!prefixed("performance",window));Modernizr.addTest("pointerlock",!!prefixed("exitPointerLock",document));var bool=!0;try{window.postMessage({toString:function(){bool=!1}},"*")}catch(e){}Modernizr.addTest("postmessage",new Boolean("postMessage"in window)),Modernizr.addTest("postmessage.structuredclones",bool);Modernizr.addTest("proxy","Proxy"in window);Modernizr.addTest("queryselector","querySelector"in document&&"querySelectorAll"in document);Modernizr.addTest("prefetch",function(){if(document.documentMode===11)return!0;var e=createElement("link").relList;return!e||!e.supports?!1:e.supports("prefetch")});Modernizr.addTest("requestanimationframe",!!prefixed("requestAnimationFrame",window),{aliases:["raf"]});Modernizr.addTest("scriptasync","async"in createElement("script"));Modernizr.addTest("scriptdefer","defer"in createElement("script"));Modernizr.addTest("scrolltooptions",function(){var e=getBody(),A=window.pageYOffset,t=e.clientHeight<=window.innerHeight;if(t){var r=createElement("div");r.style.height=window.innerHeight-e.clientHeight+1+"px",r.style.display="block",e.appendChild(r)}window.scrollTo({top:1});var n=window.pageYOffset!==0;return t&&e.removeChild(r),window.scrollTo(0,A),n});Modernizr.addTest("serviceworker","serviceWorker"in navigator);Modernizr.addTest("speechrecognition",function(){try{return!!prefixed("SpeechRecognition",window)}catch{return!1}});Modernizr.addTest("speechsynthesis",function(){try{return"SpeechSynthesisUtterance"in window}catch{return!1}});Modernizr.addTest("cookies",function(){try{document.cookie="cookietest=1";var e=document.cookie.indexOf("cookietest=")!==-1;return document.cookie="cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT",e}catch{return!1}});Modernizr.addAsyncTest(function(){var e;try{e=prefixed("indexedDB",window)}catch{}if(e){var A="modernizr-"+Math.random(),t;try{t=e.open(A)}catch{addTest("indexeddb",!1);return}t.onerror=function(r){t.error&&(t.error.name==="InvalidStateError"||t.error.name==="UnknownError")?(addTest("indexeddb",!1),r.preventDefault()):(addTest("indexeddb",!0),detectDeleteDatabase(e,A))},t.onsuccess=function(){addTest("indexeddb",!0),detectDeleteDatabase(e,A)}}else addTest("indexeddb",!1)});function detectDeleteDatabase(e,A){var t=e.deleteDatabase(A);t.onsuccess=function(){addTest("indexeddb.deletedatabase",!0)},t.onerror=function(){addTest("indexeddb.deletedatabase",!1)}}Modernizr.addAsyncTest(function(){var e,A="detect-blob-support",t=!1,r,n,o;try{e=prefixed("indexedDB",window)}catch{}if(!(Modernizr.indexeddb&&Modernizr.indexeddb.deletedatabase))return!1;try{e.deleteDatabase(A).onsuccess=function(){r=e.open(A,1),r.onupgradeneeded=function(){r.result.createObjectStore("store")},r.onsuccess=function(){n=r.result;try{o=n.transaction("store","readwrite").objectStore("store").put(new Blob,"key"),o.onsuccess=function(){t=!0},o.onerror=function(){t=!1}}catch{t=!1}finally{addTest("indexeddbblob",t),n.close(),e.deleteDatabase(A)}}}}catch{addTest("indexeddbblob",!1)}});Modernizr.addAsyncTest(function(){Modernizr.on("indexeddb",function(e){e&&addTest("indexeddb2","getAll"in IDBIndex.prototype)})});Modernizr.addTest("localstorage",function(){var e="modernizr";try{return localStorage.setItem(e,e),localStorage.removeItem(e),!0}catch{return!1}});Modernizr.addTest("quotamanagement",function(){var e=prefixed("temporaryStorage",navigator),A=prefixed("persistentStorage",navigator);return!!(e&&A)});Modernizr.addTest("sessionstorage",function(){var e="modernizr";try{return sessionStorage.setItem(e,e),sessionStorage.removeItem(e),!0}catch{return!1}});Modernizr.addTest("userdata",!!createElement("div").addBehavior);Modernizr.addTest("websqldatabase","openDatabase"in window);Modernizr.addTest("stylescoped","scoped"in createElement("style"));Modernizr.addTest("svg",!!document.createElementNS&&!!document.createElementNS("http://www.w3.org/2000/svg","svg").createSVGRect);Modernizr.addTest("svgasimg",document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#Image","1.1"));var toStringFn={}.toString;Modernizr.addTest("svgclippaths",function(){return!!document.createElementNS&&/SVGClipPath/.test(toStringFn.call(document.createElementNS("http://www.w3.org/2000/svg","clipPath")))});Modernizr.addTest("svgfilters",function(){var e=!1;try{e="SVGFEColorMatrixElement"in window&&SVGFEColorMatrixElement.SVG_FECOLORMATRIX_TYPE_SATURATE===2}catch{}return e});Modernizr.addTest("svgforeignobject",function(){return!!document.createElementNS&&/SVGForeignObject/.test(toStringFn.call(document.createElementNS("http://www.w3.org/2000/svg","foreignObject")))});Modernizr.addTest("inlinesvg",function(){var e=createElement("div");return e.innerHTML="<svg/>",(typeof SVGRect<"u"&&e.firstChild&&e.firstChild.namespaceURI)==="http://www.w3.org/2000/svg"});Modernizr.addTest("smil",function(){return!!document.createElementNS&&/SVGAnimate/.test(toStringFn.call(document.createElementNS("http://www.w3.org/2000/svg","animate")))});Modernizr.addTest("textareamaxlength","maxLength"in createElement("textarea"));Modernizr.addTest("textencoder",!!(window.TextEncoder&&window.TextEncoder.prototype.encode)),Modernizr.addTest("textdecoder",!!(window.TextDecoder&&window.TextDecoder.prototype.decode));Modernizr.addTest("typedarrays","ArrayBuffer"in window);Modernizr.addTest("unicoderange",function(){return testStyles('@font-face{font-family:"unicodeRange";src:local("Arial");unicode-range:U+0020,U+002E}#modernizr span{font-size:20px;display:inline-block;font-family:"unicodeRange",monospace}#modernizr .mono{font-family:monospace}',function(e){for(var A=[".",".","m","m"],t=0;t<A.length;t++){var r=createElement("span");r.innerHTML=A[t],r.className=t%2?"mono":"",e.appendChild(r),A[t]=r.clientWidth}return A[0]!==A[1]&&A[2]===A[3]})});var url=prefixed("URL",window,!1);url=url&&window[url],Modernizr.addTest("bloburls",url&&"revokeObjectURL"in url&&"createObjectURL"in url);Modernizr.addAsyncTest(function(){navigator.userAgent.indexOf("MSIE 7.")!==-1&&setTimeout(function(){Modernizr.addTest("datauri",new Boolean(!1))},10);var e=new Image;e.onerror=function(){Modernizr.addTest("datauri",new Boolean(!1))},e.onload=function(){e.width===1&&e.height===1?A():Modernizr.addTest("datauri",new Boolean(!1))},e.src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";function A(){var t=new Image;t.onerror=function(){Modernizr.addTest("datauri",new Boolean(!0)),Modernizr.addTest("datauri.over32kb",!1)},t.onload=function(){Modernizr.addTest("datauri",new Boolean(!0)),Modernizr.addTest("datauri.over32kb",t.width===1&&t.height===1)};for(var r="R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";r.length<33e3;)r=`\r
`+r;t.src="data:image/gif;base64,"+r}});Modernizr.addTest("urlparser",function(){var e;try{return e=new URL("http://modernizr.com/"),e.href==="http://modernizr.com/"}catch{return!1}});Modernizr.addTest("urlsearchparams","URLSearchParams"in window);Modernizr.addTest("vibrate",!!prefixed("vibrate",navigator));(function(){var e=createElement("video");Modernizr.addTest("video",function(){var A=!1;try{A=!!e.canPlayType,A&&(A=new Boolean(A))}catch{}return A});try{e.canPlayType&&(Modernizr.addTest("video.ogg",e.canPlayType('video/ogg; codecs="theora"').replace(/^no$/,"")),Modernizr.addTest("video.h264",e.canPlayType('video/mp4; codecs="avc1.42E01E"').replace(/^no$/,"")),Modernizr.addTest("video.h265",e.canPlayType('video/mp4; codecs="hev1"').replace(/^no$/,"")),Modernizr.addTest("video.webm",e.canPlayType('video/webm; codecs="vp8, vorbis"').replace(/^no$/,"")),Modernizr.addTest("video.vp9",e.canPlayType('video/webm; codecs="vp9"').replace(/^no$/,"")),Modernizr.addTest("video.hls",e.canPlayType('application/x-mpegURL; codecs="avc1.42E01E"').replace(/^no$/,"")),Modernizr.addTest("video.av1",e.canPlayType('video/mp4; codecs="av01"').replace(/^no$/,"")))}catch{}})();Modernizr.addAsyncTest(function(){var e,A=200,t=5,r=0,n=createElement("video"),o=n.style;function a(l){r++,clearTimeout(e);var s=l&&l.type==="playing"||n.currentTime!==0;if(!s&&r<t){e=setTimeout(a,A);return}n.removeEventListener("playing",a,!1),addTest("videoautoplay",s),n.parentNode&&n.parentNode.removeChild(n)}if(!Modernizr.video||!("autoplay"in n)){addTest("videoautoplay",!1);return}o.position="absolute",o.height=0,o.width=0;try{if(Modernizr.video.ogg)n.src="data:video/ogg;base64,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";else if(Modernizr.video.h264)n.src="data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAs1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjYwMSBhMGNkN2QzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAA3//728P4FNjuZQQAAAu5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACGHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAgAAAAIAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAGQAAAAAAAEAAAAAAZBtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAEAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE7bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA+3N0YmwAAACXc3RzZAAAAAAAAAABAAAAh2F2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAgACAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAxYXZjQwFkAAr/4QAYZ2QACqzZX4iIhAAAAwAEAAADAFA8SJZYAQAGaOvjyyLAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAQAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAsUAAAABAAAAFHN0Y28AAAAAAAAAAQAAADAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU2LjQwLjEwMQ==";else{addTest("videoautoplay",!1);return}}catch{addTest("videoautoplay",!1);return}n.setAttribute("autoplay",""),o.cssText="display:none",docElement.appendChild(n),setTimeout(function(){n.addEventListener("playing",a,!1),e=setTimeout(a,A)},0)});Modernizr.addTest("videocrossorigin","crossOrigin"in createElement("video"));Modernizr.addTest("videoloop","loop"in createElement("video"));Modernizr.addTest("videopreload","preload"in createElement("video"));Modernizr.addTest("vml",function(){var e=createElement("div"),A=!1,t;return isSVG||(e.innerHTML='<v:shape id="vml_flag1" adj="1" />',t=e.firstChild,"style"in t&&(t.style.behavior="url(#default#VML)"),A=t?typeof t.adj=="object":!0),A});Modernizr.addTest("webintents",!!prefixed("startActivity",navigator));Modernizr.addTest("webanimations","animate"in createElement("div"));Modernizr.addTest("publicKeyCredential",function(){return!!window.PublicKeyCredential});Modernizr.addTest("webgl",function(){return"WebGLRenderingContext"in window});Modernizr.addAsyncTest(function(){if(Modernizr.webglextensions=!1,!!Modernizr.webgl){var e,A,t;try{e=createElement("canvas"),A=e.getContext("webgl")||e.getContext("experimental-webgl"),t=A.getSupportedExtensions()}catch{return}A!==undefined&&(Modernizr.webglextensions=new Boolean(!0));for(var r=-1,n=t.length;++r<n;)Modernizr.webglextensions[t[r]]=!0;e=undefined}});Modernizr.addTest("peerconnection",!!prefixed("RTCPeerConnection",window));Modernizr.addTest("datachannel",function(){if(!Modernizr.peerconnection)return!1;for(var e=0,A=domPrefixesAll.length;e<A;e++){var t=window[domPrefixesAll[e]+"RTCPeerConnection"];if(t)try{var r=new t({});return"createDataChannel"in r}catch{}}return!1});Modernizr.addTest("getUserMedia","mediaDevices"in navigator&&"getUserMedia"in navigator.mediaDevices);Modernizr.addTest("mediastream",typeof MediaRecorder<"u");var supports=!1;try{supports="WebSocket"in window&&window.WebSocket.CLOSING===2}catch(e){}Modernizr.addTest("websockets",supports);Modernizr.addTest("websocketsbinary",function(){var e=location.protocol==="https:"?"wss":"ws",A;if("WebSocket"in window){if(A="binaryType"in WebSocket.prototype,A)return A;try{return!!new WebSocket(e+"://.").binaryType}catch{}}return!1});Modernizr.addTest("atobbtoa","atob"in window&&"btoa"in window,{aliases:["atob-btoa"]});Modernizr.addTest("framed",window.location!==top.location);Modernizr.addTest("matchmedia",!!prefixed("matchMedia",window));Modernizr.addTest("pushmanager","PushManager"in window);Modernizr.addTest("resizeobserver","ResizeObserver"in window);Modernizr.addTest("workertypeoption",function(){if("Worker"in window){var e=!1,A={get type(){return e=!0,"module"}},t="var message='hello'",r=new Blob([t],{type:"text/javascript"}),n=URL.createObjectURL(r);try{return new Worker(n,A).terminate(),e}catch{return!1}}else return!1});Modernizr.addAsyncTest(function(){try{var e=window.BlobBuilder,A=window.URL;Modernizr._config.usePrefix&&(e=e||window.MozBlobBuilder||window.WebKitBlobBuilder||window.MSBlobBuilder||window.OBlobBuilder,A=A||window.MozURL||window.webkitURL||window.MSURL||window.OURL);var t="Modernizr",r,n,o,a,l,s="this.onmessage=function(e){postMessage(e.data)}";try{r=new Blob([s],{type:"text/javascript"})}catch{}r||(n=new e,n.append(s),r=n.getBlob()),a=A.createObjectURL(r),o=new Worker(a),o.onmessage=function(m){addTest("blobworkers",t===m.data),u()},o.onerror=f,l=setTimeout(f,200),o.postMessage(t)}catch{f()}function f(){addTest("blobworkers",!1),u()}function u(){a&&A.revokeObjectURL(a),o&&o.terminate(),l&&clearTimeout(l)}});Modernizr.addAsyncTest(function(){try{var e="Modernizr",A=new Worker("data:text/javascript;base64,dGhpcy5vbm1lc3NhZ2U9ZnVuY3Rpb24oZSl7cG9zdE1lc3NhZ2UoZS5kYXRhKX0=");A.onmessage=function(t){A.terminate(),addTest("dataworkers",e===t.data),A=null},A.onerror=function(){addTest("dataworkers",!1),A=null},setTimeout(function(){addTest("dataworkers",!1)},200),A.postMessage(e)}catch{setTimeout(function(){addTest("dataworkers",!1)},0)}});Modernizr.addTest("sharedworkers","SharedWorker"in window);Modernizr.addTest("webworkers","Worker"in window);Modernizr.addAsyncTest(function(){var e=!!(Modernizr.blobconstructor&&Modernizr.bloburls&&Modernizr.webworkers&&Modernizr.typedarrays);if(!e)return addTest("transferables",!1);try{var A,t='var hello = "world"',r=new Blob([t],{type:"text/javascript"}),n=URL.createObjectURL(r),o=new Worker(n),a;o.onerror=l,a=setTimeout(l,200),A=new ArrayBuffer(1),o.postMessage(A,[A]),addTest("transferables",A.byteLength===0),s()}catch{l()}function l(){addTest("transferables",!1),s()}function s(){n&&URL.revokeObjectURL(n),o&&o.terminate(),a&&clearTimeout(a)}});Modernizr.addTest("xdomainrequest","XDomainRequest"in window),testRunner(),setClasses(classes),delete ModernizrProto.addTest,delete ModernizrProto.addAsyncTest;for(var i=0;i<Modernizr._q.length;i++)Modernizr._q[i]();scriptGlobalObject.Modernizr=Modernizr})(window,window,document)});Y();})();
/*!
 * modernizr v4.0.0-alpha
 * Build https://modernizr.com/download?-adownload-ambientlight-aping-apng-appearance-applicationcache-areaping-arrow-aspectratio-atobbtoa-audio-audioautoplay-audioloop-audiopreload-avif-backdropfilter-backgroundblendmode-backgroundcliptext-backgroundsize-batteryapi-bdi-beacon-bgpositionshorthand-bgpositionxy-bgrepeatspace_bgrepeatround-bgsizecover-blobconstructor-bloburls-blobworkers-borderimage-borderradius-boxdecorationbreak-boxshadow-boxsizing-broadcastchannel-canvas-canvasblending-canvastext-canvaswinding-capture-checked-classlist-clipboard-connectioneffectivetype-contenteditable-contextmenu-cookies-cors-createelementattrs_createelement_attrs-cryptography-cssall-cssanimations-csscalc-csschunit-csscolumns-cssescape-cssexunit-cssfilters-cssgradients-cssgrid_cssgridlegacy-csshyphens_softhyphens_softhyphensfind-cssinvalid-cssmask-csspointerevents-csspositionsticky-csspseudoanimations-csspseudotransitions-cssreflections-cssremunit-cssresize-cssscrollbar-csstransforms-csstransforms3d-csstransformslevel2-csstransitions-cssvalid-cssvhunit-cssvmaxunit-cssvminunit-cssvwunit-cubicbezierrange-customelements-customevent-customproperties-customprotocolhandler-dart-datachannel-dataset-datauri-dataview-dataworkers-details-devicemotion_deviceorientation-directory-display_runin-displaytable-documentfragment-ellipsis-emoji-es5-es5array-es5date-es5function-es5object-es5string-es5syntax-es5undefined-es6array-es6class-es6collections-es6math-es6number-es6object-es6string-es6symbol-es7array-es8object-eventlistener-eventsource-exiforientation-fetch-fileinput-filereader-filesystem-flash-flexbox-flexboxlegacy-flexboxtweener-flexgap-flexwrap-focusvisible-focuswithin-fontdisplay-fontface-forcetouch-formattribute-formvalidation-framed-fullscreen-gamepads-generatedcontent-generators-geolocation-getrandomvalues-getusermedia-hairline-hashchange-hidden-hiddenscroll-history-hovermq-hsla-htmlimports-ie8compat-imgcrossorigin-indexeddb-indexeddb2-indexeddbblob-inlinesvg-input-inputformaction-inputformenctype-inputformmethod-inputformnovalidate-inputformtarget-inputsearchevent-inputtypes-intersectionobserver-intl-jpeg2000-jpegxr-json-lastchild-lazyloading-ligatures-localizednumber-localstorage-lowbandwidth-lowbattery-matchmedia-mathml-mediaqueries-mediarecorder-mediasource-messagechannel-microdata-multiplebgs-mutationobserver-notification-nthchild-objectfit-olreversed-oninput-opacity-outputelem-overflowscrolling-pagevisibility-passiveeventlisteners-peerconnection-performance-picture-placeholder-pointerevents-pointerlock-pointermq-postmessage-prefetch-preserve3d-progressbar_meter-promises-proximity-proxy-publickeycredential-pushmanager-queryselector-quotamanagement-regions-requestanimationframe-requestautocomplete-resizeobserver-restdestructuringarray_restdestructuringobject-restparameters-rgba-ruby-sandbox-scriptasync-scriptdefer-scrollsnappoints-scrolltooptions-seamless-serviceworker-sessionstorage-shadowroot-shadowrootlegacy-shapes-sharedworkers-siblinggeneral-sizes-smil-speechrecognition-speechsynthesis-spreadarray-spreadobject-srcdoc-srcset-strictmode-stringtemplate-stylescoped-subpixelfont-supports-svg-svgasimg-svgclippaths-svgfilters-svgforeignobject-target-template-textalignlast-textareamaxlength-textdecoration-textencoder_textdecoder-textshadow-texttrackapi_track-time-todataurljpeg_todataurlpng_todataurlwebp-transferables-typedarrays-unicoderange-unknownelements-urlparser-urlsearchparams-userdata-userselect-variablefonts-vibrate-video-videoautoplay-videocrossorigin-videoloop-videopreload-vml-webanimations-webaudio-webgl-webglextensions-webintents-webp-webpalpha-webpanimation-webplossless_webp_lossless-websockets-websocketsbinary-websqldatabase-webworkers-willchange-workertypeoption-wrapflow-xdomainrequest-xhr2-xhrresponsetype-xhrresponsetypearraybuffer-xhrresponsetypeblob-xhrresponsetypedocument-xhrresponsetypejson-xhrresponsetypetext-addtest-atrule-domprefixes-hasevent-load-mq-prefixed-prefixedcss-prefixes-printshiv-setclasses-testallprops-testprop-teststyles-dontmin
 *
 * Copyright (c)
 *  Faruk Ates
 *  Paul Irish
 *  Alex Sexton
 *  Ryan Seddon
 *  Patrick Kettner
 *  Stu Cox
 *  Richard Herrera
 *  Veeck

 * MIT License
 */
/**
 * @preserve HTML5 Shiv 3.7.3 | @afarkas @jdalton @jon_neal @rem | MIT/GPL2 Licensed
 */
/*!
{
  "name": "a[download] Attribute",
  "property": "adownload",
  "caniuse": "download",
  "tags": ["media", "attribute"],
  "builderAliases": ["a_download"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://developers.whatwg.org/links.html#downloading-resources"
  }]
}
!*/
/*!
{
  "name": "a[ping] Attribute",
  "property": "aping",
  "caniuse": "ping",
  "tags": ["media", "attribute"],
  "builderAliases": ["a_ping"],
  "authors": ["Hélio Correia (@heliocorreia)"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/dev/links.html#ping"
  }]
}
!*/
/*!
{
  "name": "area[ping] Attribute",
  "property": "areaping",
  "caniuse": "ping",
  "tags": ["media", "attribute"],
  "builderAliases": ["area_ping"],
  "authors": ["Hélio Correia (@heliocorreia)"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/dev/links.html#ping"
  }]
}
!*/
/*!
{
  "name": "Ambient Light Events",
  "property": "ambientlight",
  "caniuse": "ambient-light",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/ambient-light/"
  }]
}
!*/
/*!
{
  "name": "Application Cache",
  "property": "applicationcache",
  "caniuse": "offline-apps",
  "tags": ["storage", "offline"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/docs/HTML/Using_the_application_cache"
  }],
  "polyfills": ["html5gears"]
}
!*/
/*!
{
  "name": "HTML5 Audio Element",
  "property": "audio",
  "caniuse": "audio",
  "tags": ["html5", "audio", "media"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/En/Media_formats_supported_by_the_audio_and_video_elements"
  }]
}
!*/
/*!
{
  "name": "Audio Autoplay",
  "property": "audioautoplay",
  "authors": ["Jordy van Dortmont"],
  "tags": ["audio"],
  "async": true
}
!*/
/*!
{
  "name": "Audio Loop Attribute",
  "property": "audioloop",
  "tags": ["audio", "media"]
}
!*/
/*!
{
  "name": "Audio Preload",
  "property": "audiopreload",
  "tags": ["audio", "media"],
  "async": true,
  "warnings": ["This test is very large – only include it if you absolutely need it"]
}
!*/
/*!
{
  "name": "Web Audio API",
  "property": "webaudio",
  "caniuse": "audio-api",
  "polyfills": ["dynamicaudiojs", "audiolibjs"],
  "tags": ["audio", "media"],
  "builderAliases": ["audio_webaudio_api"],
  "authors": ["Addy Osmani"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://webaudio.github.io/web-audio-api/"
  }]
}
!*/
/*!
{
  "name": "Battery API",
  "property": "batteryapi",
  "aliases": ["battery-api"],
  "builderAliases": ["battery_api"],
  "tags": ["battery", "device", "media"],
  "authors": ["Paul Sayre", "Alex Bradley (@abrad1212)"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/DOM/window.navigator.mozBattery"
  }]
}
!*/
/*!
{
  "name": "Low Battery Level",
  "property": "lowbattery",
  "tags": ["battery", "hardware", "mobile"],
  "builderAliases": ["battery_level"],
  "authors": ["Paul Sayre"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/battery"
  }]
}
!*/
/*!
{
  "name": "Blob constructor",
  "property": "blobconstructor",
  "aliases": ["blob-constructor"],
  "builderAliases": ["blob_constructor"],
  "caniuse": "blobbuilder",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://w3c.github.io/FileAPI/#constructorBlob"
  }],
  "polyfills": ["blobjs"]
}
!*/
/*!
{
  "name": "Broadcast Channel",
  "property": "broadcastchannel",
  "authors": ["Alex Neises (@AlexNeises)"],
  "caniuse": "broadcastchannel",
  "tags": ["performance", "broadcastchannel"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel"
  }]
}
!*/
/*!
{
  "name": "Canvas",
  "property": "canvas",
  "caniuse": "canvas",
  "tags": ["canvas", "graphics"],
  "polyfills": ["excanvas", "slcanvas"]
}
!*/
/*!
{
  "name": "canvas blending support",
  "property": "canvasblending",
  "caniuse": "canvas-blending",
  "tags": ["canvas"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://drafts.fxtf.org/compositing-1/"
  }, {
    "name": "Article",
    "href": "https://web.archive.org/web/20171003232921/http://blogs.adobe.com/webplatform/2013/01/28/blending-features-in-canvas/"
  }]
}
!*/
/*!
{
  "name": "canvas.toDataURL type support",
  "property": ["todataurljpeg", "todataurlpng", "todataurlwebp"],
  "tags": ["canvas"],
  "builderAliases": ["canvas_todataurl_type"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement.toDataURL"
  }]
}
!*/
/*!
{
  "name": "canvas winding support",
  "property": "canvaswinding",
  "tags": ["canvas"],
  "notes": [{
    "name": "Article",
    "href": "https://web.archive.org/web/20170825024655/http://blogs.adobe.com/webplatform/2013/01/30/winding-rules-in-canvas/"
  }]
}
!*/
/*!
{
  "name": "Canvas text",
  "property": "canvastext",
  "caniuse": "canvas-text",
  "tags": ["canvas", "graphics"],
  "polyfills": ["canvastext"]
}
!*/
/*!
{
  "name": "Clipboard API",
  "property": "clipboard",
  "tags": ["clipboard"],
  "authors": ["Markel Ferro (@MarkelFe)"],
  "async": true,
  "warnings": ["It may return false in non-HTTPS connections as the API is only available in secure contexts"],
  "notes": [{
    "name": "MDN Docs Clipboard Object",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Clipboard"
  }, {
    "name": "MDN Docs Clipboard API",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API"
  }]
}
!*/
/*!
{
  "name": "Content Editable",
  "property": "contenteditable",
  "caniuse": "contenteditable",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/interaction.html#contenteditable"
  }]
}
!*/
/*!
{
  "name": "Context menus",
  "property": "contextmenu",
  "caniuse": "menu",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/html5/interactive-elements.html#context-menus"
  }, {
    "name": "thewebrocks.com Demo",
    "href": "http://thewebrocks.com/demos/context-menu/"
  }],
  "polyfills": ["jquery-contextmenu"]
}
!*/
/*!
{
  "name": "Cross-Origin Resource Sharing",
  "property": "cors",
  "caniuse": "cors",
  "authors": ["Theodoor van Donge"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/HTTP/Access_control_CORS"
  }],
  "polyfills": ["pmxdr", "ppx", "flxhr"]
}
!*/
/*!
{
  "name": "Web Cryptography",
  "property": "cryptography",
  "caniuse": "cryptography",
  "tags": ["crypto"],
  "authors": ["roblarsen"],
  "notes": [{
    "name": "W3C Editor's Draft Spec",
    "href": "https://www.w3.org/TR/WebCryptoAPI/"
  }]
}
!*/
/*!
{
  "name": "getRandomValues",
  "property": "getrandomvalues",
  "caniuse": "getrandomvalues",
  "tags": ["crypto"],
  "authors": ["komachi"],
  "notes": [{
    "name": "W3C Editor’s Draft Spec",
    "href": "https://w3c.github.io/webcrypto/#Crypto-interface-methods"
  }]
}
!*/
/*!
{
  "name": "cssall",
  "property": "cssall",
  "notes": [{
    "name": "Spec",
    "href": "https://drafts.csswg.org/css-cascade/#all-shorthand"
  }]
}
!*/
/*!
{
  "name": "CSS Animations",
  "property": "cssanimations",
  "caniuse": "css-animation",
  "polyfills": ["transformie", "csssandpaper"],
  "tags": ["css"],
  "warnings": ["Android < 4 will pass this test, but can only animate a single property at a time"],
  "notes": [{
    "name": "Article: 'Dispelling the Android CSS animation myths'",
    "href": "https://web.archive.org/web/20180602074607/https://daneden.me/2011/12/14/putting-up-with-androids-bullshit/"
  }]
}
!*/
/*!
{
  "name": "Appearance",
  "property": "appearance",
  "caniuse": "css-appearance",
  "tags": ["css"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/-moz-appearance"
  }, {
    "name": "CSS-Tricks CSS Almanac: appearance",
    "href": "https://css-tricks.com/almanac/properties/a/appearance/"
  }]
}
!*/
/*!
{
  "name": "aspectratio css property",
  "property": "aspectratio",
  "tags": ["css aspectratio", "aspect-ratio"],
  "builderAliases": ["aspectratio"],
  "caniuse":"mdn-css_properties_aspect-ratio",
  "authors": ["Debadutta Panda"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio"
  }]
}
!*/
/*!
{
  "name": "Backdrop Filter",
  "property": "backdropfilter",
  "authors": ["Brian Seward"],
  "tags": ["css"],
  "caniuse": "css-backdrop-filter",
  "notes": [{
    "name": "W3C Editor’s Draft Spec",
    "href": "https://drafts.fxtf.org/filters-2/#BackdropFilterProperty"
  }, {
    "name": "WebKit Blog introduction + Demo",
    "href": "https://www.webkit.org/blog/3632/introducing-backdrop-filters/"
  }]
}
!*/
/*!
{
  "name": "CSS Background Blend Mode",
  "property": "backgroundblendmode",
  "caniuse": "css-backgroundblendmode",
  "tags": ["css"],
  "notes": [{
    "name": "CSS Blend Modes could be the next big thing in Web Design",
    "href": "https://medium.com/@bennettfeely/css-blend-modes-could-be-the-next-big-thing-in-web-design-6b51bf53743a"
  }, {
    "name": "Demo",
    "href": "https://bennettfeely.com/gradients/"
  }]
}
!*/
/*!
{
  "name": "CSS Background Clip Text",
  "property": "backgroundcliptext",
  "authors": ["ausi"],
  "tags": ["css"],
  "notes": [{
    "name": "CSS Tricks Article",
    "href": "https://css-tricks.com/image-under-text/"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/background-clip"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/199"
  }]
}
!*/
/*!
{
  "name": "Background Position Shorthand",
  "property": "bgpositionshorthand",
  "caniuse": "css-background-offsets",
  "tags": ["css"],
  "builderAliases": ["css_backgroundposition_shorthand"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/CSS/background-position"
  }, {
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-background/#background-position"
  }, {
    "name": "Demo",
    "href": "https://jsfiddle.net/Blink/bBXvt/"
  }]
}
!*/
/*!
{
  "name": "Background Position XY",
  "property": "bgpositionxy",
  "tags": ["css"],
  "builderAliases": ["css_backgroundposition_xy"],
  "authors": ["Allan Lei", "Brandom Aaron"],
  "notes": [{
    "name": "Demo",
    "href": "https://jsfiddle.net/allanlei/R8AYS/"
  }, {
    "name": "Adapted From",
    "href": "https://github.com/brandonaaron/jquery-cssHooks/blob/master/bgpos.js"
  }]
}
!*/
/*!
{
  "name": "Background Repeat",
  "property": ["bgrepeatspace", "bgrepeatround"],
  "tags": ["css"],
  "builderAliases": ["css_backgroundrepeat"],
  "authors": ["Ryan Seddon"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/background-repeat"
  }, {
    "name": "Test Page",
    "href": "https://jsbin.com/uzesun/"
  }, {
    "name": "Demo",
    "href": "https://jsfiddle.net/ryanseddon/yMLTQ/6/"
  }]
}
!*/
/*!
{
  "name": "Background Size",
  "property": "backgroundsize",
  "tags": ["css"],
  "knownBugs": ["This will false positive in Opera Mini - https://github.com/Modernizr/Modernizr/issues/396"],
  "notes": [{
    "name": "Related Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/396"
  }]
}
!*/
/*!
{
  "name": "Background Size Cover",
  "property": "bgsizecover",
  "tags": ["css"],
  "builderAliases": ["css_backgroundsizecover"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/CSS/background-size"
  }]
}
!*/
/*!
{
  "name": "Border Image",
  "property": "borderimage",
  "caniuse": "border-image",
  "polyfills": ["css3pie"],
  "knownBugs": ["Android < 2.0 is true, but has a broken implementation"],
  "tags": ["css"]
}
!*/
/*!
{
  "name": "Border Radius",
  "property": "borderradius",
  "caniuse": "border-radius",
  "polyfills": ["css3pie"],
  "tags": ["css"],
  "notes": [{
    "name": "Comprehensive Compat Chart",
    "href": "https://muddledramblings.com/table-of-css3-border-radius-compliance"
  }]
}
!*/
/*!
{
  "name": "Box Decoration Break",
  "property": "boxdecorationbreak",
  "caniuse": "css-boxdecorationbreak",
  "tags": ["css"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/box-decoration-break"
  }, {
    "name": "Demo",
    "href": "https://jsbin.com/xojoro/edit?css,output"
  }]
}
!*/
/*!
{
  "name": "Box Shadow",
  "property": "boxshadow",
  "caniuse": "css-boxshadow",
  "tags": ["css"],
  "knownBugs": [
    "WebOS false positives on this test.",
    "The Kindle Silk browser false positives"
  ]
}
!*/
/*!
{
  "name": "Box Sizing",
  "property": "boxsizing",
  "caniuse": "css3-boxsizing",
  "polyfills": ["borderboxmodel", "boxsizingpolyfill", "borderbox"],
  "tags": ["css"],
  "builderAliases": ["css_boxsizing"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/248"
  }]
}
!*/
/*!
{
  "name": "CSS Calc",
  "property": "csscalc",
  "caniuse": "calc",
  "tags": ["css"],
  "builderAliases": ["css_calc"],
  "authors": ["@calvein"]
}
!*/
/*!
{
  "name": "CSS :checked pseudo-selector",
  "caniuse": "css-sel3",
  "property": "checked",
  "tags": ["css"],
  "notes": [{
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/pull/879"
  }]
}
!*/
/*!
{
  "name": "CSS Font ch Units",
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "property": "csschunit",
  "caniuse": "ch-unit",
  "tags": ["css"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-values/#font-relative-lengths"
  }]
}
!*/
/*!
{
  "name": "CSS Columns",
  "property": "csscolumns",
  "caniuse": "multicolumn",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Grid (old & new)",
  "property": ["cssgrid", "cssgridlegacy"],
  "authors": ["Faruk Ates"],
  "tags": ["css"],
  "notes": [{
    "name": "The new, standardized CSS Grid",
    "href": "https://www.w3.org/TR/css3-grid-layout/"
  }, {
    "name": "The _old_ CSS Grid (legacy)",
    "href": "https://www.w3.org/TR/2011/WD-css3-grid-layout-20110407/"
  }]
}
!*/
/*!
{
  "name": "CSS Cubic Bezier Range",
  "property": "cubicbezierrange",
  "tags": ["css"],
  "builderAliases": ["css_cubicbezierrange"],
  "authors": ["@calvein"],
  "warnings": ["In old versions (pre-2013) cubic-bezier values can't be > 1 due to Webkit [bug #45761](https://bugs.webkit.org/show_bug.cgi?id=45761)"],
  "notes": [{
    "name": "Comprehensive Compat Chart",
    "href": "https://muddledramblings.com/table-of-css3-border-radius-compliance/"
  }]
}
!*/
/*!
{
  "name": "CSS Custom Properties",
  "property": "customproperties",
  "caniuse": "css-variables",
  "tags": ["css"],
  "builderAliases": ["css_customproperties"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/--*"
  }, {
    "name": "W3C Spec",
    "href": "https://drafts.csswg.org/css-variables/"
  }]
}
!*/
/*!
{
  "name": "CSS Display run-in",
  "property": "display-runin",
  "authors": ["alanhogan"],
  "tags": ["css"],
  "builderAliases": ["css_displayrunin"],
  "notes": [{
    "name": "CSS Tricks Article",
    "href": "https://web.archive.org/web/20111204150927/http://css-tricks.com:80/596-run-in/"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/198"
  }]
}
!*/
/*!
{
  "name": "CSS Display table",
  "property": "displaytable",
  "caniuse": "css-table",
  "authors": ["scottjehl"],
  "tags": ["css"],
  "builderAliases": ["css_displaytable"],
  "notes": [{
    "name": "Detects for all additional table display values",
    "href": "https://pastebin.com/Gk9PeVaQ"
  }]
}
!*/
/*!
{
  "name": "CSS text-overflow ellipsis",
  "property": "ellipsis",
  "caniuse": "text-overflow",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS.escape()",
  "property": "cssescape",
  "polyfills": ["css-escape"],
  "tags": ["css", "cssom"]
}
!*/
/*!
{
  "name": "CSS Font ex Units",
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "property": "cssexunit",
  "caniuse": "mdn-css_types_length_ex",
  "tags": ["css"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-values/#font-relative-lengths"
  }]
}
!*/
/*!
{
  "name": "CSS Supports",
  "property": "supports",
  "caniuse": "css-featurequeries",
  "tags": ["css"],
  "builderAliases": ["css_supports"],
  "notes": [{
    "name": "W3C Spec (The @supports rule)",
    "href": "https://dev.w3.org/csswg/css3-conditional/#at-supports"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/648"
  }, {
    "name": "W3C Spec (The CSSSupportsRule interface)",
    "href": "https://dev.w3.org/csswg/css3-conditional/#the-csssupportsrule-interface"
  }]
}
!*/
/*!
{
  "name": "CSS Filters",
  "property": "cssfilters",
  "caniuse": "css-filters",
  "polyfills": ["polyfilter"],
  "tags": ["css"],
  "builderAliases": ["css_filters"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/filter"
  }]
}
!*/
/*!
{
  "name": "Flexbox",
  "property": "flexbox",
  "caniuse": "flexbox",
  "tags": ["css"],
  "notes": [{
    "name": "The _new_ flexbox",
    "href": "https://www.w3.org/TR/css-flexbox-1/"
  }],
  "warnings": [
    "A `true` result for this detect does not imply that the `flex-wrap` property is supported; see the `flexwrap` detect."
  ]
}
!*/
/*!
{
  "name": "Flexbox (legacy)",
  "property": "flexboxlegacy",
  "tags": ["css"],
  "polyfills": ["flexie"],
  "notes": [{
    "name": "The _old_ flexbox",
    "href": "https://www.w3.org/TR/2009/WD-css3-flexbox-20090723/"
  }]
}
!*/
/*!
{
  "name": "Flexbox (tweener)",
  "property": "flexboxtweener",
  "tags": ["css"],
  "polyfills": ["flexie"],
  "notes": [{
    "name": "The _inbetween_ flexbox",
    "href": "https://www.w3.org/TR/2011/WD-css3-flexbox-20111129/"
  }],
  "warnings": ["This represents an old syntax, not the latest standard syntax."]
}
!*/
/*!
{
  "name": "Flex Gap",
  "property": "flexgap",
  "caniuse": "flexbox-gap",
  "tags": ["css", "flexbox"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css-align-3/#gaps"
  }],
  "authors": ["Chris Smith (@chris13524)"]
}
!*/
/*!
{
  "name": "Flex Line Wrapping",
  "property": "flexwrap",
  "tags": ["css", "flexbox"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css-flexbox-1/"
  }],
  "warnings": [
    "Does not imply a modern implementation – see documentation."
  ]
}
!*/
/*!
{
  "name": "CSS :focus-visible pseudo-selector",
  "caniuse": "css-focus-visible",
  "property": "focusvisible",  
  "authors": ["@esaborit4code"],
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS :focus-within pseudo-selector",
  "caniuse": "css-focus-within",
  "property": "focuswithin",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "Font Display",
  "property": "fontdisplay",
  "authors": ["Patrick Kettner"],
  "caniuse": "css-font-rendering-controls",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://drafts.csswg.org/css-fonts-4/#font-display-desc"
  }, {
    "name": "`font-display` for the masses",
    "href": "https://css-tricks.com/font-display-masses/"
  }]
}
!*/
/*!
{
  "name": "@font-face",
  "property": "fontface",
  "authors": ["Diego Perini", "Mat Marquis"],
  "tags": ["css"],
  "knownBugs": [
    "False Positive: WebOS https://github.com/Modernizr/Modernizr/issues/342",
    "False Positive: WP7 https://github.com/Modernizr/Modernizr/issues/538"
  ],
  "notes": [{
    "name": "@font-face detection routine by Diego Perini",
    "href": "http://javascript.nwbox.com/CSSSupport/"
  }, {
    "name": "Filament Group @font-face compatibility research",
    "href": "https://docs.google.com/presentation/d/1n4NyG4uPRjAA8zn_pSQ_Ket0RhcWC6QlZ6LMjKeECo0/edit#slide=id.p"
  }, {
    "name": "Filament Grunticon/@font-face device testing results",
    "href": "https://docs.google.com/spreadsheet/ccc?key=0Ag5_yGvxpINRdHFYeUJPNnZMWUZKR2ItMEpRTXZPdUE#gid=0"
  }, {
    "name": "CSS fonts on Android",
    "href": "https://stackoverflow.com/questions/3200069/css-fonts-on-android"
  }, {
    "name": "@font-face and Android",
    "href": "http://archivist.incutio.com/viewlist/css-discuss/115960"
  }]
}
!*/
/*!
{
  "name": "CSS Generated Content",
  "property": "generatedcontent",
  "tags": ["css"],
  "warnings": ["Android may not return correct height for anything below 7px in old versions #738"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-selectors/#gen-content"
  }, {
    "name": "MDN Docs on :before",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/::before"
  }, {
    "name": "MDN Docs on :after",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/::after"
  }]
}
!*/
/*!
{
  "name": "CSS Gradients",
  "caniuse": "css-gradients",
  "property": "cssgradients",
  "tags": ["css"],
  "knownBugs": ["False-positives on webOS (https://github.com/Modernizr/Modernizr/issues/202)"],
  "notes": [{
    "name": "Webkit Gradient Syntax",
    "href": "https://webkit.org/blog/175/introducing-css-gradients/"
  }, {
    "name": "Linear Gradient Syntax",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/linear-gradient"
  }, {
    "name": "W3C Spec",
    "href": "https://drafts.csswg.org/css-images-3/#gradients"
  }]
}
!*/
/*! {
  "name": "CSS Hairline",
  "property": "hairline",
  "tags": ["css"],
  "authors": ["strarsis"],
  "notes": [{
    "name": "Blog post about CSS retina hairlines",
    "href": "http://dieulot.net/css-retina-hairline"
  }, {
    "name": "Derived from",
    "href": "https://gist.github.com/dieulot/520a49463f6058fbc8d1"
  }]
}
!*/
/*!
{
  "name": "CSS HSLA Colors",
  "caniuse": "css3-colors",
  "property": "hsla",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Hyphens",
  "caniuse": "css-hyphens",
  "property": ["csshyphens", "softhyphens", "softhyphensfind"],
  "tags": ["css"],
  "builderAliases": ["css_hyphens"],
  "async": true,
  "authors": ["David Newton"],
  "warnings": [
    "These tests currently require document.body to be present",
    "If loading Hyphenator.js via yepnope, be cautious of issue 158: https://github.com/mnater/hyphenator/issues/158",
    "This is very large – only include it if you absolutely need it"
  ],
  "notes": [{
    "name": "The Current State of Hyphenation on the Web.",
    "href": "https://davidnewton.ca/the-current-state-of-hyphenation-on-the-web"
  }, {
    "name": "Hyphenation Test Page",
    "href": "https://web.archive.org/web/20150319125549/http://davidnewton.ca/demos/hyphenation/test.html"
  }, {
    "name": "Hyphenation is Language Specific",
    "href": "https://code.google.com/p/hyphenator/source/diff?spec=svn975&r=975&format=side&path=/trunk/Hyphenator.js#sc_svn975_313"
  }, {
    "name": "Related Modernizr Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/312"
  }]
}
!*/
/*!
{
  "name": "CSS :invalid pseudo-class",
  "property": "cssinvalid",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/:invalid"
  }]
}
!*/
/*!
{
  "name": "CSS :last-child pseudo-selector",
  "caniuse": "css-sel3",
  "property": "lastchild",
  "tags": ["css"],
  "builderAliases": ["css_lastchild"],
  "notes": [{
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/pull/304"
  }]
}
!*/
/*!
{
  "name": "CSS Mask",
  "caniuse": "css-masks",
  "property": "cssmask",
  "tags": ["css"],
  "builderAliases": ["css_mask"],
  "notes": [{
    "name": "Webkit blog on CSS Masks",
    "href": "https://webkit.org/blog/181/css-masks/"
  }, {
    "name": "Safari Docs",
    "href": "https://developer.apple.com/library/archive/documentation/InternetWeb/Conceptual/SafariVisualEffectsProgGuide/Masks/Masks.html"
  }, {
    "name": "CSS SVG mask",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/mask"
  }, {
    "name": "Combine with clippaths for awesomeness",
    "href": "https://web.archive.org/web/20150508193041/http://generic.cx:80/for/webkit/test.html"
  }]
}
!*/
/*!
{
  "name": "CSS Media Queries",
  "caniuse": "css-mediaqueries",
  "property": "mediaqueries",
  "tags": ["css"],
  "builderAliases": ["css_mediaqueries"]
}
!*/
/*!
{
  "name": "CSS Multiple Backgrounds",
  "caniuse": "multibackgrounds",
  "property": "multiplebgs",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS :nth-child pseudo-selector",
  "caniuse": "css-sel3",
  "property": "nthchild",
  "tags": ["css"],
  "notes": [{
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/pull/685"
  }, {
    "name": "Sitepoint :nth-child documentation",
    "href": "https://www.sitepoint.com/atoz-css-screencast-nth-child/"
  }],
  "authors": ["@emilchristensen"],
  "knownBugs": ["Known false negative in Safari 3.1 and Safari 3.2.2"]
}
!*/
/*!
{
  "name": "CSS Object Fit",
  "caniuse": "object-fit",
  "property": "objectfit",
  "tags": ["css"],
  "builderAliases": ["css_objectfit"],
  "notes": [{
    "name": "Opera Article on Object Fit",
    "href": "https://dev.opera.com/articles/css3-object-fit-object-position/"
  }]
}
!*/
/*!
{
  "name": "CSS Opacity",
  "caniuse": "css-opacity",
  "property": "opacity",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Overflow Scrolling",
  "property": "overflowscrolling",
  "tags": ["css"],
  "builderAliases": ["css_overflow_scrolling"],
  "notes": [{
    "name": "Article on iOS overflow scrolling",
    "href": "https://css-tricks.com/snippets/css/momentum-scrolling-on-ios-overflow-elements/"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-overflow-scrolling"
  }]
}
!*/
/*!
{
  "name": "CSS Pointer Events",
  "caniuse": "pointer-events",
  "property": "csspointerevents",
  "authors": ["ausi"],
  "tags": ["css"],
  "builderAliases": ["css_pointerevents"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events"
  }, {
    "name": "Test Project Page",
    "href": "https://ausi.github.com/Feature-detection-technique-for-pointer-events/"
  }, {
    "name": "Test Project Wiki",
    "href": "https://github.com/ausi/Feature-detection-technique-for-pointer-events/wiki"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/80"
  }]
}
!*/
/*!
{
  "name": "CSS position: sticky",
  "property": "csspositionsticky",
  "tags": ["css"],
  "builderAliases": ["css_positionsticky"],
  "notes": [{
    "name": "Chrome bug report",
    "href": "https://bugs.chromium.org/p/chromium/issues/detail?id=322972"
  }],
  "warnings": ["using position:sticky on anything but top aligned elements is buggy in Chrome < 37 and iOS <=7+"]
}
!*/
/*!
{
  "name": "CSS Generated Content Animations",
  "property": "csspseudoanimations",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Transitions",
  "property": "csstransitions",
  "caniuse": "css-transitions",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Generated Content Transitions",
  "property": "csspseudotransitions",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Reflections",
  "caniuse": "css-reflections",
  "property": "cssreflections",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Regions",
  "caniuse": "css-regions",
  "authors": ["Mihai Balan"],
  "property": "regions",
  "tags": ["css"],
  "builderAliases": ["css_regions"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-regions/"
  }]
}
!*/
/*!
{
  "name": "CSS Font rem Units",
  "caniuse": "rem",
  "authors": ["nsfmc"],
  "property": "cssremunit",
  "tags": ["css"],
  "builderAliases": ["css_remunit"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-values/#relative0"
  }, {
    "name": "Font Size with rem by Jonathan Snook",
    "href": "https://snook.ca/archives/html_and_css/font-size-with-rem"
  }]
}
!*/
/*!
{
  "name": "CSS UI Resize",
  "property": "cssresize",
  "caniuse": "css-resize",
  "tags": ["css"],
  "builderAliases": ["css_resize"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-ui/#resize"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/CSS/resize"
  }]
}
!*/
/*!
{
  "name": "CSS rgba",
  "caniuse": "css3-colors",
  "property": "rgba",
  "tags": ["css"],
  "notes": [{
    "name": "CSSTricks Tutorial",
    "href": "https://css-tricks.com/rgba-browser-support/"
  }]
}
!*/
/*!
{
  "name": "CSS Stylable Scrollbars",
  "property": "cssscrollbar",
  "tags": ["css"],
  "builderAliases": ["css_scrollbars"]
}
!*/
/*!
{
  "name": "Scroll Snap Points",
  "property": "scrollsnappoints",
  "caniuse": "css-snappoints",
  "notes": [{
    "name": "Setting native-like scrolling offsets in CSS with Scrolling Snap Points",
    "href": "http://generatedcontent.org/post/66817675443/setting-native-like-scrolling-offsets-in-css-with"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Scroll_Snap_Points"
  }],
  "polyfills": ["scrollsnap"]
}
!*/
/*!
{
  "name": "CSS Shapes",
  "property": "shapes",
  "tags": ["css"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css-shapes"
  }, {
    "name": "Examples from Adobe",
    "href": "https://web.archive.org/web/20171230010236/http://webplatform.adobe.com:80/shapes"
  }, {
    "name": "Examples from CSS-Tricks",
    "href": "https://css-tricks.com/examples/ShapesOfCSS/"
  }]
}
!*/
/*!
{
  "name": "CSS general sibling selector",
  "caniuse": "css-sel3",
  "property": "siblinggeneral",
  "tags": ["css"],
  "notes": [{
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/pull/889"
  }]
}
!*/
/*!
{
  "name": "CSS Subpixel Fonts",
  "property": "subpixelfont",
  "tags": ["css"],
  "builderAliases": ["css_subpixelfont"],
  "authors": ["@derSchepp", "@gerritvanaaken", "@rodneyrehm", "@yatil", "@ryanseddon"],
  "notes": [{
    "name": "Origin Test",
    "href": "https://github.com/gerritvanaaken/subpixeldetect"
  }]
}
!*/
/*!
{
  "name": "CSS :target pseudo-class",
  "caniuse": "css-sel3",
  "property": "target",
  "tags": ["css"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/:target"
  }],
  "authors": ["@zachleat"],
  "warnings": ["Opera Mini supports :target but doesn't update the hash for anchor links."]
}
!*/
/*!
{
  "name": "CSS text-align-last",
  "property": "textalignlast",
  "caniuse": "css-text-align-last",
  "tags": ["css"],
  "warnings": ["IE does not support the 'start' or 'end' values."],
  "notes": [{
    "name": "Quirksmode",
    "href": "https://www.quirksmode.org/css/text/textalignlast.html"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/text-align-last"
  }]
}
!*/
/*!
{
  "name": "CSS textDecoration",
  "property": "textdecoration",
  "caniuse": "text-decoration",
  "tags": ["css"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css-text-decor-3/#line-decoration"
  }]
}
!*/
/*!
{
  "name": "CSS textshadow",
  "property": "textshadow",
  "caniuse": "css-textshadow",
  "tags": ["css"],
  "knownBugs": ["FF3.0 will false positive on this test"]
}
!*/
/*!
{
  "name": "CSS Transforms",
  "property": "csstransforms",
  "caniuse": "transforms2d",
  "tags": ["css"]
}
!*/
/*!
{
  "name": "CSS Transforms 3D",
  "property": "csstransforms3d",
  "caniuse": "transforms3d",
  "tags": ["css"],
  "knownBugs": [
    "Chrome may occasionally fail this test on some systems; more info: https://bugs.chromium.org/p/chromium/issues/detail?id=129004, however, the issue has since been closed (marked as fixed)."
  ]
}
!*/
/*!
{
  "name": "CSS Transforms Level 2",
  "property": "csstransformslevel2",
  "authors": ["rupl"],
  "tags": ["css"],
  "notes": [{
    "name": "CSSWG Draft Spec",
    "href": "https://drafts.csswg.org/css-transforms-2/"
  }]
}
!*/
/*!
{
  "name": "CSS Transform Style preserve-3d",
  "property": "preserve3d",
  "authors": ["denyskoch", "aFarkas"],
  "tags": ["css"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/transform-style"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/1748"
  }]
}
!*/
/*!
{
  "name": "CSS user-select",
  "property": "userselect",
  "caniuse": "user-select-none",
  "authors": ["ryan seddon"],
  "tags": ["css"],
  "builderAliases": ["css_userselect"],
  "notes": [{
    "name": "Related Modernizr Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/250"
  }]
}
!*/
/*!
{
  "name": "CSS :valid pseudo-class",
  "property": "cssvalid",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/:valid"
  }]
}
!*/
/*!
{
  "name": "Variable Open Type Fonts",
  "property": "variablefonts",
  "authors": ["Patrick Kettner"],
  "tags": ["css"],
  "notes": [{
    "name": "Variable fonts on the web",
    "href": "https://webkit.org/blog/7051/variable-fonts-on-the-web/"
  }, {
    "name": "Variable fonts for responsive design",
    "href": "https://alistapart.com/blog/post/variable-fonts-for-responsive-design"
  }]
}
!*/
/*!
{
  "name": "CSS vh unit",
  "property": "cssvhunit",
  "caniuse": "viewport-units",
  "tags": ["css"],
  "builderAliases": ["css_vhunit"],
  "notes": [{
    "name": "Related Modernizr Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/572"
  }, {
    "name": "Similar JSFiddle",
    "href": "https://jsfiddle.net/FWeinb/etnYC/"
  }]
}
!*/
/*!
{
  "name": "CSS vmax unit",
  "property": "cssvmaxunit",
  "caniuse": "viewport-units",
  "tags": ["css"],
  "builderAliases": ["css_vmaxunit"],
  "notes": [{
    "name": "Related Modernizr Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/572"
  }, {
    "name": "JSFiddle Example",
    "href": "https://jsfiddle.net/glsee/JDsWQ/4/"
  }]
}
!*/
/*!
{
  "name": "CSS vmin unit",
  "property": "cssvminunit",
  "caniuse": "viewport-units",
  "tags": ["css"],
  "builderAliases": ["css_vminunit"],
  "notes": [{
    "name": "Related Modernizr Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/572"
  }, {
    "name": "JSFiddle Example",
    "href": "https://jsfiddle.net/glsee/JRmdq/8/"
  }]
}
!*/
/*!
{
  "name": "CSS vw unit",
  "property": "cssvwunit",
  "caniuse": "viewport-units",
  "tags": ["css"],
  "builderAliases": ["css_vwunit"],
  "notes": [{
    "name": "Related Modernizr Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/572"
  }, {
    "name": "JSFiddle Example",
    "href": "https://jsfiddle.net/FWeinb/etnYC/"
  }]
}
!*/
/*!
{
  "name": "will-change",
  "property": "willchange",
  "caniuse": "will-change",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://drafts.csswg.org/css-will-change/"
  }]
}
!*/
/*!
{
  "name": "CSS wrap-flow",
  "property": "wrapflow",
  "tags": ["css"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/css3-exclusions"
  }, {
    "name": "Example by Louie Rootfield",
    "href": "https://webdesign.tutsplus.com/tutorials/css-exclusions--cms-28087"
  }]
}
!*/
/*!
{
  "name": "Custom Elements API",
  "property": "customelements",
  "caniuse": "custom-elementsv1",
  "tags": ["customelements"],
  "polyfills": ["customelements"],
  "notes": [{
    "name": "Specs for Custom Elements",
    "href": "https://www.w3.org/TR/custom-elements/"
  }]
}
!*/
/*!
{
  "name": "Custom protocol handler",
  "property": "customprotocolhandler",
  "authors": ["Ben Schwarz"],
  "builderAliases": ["custom_protocol_handler"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/dev/system-state.html#custom-handlers"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/navigator.registerProtocolHandler"
  }]
}
!*/
/*!
{
  "name": "Dart",
  "property": "dart",
  "authors": ["Theodoor van Donge"],
  "notes": [{
    "name": "Language website",
    "href": "https://www.dartlang.org/"
  }]
}
!*/
/*!
{
  "name": "DataView",
  "property": "dataview",
  "authors": ["Addy Osmani"],
  "builderAliases": ["dataview_api"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/JavaScript_typed_arrays/DataView"
  }],
  "polyfills": ["jdataview"]
}
!*/
/*!
{
  "name": "classList",
  "caniuse": "classlist",
  "property": "classlist",
  "tags": ["dom"],
  "builderAliases": ["dataview_api"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/DOM/element.classList"
  }]
}
!*/
/*!
{
  "name": "createElement with Attributes",
  "property": ["createelementattrs", "createelement-attrs"],
  "tags": ["dom"],
  "builderAliases": ["dom_createElement_attrs"],
  "authors": ["James A. Rosen"],
  "notes": [{
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/258"
  }]
}
!*/
/*!
{
  "name": "dataset API",
  "caniuse": "dataset",
  "property": "dataset",
  "tags": ["dom"],
  "builderAliases": ["dom_dataset"],
  "authors": ["@phiggins42"]
}
!*/
/*!
{
  "name": "Document Fragment",
  "property": "documentfragment",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-B63ED1A3"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment"
  }, {
    "name": "QuirksMode Compatibility Tables",
    "href": "https://www.quirksmode.org/m/w3c_core.html#t112"
  }],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "knownBugs": ["false-positive on Blackberry 9500, see QuirksMode note"],
  "tags": ["dom"]
}
!*/
/*!
{
  "name": "[hidden] Attribute",
  "property": "hidden",
  "tags": ["dom"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/dev/interaction.html#the-hidden-attribute"
  }, {
    "name": "original implementation of detect code",
    "href": "https://github.com/aFarkas/html5shiv/blob/bf4fcc4/src/html5shiv.js#L38"
  }],
  "polyfills": ["html5shiv"],
  "authors": ["Ron Waldon (@jokeyrhyme)"]
}
!*/
/*!
{
  "name": "Intersection Observer",
  "property": "intersectionobserver",
  "caniuse": "intersectionobserver",
  "tags": ["dom"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://w3c.github.io/IntersectionObserver/"
  }, {
    "name": "IntersectionObserver polyfill",
    "href": "https://github.com/w3c/IntersectionObserver/tree/master/polyfill"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/docs/Web/API/Intersection_Observer_API"
  }]
}
!*/
/*!
{
  "name": "microdata",
  "property": "microdata",
  "tags": ["dom"],
  "builderAliases": ["dom_microdata"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/microdata/"
  }]
}
!*/
/*!
{
  "name": "DOM4 MutationObserver",
  "property": "mutationobserver",
  "caniuse": "mutationobserver",
  "tags": ["dom"],
  "authors": ["Karel Sedláček (@ksdlck)"],
  "polyfills": ["mutationobservers"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver"
  }]
}
!*/
/*!
{
  "property": "passiveeventlisteners",
  "caniuse": "passive-event-listener",
  "tags": ["dom"],
  "authors": ["Rick Byers"],
  "name": "Passive event listeners",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://dom.spec.whatwg.org/#dom-addeventlisteneroptions-passive"
  }, {
    "name": "WICG explainer",
    "href": "https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md"
  }]
}
!*/
/*!
{
  "name": "Shadow DOM API",
  "property": "shadowroot",
  "caniuse": "shadowdomv1",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot"
  }],
  "authors": ["Kevin Coyle (@kevin-coyle-unipro)", "Pascal Lim (@pascalim)"],
  "tags": ["dom"]
}
!*/
/*!
{
  "name": "Shadow DOM API (Legacy)",
  "property": "shadowrootlegacy",
  "caniuse": "shadowdom",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Element/createShadowRoot"
  }],
  "authors": ["Kevin Coyle (@kevin-coyle-unipro)", "Pascal Lim (@pascalim)"],
  "tags": ["dom"]
}
!*/
/*!
{
  "name": "bdi Element",
  "property": "bdi",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdi"
  }]
}
!*/
/*!
{
  "name": "details Element",
  "caniuse": "details",
  "property": "details",
  "tags": ["elem"],
  "builderAliases": ["elem_details"],
  "authors": ["@mathias"],
  "notes": [{
    "name": "Mathias' Original",
    "href": "https://mathiasbynens.be/notes/html5-details-jquery#comment-35"
  }]
}
!*/
/*!
{
  "name": "output Element",
  "property": "outputelem",
  "tags": ["elem"],
  "builderAliases": ["elem_output"],
  "notes": [{
    "name": "WhatWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/form-elements.html#the-output-element"
  }]
}
!*/
/*!
{
  "name": "picture Element",
  "property": "picture",
  "tags": ["elem"],
  "authors": ["Scott Jehl", "Mat Marquis"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/embedded-content.html#embedded-content"
  }, {
    "name": "Relevant spec issue",
    "href": "https://github.com/ResponsiveImagesCG/picture-element/issues/87"
  }]
}
!*/
/*!
{
  "name": "progress Element",
  "caniuse": "progress",
  "property": ["progressbar", "meter"],
  "tags": ["elem"],
  "builderAliases": ["elem_progress_meter"],
  "authors": ["Stefan Wallin"]
}
!*/
/*!
{
  "name": "ruby, rp, rt Elements",
  "caniuse": "ruby",
  "property": "ruby",
  "tags": ["elem"],
  "builderAliases": ["elem_ruby"],
  "authors": ["Cătălin Mariș"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-ruby-element"
  }]
}
!*/
/*!
{
  "name": "Template Tag",
  "property": "template",
  "caniuse": "template",
  "tags": ["elem"],
  "notes": [{
    "name": "HTML5Rocks Article",
    "href": "https://www.html5rocks.com/en/tutorials/webcomponents/template/"
  }, {
    "name": "W3C Spec",
    "href": "https://web.archive.org/web/20171130222649/http://www.w3.org/TR/html5/scripting-1.html"
  }]
}
!*/
/*!
{
  "name": "time Element",
  "property": "time",
  "tags": ["elem"],
  "builderAliases": ["elem_time"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element"
  }]
}
!*/
/*!
{
  "name": "Track element and Timed Text Track",
  "property": ["texttrackapi", "track"],
  "tags": ["elem"],
  "builderAliases": ["elem_track"],
  "authors": ["Addy Osmani"],
  "notes": [{
    "name": "W3C Spec (Track Element)",
    "href": "https://web.archive.org/web/20121119095019/http://www.w3.org/TR/html5/the-track-element.html#the-track-element"
  }, {
    "name": "W3C Spec (Track API)",
    "href": "https://web.archive.org/web/20121119094620/http://www.w3.org/TR/html5/media-elements.html#text-track-api"
  }],
  "warnings": ["While IE10 has implemented the track element, IE10 does not expose the underlying APIs to create timed text tracks by JS (really sad)"]
}
!*/
/*!
{
  "name": "Unknown Elements",
  "property": "unknownelements",
  "tags": ["elem"],
  "notes": [{
    "name": "The Story of the HTML5 Shiv",
    "href": "https://www.paulirish.com/2011/the-history-of-the-html5-shiv/"
  }, {
    "name": "original implementation of detect code",
    "href": "https://github.com/aFarkas/html5shiv/blob/bf4fcc4/src/html5shiv.js#L36"
  }],
  "polyfills": ["html5shiv"],
  "authors": ["Ron Waldon (@jokeyrhyme)"]
}
!*/
/*!
{
  "name": "Emoji",
  "property": "emoji"
}
!*/
/*!
{
  "name": "ES5 Array",
  "property": "es5array",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "ES5 Date",
  "property": "es5date",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "ES5 Function",
  "property": "es5function",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "ES5 Object",
  "property": "es5object",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim", "es5sham"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "ES5 Strict Mode",
  "property": "strictmode",
  "caniuse": "use-strict",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "authors": ["@kangax"],
  "tags": ["es5"],
  "builderAliases": ["es5_strictmode"]
}
!*/
/*!
{
  "name": "ES5 String",
  "property": "es5string",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "JSON",
  "property": "json",
  "caniuse": "json",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Glossary/JSON"
  }],
  "polyfills": ["json2"]
}
!*/
/*!
{
  "name": "ES5 Syntax",
  "property": "es5syntax",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }, {
    "name": "original implementation of detect code",
    "href": "https://kangax.github.io/compat-table/es5/"
  }],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "warnings": ["This detect uses `eval()`, so CSP may be a problem."],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "ES5 Immutable Undefined",
  "property": "es5undefined",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }, {
    "name": "original implementation of detect code",
    "href": "https://kangax.github.io/compat-table/es5/"
  }],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "ES5",
  "property": "es5",
  "caniuse": "es5",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim", "es5sham"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/*!
{
  "name": "ES6 Array",
  "property": "es6array",
  "notes": [{
    "name": "ECMAScript 6 specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/index.html"
  }, {
    "name": "Last ECMAScript specification",
    "href": "https://www.ecma-international.org/ecma-262/index.html"
  }],
  "polyfills": ["es6shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Arrow Functions",
  "property": "arrow",
  "authors": ["Vincent Riemer"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Class",
  "property": "es6class",
  "notes": [{
    "name": "ECMAScript 6 language specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/#sec-class-definitions"
  }],
  "caniuse": "es6-class",
  "authors": ["dabretin"],
  "tags": ["es6"],
  "builderAliases": ["class"]
}
!*/
/*!
{
  "name": "ES6 Collections",
  "property": "es6collections",
  "notes": [{
    "name": "ECMAScript 6 specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/index.html"
  }, {
    "name": "Last ECMAScript specification",
    "href": "https://www.ecma-international.org/ecma-262/index.html"
  }],
  "polyfills": ["es6shim", "weakmap"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Generators",
  "property": "generators",
  "authors": ["Michael Kachanovskyi"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Math",
  "property": "es6math",
  "notes": [{
    "name": "ECMAScript 6 specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/index.html"
  }, {
    "name": "Last ECMAScript specification",
    "href": "https://www.ecma-international.org/ecma-262/index.html"
  }],
  "polyfills": ["es6shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Number",
  "property": "es6number",
  "notes": [{
    "name": "ECMAScript 6 specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/index.html"
  }, {
    "name": "Last ECMAScript specification",
    "href": "https://www.ecma-international.org/ecma-262/index.html"
  }],
  "polyfills": ["es6shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Object",
  "property": "es6object",
  "notes": [{
    "name": "ECMAScript 6 specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/index.html"
  }, {
    "name": "Last ECMAScript specification",
    "href": "https://www.ecma-international.org/ecma-262/index.html"
  }],
  "polyfills": ["es6shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Promises",
  "property": "promises",
  "caniuse": "promises",
  "polyfills": ["es6promises"],
  "authors": ["Krister Kari", "Jake Archibald"],
  "tags": ["es6"],
  "notes": [{
    "name": "The ES6 promises spec",
    "href": "https://github.com/domenic/promises-unwrapping"
  }, {
    "name": "Chromium dashboard - ES6 Promises",
    "href": "https://www.chromestatus.com/features/5681726336532480"
  }, {
    "name": "JavaScript Promises: an Introduction",
    "href": "https://developers.google.com/web/fundamentals/primers/promises/"
  }]
}
!*/
/*!
{
  "name": "ES6 Rest parameters",
  "property": "restparameters",
  "notes": [{
    "name": "ECMAScript 6 language specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/#sec-function-definitions"
  }],
  "caniuse": "rest",
  "authors": ["dabretin"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Spread array",
  "property": "spreadarray",
  "notes": [{
    "name": "ECMAScript Specification",
    "href": "https://tc39.es/ecma262/#sec-array-initializer"
  },
  {
    "name": "Article",
    "href": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax"
  }],
  "caniuse": "mdn-javascript_operators_spread_spread_in_arrays",
  "authors": ["dabretin"],
  "warnings": ["not for object literals (implemented in ES7)"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Template Strings",
  "property": "stringtemplate",
  "caniuse": "template-literals",
  "builderAliases": ["templatestrings"],
  "notes": [{
    "name": "ECMAScript 6 draft specification",
    "href": "https://tc39wiki.calculist.org/es6/template-strings/"
  }],
  "authors": ["dabretin"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 String",
  "property": "es6string",
  "notes": [{
    "name": "ECMAScript 6 Specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/index.html"
  }, {
    "name": "Last ECMAScript Specification",
    "href": "https://www.ecma-international.org/ecma-262/index.html"
  }],
  "polyfills": ["es6shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es6"]
}
!*/
/*!
{
  "name": "ES6 Symbol",
  "property": "es6symbol",
  "caniuse": "mdn-javascript_builtins_symbol",
  "notes": [{
    "name": "Official ECMAScript 6 specification",
    "href": "https://www.ecma-international.org/ecma-262/6.0/#sec-symbol-constructor"
  },{
    "name": "MDN web docs",
    "href": "https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Symbol"
  }],
  "polyfills": ["es6symbol"],
  "authors": ["buhichan (@buhichan)"],
  "tags": ["es6","symbol"]
}
!*/
/*!
{
  "name": "ES7 Array",
  "property": "es7array",
  "notes": [{
    "name": "ECMAScript array Specification",
    "href": "https://tc39.es/ecma262/#sec-array.prototype.includes"
  }],
  "authors": ["dabretin"],
  "tags": ["es7"]
}
!*/
/*!
{
  "name": "ES7 Rest destructuring",
  "property": ["restdestructuringarray", "restdestructuringobject"],
  "caniuse" : "destructuring%20assignment",
  "notes": [{
    "name": "ECMAScript Destructuring Assignment Specification",
    "href": "https://tc39.es/ecma262/#sec-destructuring-assignment"
  }],
  "authors": ["dabretin"],
  "tags": ["es7"]
}
!*/
/*!
{
  "name": "ES7 Spread object",
  "property": "spreadobject",
  "notes": [{
    "name": "ECMAScript array Specification",
    "href": "http://www.ecma-international.org/ecma-262/#sec-object-initializer"
  }],
  "authors": ["dabretin"],
  "tags": ["es7"]
}
!*/
/*!
{
  "name": "ES8 Object",
  "property": "es8object",
  "notes": [{
    "name": "ECMAScript specification: Object.entries",
    "href": "https://www.ecma-international.org/ecma-262/#sec-object.entries"
  }, {
    "name": "ECMAScript specification: Object.values",
    "href": "https://www.ecma-international.org/ecma-262/#sec-object.values"
  }],
  "caniuse": "object-entries,object-values",
  "authors": ["dabretin"],
  "tags": ["es8"]
}
!*/
/*!
{
  "name": "CustomEvent",
  "property": "customevent",
  "tags": ["customevent"],
  "authors": ["Alberto Elias"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/DOM-Level-3-Events/#interface-CustomEvent"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/docs/Web/API/CustomEvent"
  }],
  "polyfills": ["eventlistener"]
}
!*/
/*!
{
  "name": "Orientation and Motion Events",
  "property": ["devicemotion", "deviceorientation"],
  "caniuse": "deviceorientation",
  "notes": [{
    "name": "W3C Editor's Draft Spec",
    "href": "https://w3c.github.io/deviceorientation/"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Detecting_device_orientation"
  }],
  "authors": ["Shi Chuan"],
  "tags": ["event"],
  "builderAliases": ["event_deviceorientation_motion"]
}
!*/
/*!
{
  "name": "Event Listener",
  "property": "eventlistener",
  "caniuse": "addeventlistener",
  "authors": ["Andrew Betts (@triblondon)"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-Registration-interfaces"
  }],
  "polyfills": ["eventlistener"]
}
!*/
/*!
{
  "name": "Force Touch Events",
  "property": "forcetouch",
  "authors": ["Kraig Walker"],
  "notes": [{
    "name": "Responding to Force Touch Events from JavaScript",
    "href": "https://developer.apple.com/library/archive/documentation/AppleApplications/Conceptual/SafariJSProgTopics/RespondingtoForceTouchEventsfromJavaScript.html"
  }]
}
!*/
/*!
{
  "name": "Hashchange event",
  "property": "hashchange",
  "caniuse": "hashchange",
  "tags": ["history"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onhashchange"
  }],
  "polyfills": [
    "jquery-hashchange",
    "moo-historymanager",
    "jquery-ajaxy",
    "hasher",
    "shistory"
  ]
}
!*/
/*!
{
  "name": "onInput Event",
  "property": "oninput",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers.oninput"
  }, {
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/input.html#common-input-element-attributes"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/210"
  }],
  "authors": ["Patrick Kettner"],
  "tags": ["event"]
}
!*/
/*!
{
  "name": "DOM Pointer Events API",
  "property": "pointerevents",
  "caniuse": "pointer",
  "tags": ["input"],
  "authors": ["Stu Cox"],
  "notes": [{
    "name": "W3C Spec (Pointer Events)",
    "href": "https://www.w3.org/TR/pointerevents/"
  }, {
    "name": "W3C Spec (Pointer Events Level 2)",
    "href": "https://www.w3.org/TR/pointerevents2/"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent"
  }],
  "warnings": ["This property name now refers to W3C DOM PointerEvents: https://github.com/Modernizr/Modernizr/issues/548#issuecomment-12812099"],
  "polyfills": ["pep"]
}
!*/
/*!
{
  "name": "Proximity API",
  "property": "proximity",
  "authors": ["Cătălin Mariș"],
  "tags": ["events", "proximity"],
  "caniuse": "proximity",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Proximity_Events"
  }, {
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/proximity/"
  }]
}
!*/
/*!
{
  "name": "File API",
  "property": "filereader",
  "caniuse": "fileapi",
  "notes": [{
    "name": "W3C Working Draft Spec",
    "href": "https://www.w3.org/TR/FileAPI/"
  }],
  "tags": ["file"],
  "builderAliases": ["file_api"],
  "knownBugs": ["Will fail in Safari 5 due to its lack of support for the standards defined FileReader object"]
}
!*/
/*!
{
  "name": "Filesystem API",
  "property": "filesystem",
  "caniuse": "filesystem",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/file-system-api/"
  }],
  "authors": ["Eric Bidelman (@ebidel)"],
  "tags": ["file"],
  "builderAliases": ["file_filesystem"],
  "knownBugs": ["The API will be present in Chrome incognito, but will throw an exception. See crbug.com/93417"]
}
!*/
/*!
{
  "name": "Flash",
  "property": "flash",
  "tags": ["flash"],
  "polyfills": ["shumway"]
}
!*/
/*!
{
  "name": "Fullscreen API",
  "property": "fullscreen",
  "caniuse": "fullscreen",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/API/Fullscreen"
  }],
  "polyfills": ["screenfulljs"],
  "builderAliases": ["fullscreen_api"]
}
!*/
/*!
{
  "name": "GamePad API",
  "property": "gamepads",
  "caniuse": "gamepad",
  "authors": ["Eric Bidelman"],
  "tags": ["media"],
  "warnings": ["In new browsers it may return false in non-HTTPS connections"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/gamepad/"
  }, {
    "name": "HTML5 Rocks Tutorial",
    "href": "https://www.html5rocks.com/en/tutorials/doodles/gamepad/#toc-featuredetect"
  }]
}
!*/
/*!
{
  "name": "Geolocation API",
  "property": "geolocation",
  "caniuse": "geolocation",
  "tags": ["media"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/WebAPI/Using_geolocation"
  }],
  "polyfills": [
    "joshuabell-polyfill",
    "webshims",
    "geo-location-javascript",
    "geolocation-api-polyfill"
  ]
}
!*/
/*!
{
  "name": "Hidden Scrollbar",
  "property": "hiddenscroll",
  "authors": ["Oleg Korsunsky"],
  "tags": ["overlay"],
  "notes": [{
    "name": "Overlay Scrollbar description",
    "href": "https://developer.apple.com/library/mac/releasenotes/MacOSX/WhatsNewInOSX/Articles/MacOSX10_7.html#//apple_ref/doc/uid/TP40010355-SW39"
  }, {
    "name": "Video example of overlay scrollbars",
    "href": "https://gfycat.com/FoolishMeaslyAtlanticsharpnosepuffer"
  }]
}
!*/
/*!
{
  "name": "History API",
  "property": "history",
  "caniuse": "history",
  "tags": ["history"],
  "authors": ["Hay Kranen", "Alexander Farkas"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/html51/browsers.html#the-history-interface"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/window.history"
  }],
  "polyfills": ["historyjs", "html5historyapi"]
}
!*/
/*!
{
  "name": "HTML Imports",
  "property": "htmlimports",
  "tags": ["html", "import"],
  "polyfills": ["polymer-htmlimports"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://w3c.github.io/webcomponents/spec/imports/"
  }, {
    "name": "HTML Imports - #include for the web",
    "href": "https://www.html5rocks.com/en/tutorials/webcomponents/imports/"
  }]
}
!*/
/*!
{
  "name": "IE8 compat mode",
  "property": "ie8compat",
  "authors": ["Erich Ocean"]
}
!*/
/*!
{
  "name": "iframe[sandbox] Attribute",
  "property": "sandbox",
  "caniuse": "iframe-sandbox",
  "tags": ["iframe"],
  "builderAliases": ["iframe_sandbox"],
  "notes": [
  {
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/embedded-content.html#attr-iframe-sandbox"
  }],
  "knownBugs": ["False-positive on Firefox < 29"]
}
!*/
/*!
{
  "name": "iframe[seamless] Attribute",
  "property": "seamless",
  "tags": ["iframe"],
  "builderAliases": ["iframe_seamless"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/embedded-content.html#attr-iframe-seamless"
  }]
}
!*/
/*!
{
  "name": "iframe[srcdoc] Attribute",
  "property": "srcdoc",
  "caniuse": "iframe-srcdoc",
  "tags": ["iframe"],
  "builderAliases": ["iframe_srcdoc"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/embedded-content.html#attr-iframe-srcdoc"
  }]
}
!*/
/*!
{
  "name": "Animated PNG",
  "async": true,
  "property": "apng",
  "caniuse": "apng",
  "tags": ["image"],
  "builderAliases": ["img_apng"],
  "notes": [{
    "name": "Wikipedia Article",
    "href": "https://en.wikipedia.org/wiki/APNG"
  }]
}
!*/
/*!
{
  "name": "AVIF",
  "async": true,
  "property": "avif",
  "caniuse": "avif",
  "tags": ["image"],
  "authors": ["Markel Ferro (@MarkelFe)"],
  "polyfills": ["avifjs"],
  "notes": [{
    "name": "Avif Spec",
    "href": "https://aomediacodec.github.io/av1-avif/"
  }]
}
!*/
/*!
{
  "name": "Image crossOrigin",
  "property": "imgcrossorigin",
  "tags": ["image"],
  "notes": [{
    "name": "Cross Domain Images and the Tainted Canvas",
    "href": "https://blog.codepen.io/2013/10/08/cross-domain-images-tainted-canvas/"
  }]
}
!*/
/*!
{
  "name": "EXIF Orientation",
  "property": "exiforientation",
  "tags": ["image"],
  "builderAliases": ["exif_orientation"],
  "async": true,
  "authors": ["Paul Sayre"],
  "notes": [{
    "name": "Article by Dave Perrett",
    "href": "https://www.daveperrett.com/articles/2012/07/28/exif-orientation-handling-is-a-ghetto/"
  }, {
    "name": "Article by Calvin Hass",
    "href": "https://www.impulseadventure.com/photo/exif-orientation.html"
  }]
}
!*/
/*!
{
  "name": "JPEG 2000",
  "async": true,
  "aliases": ["jpeg-2000", "jpg2"],
  "property": "jpeg2000",
  "caniuse": "jpeg2000",
  "tags": ["image"],
  "authors": ["@eric_wvgg"],
  "notes": [{
    "name": "Wikipedia Article",
    "href": "https://en.wikipedia.org/wiki/JPEG_2000"
  }]
}
!*/
/*!
{
  "name": "JPEG XR (extended range)",
  "async": true,
  "aliases": ["jpeg-xr"],
  "property": "jpegxr",
  "tags": ["image"],
  "notes": [{
    "name": "Wikipedia Article",
    "href": "https://en.wikipedia.org/wiki/JPEG_XR"
  }]
}
!*/
/*!
{
  "name": "image and iframe native lazy loading",
  "property": "lazyloading",
  "caniuse": "loading-lazy-attr",
  "tags": ["image", "lazy", "loading"],
  "notes": [{
    "name": "Native image lazy-loading for the web",
    "href": "https://addyosmani.com/blog/lazy-loading/"
  }]
}
!*/
/*!
{
  "name": "sizes attribute",
  "async": true,
  "property": "sizes",
  "tags": ["image"],
  "authors": ["Mat Marquis"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/embedded-content.html#the-img-element"
  }, {
    "name": "Srcset and sizes",
    "href": "https://ericportis.com/posts/2014/srcset-sizes/"
  }]
}
!*/
/*!
{
  "name": "srcset attribute",
  "property": "srcset",
  "caniuse": "srcset",
  "tags": ["image"],
  "notes": [{
    "name": "Smashing Magazine Article",
    "href": "https://www.smashingmagazine.com/2013/08/webkit-implements-srcset-and-why-its-a-good-thing/"
  }, {
    "name": "Generate multi-resolution images for srcset with Grunt",
    "href": "https://addyosmani.com/blog/generate-multi-resolution-images-for-srcset-with-grunt/"
  }]
}
!*/
/*!
{
  "name": "Webp Alpha",
  "async": true,
  "property": "webpalpha",
  "aliases": ["webp-alpha"],
  "tags": ["image"],
  "authors": ["Krister Kari", "Rich Bradshaw", "Ryan Seddon", "Paul Irish"],
  "notes": [{
    "name": "WebP Info",
    "href": "https://developers.google.com/speed/webp/"
  }, {
    "name": "Article about WebP support",
    "href": "https://optimus.keycdn.com/support/webp-support/"
  }, {
    "name": "Chromium WebP announcement",
    "href": "https://blog.chromium.org/2011/11/lossless-and-transparency-encoding-in.html?m=1"
  }]
}
!*/
/*!
{
  "name": "Webp Animation",
  "async": true,
  "property": "webpanimation",
  "aliases": ["webp-animation"],
  "tags": ["image"],
  "authors": ["Krister Kari", "Rich Bradshaw", "Ryan Seddon", "Paul Irish"],
  "notes": [{
    "name": "WebP Info",
    "href": "https://developers.google.com/speed/webp/"
  }, {
    "name": "Chromium blog - Chrome 32 Beta: Animated WebP images and faster Chrome for Android touch input",
    "href": "https://blog.chromium.org/2013/11/chrome-32-beta-animated-webp-images-and.html"
  }]
}
!*/
/*!
{
  "name": "Webp Lossless",
  "async": true,
  "property": ["webplossless", "webp-lossless"],
  "tags": ["image"],
  "authors": ["@amandeep", "Rich Bradshaw", "Ryan Seddon", "Paul Irish"],
  "notes": [{
    "name": "Webp Info",
    "href": "https://developers.google.com/speed/webp/"
  }, {
    "name": "Webp Lossless Spec",
    "href": "https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification"
  }]
}
!*/
/*!
{
  "name": "Webp",
  "async": true,
  "property": "webp",
  "caniuse": "webp",
  "tags": ["image"],
  "builderAliases": ["img_webp"],
  "authors": ["Krister Kari", "@amandeep", "Rich Bradshaw", "Ryan Seddon", "Paul Irish"],
  "notes": [{
    "name": "Webp Info",
    "href": "https://developers.google.com/speed/webp/"
  }, {
    "name": "Chromium blog - Chrome 32 Beta: Animated WebP images and faster Chrome for Android touch input",
    "href": "https://blog.chromium.org/2013/11/chrome-32-beta-animated-webp-images-and.html"
  }, {
    "name": "Webp Lossless Spec",
    "href": "https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification"
  }, {
    "name": "Article about WebP support",
    "href": "https://optimus.keycdn.com/support/webp-support/"
  }, {
    "name": "Chromium WebP announcement",
    "href": "https://blog.chromium.org/2011/11/lossless-and-transparency-encoding-in.html?m=1"
  }]
}
!*/
/*!
{
  "name": "input[capture] Attribute",
  "property": "capture",
  "tags": ["video", "image", "audio", "media", "attribute"],
  "notes": [{
    "name": "W3C Draft Spec",
    "href": "https://www.w3.org/TR/html-media-capture/"
  }]
}
!*/
/*!
{
  "name": "input[file] Attribute",
  "property": "fileinput",
  "caniuse": "forms",
  "tags": ["file", "forms", "input"],
  "builderAliases": ["forms_fileinput"]
}
!*/
/*!
{
  "name": "input[directory] Attribute",
  "property": "directory",
  "authors": ["silverwind"],
  "tags": ["file", "input", "attribute"]
}
!*/
/*!
{
  "name": "input formaction",
  "property": "inputformaction",
  "aliases": ["input-formaction"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fs-formaction"
  }, {
    "name": "Wufoo demo",
    "href": "https://www.wufoo.com/html5/formaction-attribute/"
  }],
  "polyfills": ["webshims"]
}
!*/
/*!
{
  "name": "input[form] Attribute",
  "property": "formattribute",
  "tags": ["attribute", "forms", "input"],
  "builderAliases": ["forms_formattribute"]
}
!*/
/*!
{
  "name": "input formenctype",
  "property": "inputformenctype",
  "aliases": ["input-formenctype"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fs-formenctype"
  }, {
    "name": "Wufoo demo",
    "href": "https://www.wufoo.com/html5/formenctype-attribute/"
  }],
  "polyfills": ["html5formshim"]
}
!*/
/*!
{
  "name": "input formmethod",
  "property": "inputformmethod",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fs-formmethod"
  }, {
    "name": "Wufoo demo",
    "href": "https://www.wufoo.com/html5/formmethod-attribute/"
  }],
  "polyfills": ["webshims"]
}
!*/
/*!
{
  "name": "input formnovalidate",
  "property": "inputformnovalidate",
  "aliases": ["input-formnovalidate"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fs-formnovalidate"
  }, {
    "name": "Wufoo demo",
    "href": "https://www.wufoo.com/html5/formnovalidate-attribute/"
  }],
  "polyfills": ["html5formshim"]
}
!*/
/*!
{
  "name": "input formtarget",
  "property": "inputformtarget",
  "aliases": ["input-formtarget"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fs-formtarget"
  }, {
    "name": "Wufoo demo",
    "href": "https://www.wufoo.com/html5/formtarget-attribute/"
  }],
  "polyfills": ["html5formshim"]
}
!*/
/*!
{
  "name": "Input attributes",
  "property": "input",
  "tags": ["forms"],
  "authors": ["Mike Taylor"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/input.html#input-type-attr-summary"
  }],
  "knownBugs": ["Some blackberry devices report false positive for input.multiple"]
}
!*/
/*!
{
  "name": "Form input types",
  "property": "inputtypes",
  "caniuse": "forms",
  "tags": ["forms"],
  "authors": ["Mike Taylor"],
  "polyfills": [
    "jquerytools",
    "webshims",
    "h5f",
    "webforms2",
    "nwxforms",
    "fdslider",
    "html5slider",
    "galleryhtml5forms",
    "jscolor",
    "html5formshim",
    "selectedoptionsjs",
    "formvalidationjs"
  ]
}
!*/
/*!
{
  "name": "Form Validation",
  "property": "formvalidation",
  "tags": ["forms", "validation", "attribute"],
  "builderAliases": ["forms_validation"]
}
!*/
/*!
{
  "name": "input[type=\"number\"] Localization",
  "property": "localizednumber",
  "tags": ["forms", "localization", "attribute"],
  "authors": ["Peter Janes"],
  "notes": [{
    "name": "Webkit Bug Tracker Listing",
    "href": "https://bugs.webkit.org/show_bug.cgi?id=42484"
  }, {
    "name": "Based on This",
    "href": "https://trac.webkit.org/browser/trunk/LayoutTests/fast/forms/script-tests/input-number-keyoperation.js?rev=80096#L9"
  }],
  "knownBugs": ["Only ever returns true if the browser/OS is configured to use comma as a decimal separator. This is probably fine for most use cases."]
}
!*/
/*!
{
  "name": "input[search] search event",
  "property": "inputsearchevent",
  "tags": ["input","search"],
  "authors": ["Calvin Webster"],
  "notes": [{
    "name": "Wufoo demo",
    "href": "https://www.wufoo.com/html5/search-type/"
  }, {
    "name": "CSS Tricks",
    "href": "https://css-tricks.com/webkit-html5-search-inputs/"
  }]
}
!*/
/*!
{
  "name": "placeholder attribute",
  "property": "placeholder",
  "tags": ["forms", "attribute"],
  "builderAliases": ["forms_placeholder"]
}
!*/
/*!
{
  "name": "form#requestAutocomplete()",
  "property": "requestautocomplete",
  "tags": ["form", "forms", "requestAutocomplete", "payments"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://wiki.whatwg.org/wiki/RequestAutocomplete"
  }]
}
!*/
/*!
{
  "name": "Internationalization API",
  "property": "intl",
  "caniuse": "internationalization",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl"
  }, {
    "name": "ECMAScript spec",
    "href": "https://www.ecma-international.org/ecma-402/1.0/"
  }]
}
 !*/
/*!
{
  "name": "Font Ligatures",
  "property": "ligatures",
  "caniuse": "font-feature",
  "notes": [{
    "name": "Cross-browser Web Fonts",
    "href": "https://www.sitepoint.com/cross-browser-web-fonts-part-3/"
  }]
}
!*/
/*!
{
  "name": "Reverse Ordered Lists",
  "property": "olreversed",
  "notes": [{
    "name": "Impressive Webs article",
    "href": "https://www.impressivewebs.com/reverse-ordered-lists-html5/"
  }],
  "builderAliases": ["lists_reversed"]
}
!*/
/*!
{
  "name": "MathML",
  "property": "mathml",
  "caniuse": "mathml",
  "authors": ["Addy Osmani", "Davide P. Cervone", "David Carlisle"],
  "knownBugs": ["Firefox < 4 will likely return a false, however it does support MathML inside XHTML documents"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/Math/"
  }],
  "polyfills": ["mathjax"]
}
!*/
/*!
{
  "name": "Media Source Extensions API",
  "caniuse": "mediasource",
  "property": "mediasource",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
  }],
  "builderAliases": ["media_source_extension_api"]
}
!*/
/*!
{
  "name": "Hover Media Query",
  "property": "hovermq",
  "tags": ["mediaquery"]
}
!*/
/*!
{
  "name": "Pointer Media Query",
  "property": "pointermq",
  "tags": ["mediaquery"]
}
!*/
/*!
{
  "name": "Message Channel",
  "property": "messagechannel",
  "authors": ["Raju Konga (@kongaraju)"],
  "caniuse": "channel-messaging",
  "tags": ["performance", "messagechannel"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/2011/WD-webmessaging-20110317/#message-channels"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API/Using_channel_messaging"
  }]
}
!*/
/*!
{
  "name": "Beacon API",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/navigator.sendBeacon"
  }, {
    "name": "W3C Spec",
    "href": "https://w3c.github.io/beacon/"
  }],
  "property": "beacon",
  "caniuse": "beacon",
  "tags": ["beacon", "network"],
  "authors": ["Cătălin Mariș"]
}
!*/
/*!
{
  "name": "Connection Effective Type",
  "notes": [{
    "name": "MDN documentation",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/effectiveType"
  }],
  "property": "connectioneffectivetype",
  "builderAliases": ["network_connection"],
  "tags": ["network"]
}
!*/
/*!
{
  "name": "Low Bandwidth Connection",
  "property": "lowbandwidth",
  "tags": ["network"],
  "builderAliases": ["network_connection"]
}
!*/
/*!
{
  "name": "Server Sent Events",
  "property": "eventsource",
  "tags": ["network"],
  "builderAliases": ["network_eventsource"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events"
  }]
}
!*/
/*!
{
  "name": "Fetch API",
  "property": "fetch",
  "tags": ["network"],
  "caniuse": "fetch",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://fetch.spec.whatwg.org/"
  }],
  "polyfills": ["fetch"]
}
!*/
/*!
{
  "name": "XHR responseType='arraybuffer'",
  "property": "xhrresponsetypearraybuffer",
  "tags": ["network"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://xhr.spec.whatwg.org/#the-responsetype-attribute"
  }]
}
!*/
/*!
{
  "name": "XHR responseType='blob'",
  "property": "xhrresponsetypeblob",
  "tags": ["network"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://xhr.spec.whatwg.org/#the-responsetype-attribute"
  }]
}
!*/
/*!
{
  "name": "XHR responseType='document'",
  "property": "xhrresponsetypedocument",
  "tags": ["network"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://xhr.spec.whatwg.org/#the-responsetype-attribute"
  }]
}
!*/
/*!
{
  "name": "XHR responseType='json'",
  "property": "xhrresponsetypejson",
  "tags": ["network"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://xhr.spec.whatwg.org/#the-responsetype-attribute"
  }, {
    "name": "Explanation of xhr.responseType='json'",
    "href": "https://mathiasbynens.be/notes/xhr-responsetype-json"
  }]
}
!*/
/*!
{
  "name": "XHR responseType='text'",
  "property": "xhrresponsetypetext",
  "tags": ["network"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://xhr.spec.whatwg.org/#the-responsetype-attribute"
  }]
}
!*/
/*!
{
  "name": "XHR responseType",
  "property": "xhrresponsetype",
  "tags": ["network"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://xhr.spec.whatwg.org/#the-responsetype-attribute"
  }]
}
!*/
/*!
{
  "name": "XML HTTP Request Level 2 XHR2",
  "property": "xhr2",
  "caniuse": "xhr2",
  "tags": ["network"],
  "builderAliases": ["network_xhr2"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/XMLHttpRequest2/"
  }, {
    "name": "Details on Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/385"
  }]
}
!*/
/*!
{
  "name": "Notification",
  "property": "notification",
  "caniuse": "notifications",
  "authors": ["Theodoor van Donge", "Hendrik Beskow"],
  "notes": [{
    "name": "HTML5 Rocks Tutorial",
    "href": "https://www.html5rocks.com/en/tutorials/notifications/quick/"
  }, {
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/notifications/"
  }, {
    "name": "Changes in Chrome to Notifications API due to Service Worker Push Notifications",
    "href": "https://developers.google.com/web/updates/2015/05/Notifying-you-of-notificiation-changes"
  }],
  "knownBugs": ["Possibility of false-positive on Chrome for Android if permissions we're granted for a website prior to Chrome 44."],
  "polyfills": ["desktop-notify", "html5-notifications"]
}
!*/
/*!
{
  "name": "Page Visibility API",
  "property": "pagevisibility",
  "caniuse": "pagevisibility",
  "tags": ["performance"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/DOM/Using_the_Page_Visibility_API"
  }, {
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/2011/WD-page-visibility-20110602/"
  }, {
    "name": "HTML5 Rocks Tutorial",
    "href": "https://www.html5rocks.com/en/tutorials/pagevisibility/intro/"
  }],
  "polyfills": ["visibilityjs", "visiblyjs", "jquery-visibility"]
}
!*/
/*!
{
  "name": "Navigation Timing API",
  "property": "performance",
  "caniuse": "nav-timing",
  "tags": ["performance"],
  "authors": ["Scott Murphy (@uxder)"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/navigation-timing/"
  }, {
    "name": "HTML5 Rocks Tutorial",
    "href": "https://www.html5rocks.com/en/tutorials/webperformance/basics/"
  }],
  "polyfills": ["perfnow"]
}
!*/
/*!
{
  "name": "Pointer Lock API",
  "property": "pointerlock",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/API/Pointer_Lock_API"
  }],
  "builderAliases": ["pointerlock_api"]
}
!*/
/*!
{
  "name": "postMessage",
  "property": "postmessage",
  "caniuse": "x-doc-messaging",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/webmessaging/#crossDocumentMessages"
  }],
  "polyfills": ["easyxdm", "postmessage-jquery"],
  "knownBugs": [
    "structuredclones - Android 2&3 can not send a structured clone of dates, filelists or regexps.",
    "Some old WebKit versions have bugs."
  ],
  "warnings": ["To be safe you should stick with object, array, number and pixeldata."]
}
!*/
/*!
{
  "name": "Proxy Object",
  "property": "proxy",
  "caniuse": "proxy",
  "authors": ["Brock Beaudry"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy"
  }],
  "polyfills": [
    "harmony-reflect"
  ]
}
!*/
/*!
{
  "name": "QuerySelector",
  "property": "queryselector",
  "caniuse": "queryselector",
  "tags": ["queryselector"],
  "authors": ["Andrew Betts (@triblondon)"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/selectors-api/#queryselectorall"
  }],
  "polyfills": ["css-selector-engine"]
}
!*/
/*!
{
  "name": "rel=prefetch",
  "property": "prefetch",
  "caniuse": "link-rel-prefetch",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/resource-hints/#prefetch"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/2536"
  }]
}
!*/
/*!
{
  "name": "requestAnimationFrame",
  "property": "requestanimationframe",
  "aliases": ["raf"],
  "caniuse": "requestanimationframe",
  "tags": ["animation"],
  "authors": ["Addy Osmani"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/animation-timing/"
  }],
  "polyfills": ["raf"]
}
!*/
/*!
{
  "name": "script[async]",
  "property": "scriptasync",
  "caniuse": "script-async",
  "tags": ["script"],
  "builderAliases": ["script_async"],
  "authors": ["Theodoor van Donge"]
}
!*/
/*!
{
  "name": "script[defer]",
  "property": "scriptdefer",
  "caniuse": "script-defer",
  "tags": ["script"],
  "builderAliases": ["script_defer"],
  "authors": ["Theodoor van Donge"],
  "warnings": ["Browser implementation of the `defer` attribute vary: https://stackoverflow.com/questions/3952009/defer-attribute-chrome#answer-3982619"],
  "knownBugs": ["False positive in Opera 12"]
}
!*/
/*!
{
  "name": "scrollToOptions dictionary",
  "property": "scrolltooptions",
  "caniuse": "mdn-api_scrolltooptions",
  "notes": [{
    "name": "MDN docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo"
  }],
  "authors": ["Oliver Tušla (@asmarcz)", "Chris Smith (@chris13524)"]
}
!*/
/*!
{
  "name": "ServiceWorker API",
  "property": "serviceworker",
  "caniuse": "serviceworkers",
  "notes": [{
    "name": "ServiceWorkers Explained",
    "href": "https://github.com/slightlyoff/ServiceWorker/blob/master/explainer.md"
  }]
}
!*/
/*!
{
  "property": "speechrecognition",
  "caniuse": "speech-recognition",
  "tags": ["input", "speech"],
  "authors": ["Cătălin Mariș"],
  "name": "Speech Recognition API",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://w3c.github.io/speech-api/speechapi.html#speechreco-section"
  }, {
    "name": "Introduction to the Web Speech API",
    "href": "https://developers.google.com/web/updates/2013/01/Voice-Driven-Web-Apps-Introduction-to-the-Web-Speech-API"
  }]
}
!*/
/*!
{
  "property": "speechsynthesis",
  "caniuse": "speech-synthesis",
  "tags": ["input", "speech"],
  "authors": ["Cătălin Mariș"],
  "name": "Speech Synthesis API",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://w3c.github.io/speech-api/speechapi.html#tts-section"
  }]
}
!*/
/*!
{
  "name": "Cookies",
  "property": "cookies",
  "tags": ["storage"],
  "authors": ["tauren"]
}
!*/
/*!
{
  "name": "IndexedDB",
  "property": "indexeddb",
  "caniuse": "indexeddb",
  "tags": ["storage"],
  "polyfills": ["indexeddb"],
  "async": true
}
!*/
/*!
{
  "name": "IndexedDB Blob",
  "property": "indexeddbblob",
  "tags": ["storage"]
}
!*/
/*!
{
  "name": "IndexedDB 2.0",
  "property": "indexeddb2",
  "tags": ["storage"],
  "caniuse": "indexeddb2",
  "authors": ["Tan Zhen Yong (@Xenonym)"],
  "polyfills": ["indexeddb"],
  "async": true
}
!*/
/*!
{
  "name": "Local Storage",
  "property": "localstorage",
  "caniuse": "namevalue-storage",
  "tags": ["storage"],
  "polyfills": [
    "joshuabell-polyfill",
    "cupcake",
    "storagepolyfill",
    "amplifyjs",
    "yui-cacheoffline"
  ]
}
!*/
/*!
{
  "name": "Quota Storage Management API",
  "property": "quotamanagement",
  "tags": ["storage"],
  "builderAliases": ["quota_management_api"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/quota-api/"
  }]
}
!*/
/*!
{
  "name": "Session Storage",
  "property": "sessionstorage",
  "tags": ["storage"],
  "polyfills": ["joshuabell-polyfill", "cupcake", "storagepolyfill"]
}
!*/
/*!
{
  "name": "IE User Data API",
  "property": "userdata",
  "tags": ["storage"],
  "authors": ["@stereobooster"],
  "notes": [{
    "name": "MSDN Documentation",
    "href": "https://msdn.microsoft.com/en-us/library/ms531424.aspx"
  }]
}
!*/
/*!
{
  "name": "Web SQL Database",
  "property": "websqldatabase",
  "caniuse": "sql-storage",
  "tags": ["storage"]
}
!*/
/*!
{
  "name": "style[scoped]",
  "property": "stylescoped",
  "caniuse": "style-scoped",
  "tags": ["dom"],
  "builderAliases": ["style_scoped"],
  "authors": ["Cătălin Mariș"],
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/semantics.html#attr-style-scoped"
  }],
  "polyfills": ["scoped-styles"]
}
!*/
/*!
{
  "name": "SVG",
  "property": "svg",
  "caniuse": "svg",
  "tags": ["svg"],
  "authors": ["Erik Dahlstrom"],
  "polyfills": [
    "svgweb",
    "raphael",
    "canvg",
    "svg-boilerplate",
    "sie",
    "fabricjs"
  ]
}
!*/
/*!
{
  "name": "SVG as an <img> tag source",
  "property": "svgasimg",
  "caniuse": "svg-img",
  "tags": ["svg"],
  "aliases": ["svgincss"],
  "authors": ["Chris Coyier"],
  "notes": [{
    "name": "HTML5 Spec",
    "href": "https://www.w3.org/TR/html5/embedded-content-0.html#the-img-element"
  }]
}
!*/
/*!
{
  "name": "SVG clip paths",
  "property": "svgclippaths",
  "tags": ["svg"],
  "notes": [{
    "name": "Demo",
    "href": "http://srufaculty.sru.edu/david.dailey/svg/newstuff/clipPath4.svg"
  }]
}
!*/
/*!
{
  "name": "SVG filters",
  "property": "svgfilters",
  "caniuse": "svg-filters",
  "tags": ["svg"],
  "builderAliases": ["svg_filters"],
  "authors": ["Erik Dahlstrom"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/SVG11/filters.html"
  }]
}
!*/
/*!
{
  "name": "SVG foreignObject",
  "property": "svgforeignobject",
  "tags": ["svg"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/SVG11/extend.html"
  }]
}
!*/
/*!
{
  "name": "Inline SVG",
  "property": "inlinesvg",
  "caniuse": "svg-html5",
  "tags": ["svg"],
  "notes": [{
    "name": "Test page",
    "href": "https://paulirish.com/demo/inline-svg"
  }, {
    "name": "Test page and results",
    "href": "https://codepen.io/eltonmesquita/full/GgXbvo/"
  }],
  "polyfills": ["inline-svg-polyfill"],
  "knownBugs": ["False negative on some Chromia browsers."]
}
!*/
/*!
{
  "name": "SVG SMIL animation",
  "property": "smil",
  "caniuse": "svg-smil",
  "tags": ["svg"],
  "notes": [{
  "name": "W3C Spec",
  "href": "https://www.w3.org/AudioVideo/"
  }]
}
!*/
/*!
{
  "name": "textarea maxlength",
  "property": "textareamaxlength",
  "aliases": ["textarea-maxlength"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea"
  }],
  "polyfills": ["maxlength"]
}
!*/
/*!
{
  "name": "Text Encoding/Decoding",
  "property": ["textencoder", "textdecoder"],
  "caniuse" : "textencoder",
  "notes": [{
    "name": "MDN TextEncoder Doc",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder"
  }, {
    "name": "MDN TextDecoder Doc",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder"
  }],
  "authors": ["dabretin"]
}
!*/
/*!
{
  "name": "Typed arrays",
  "property": "typedarrays",
  "caniuse": "typedarrays",
  "tags": ["js"],
  "authors": ["Stanley Stuart (@fivetanley)"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays"
  }, {
    "name": "Kronos spec",
    "href": "http://www.ecma-international.org/ecma-262/6.0/#sec-typedarray-objects"
  }],
  "polyfills": ["joshuabell-polyfill"]
}
!*/
/*!
{
  "name": "Unicode Range",
  "property": "unicoderange",
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/2013/CR-css-fonts-3-20131003/#descdef-unicode-range"
  }, {
    "name": "24 Way article",
    "href": "https://24ways.org/2011/creating-custom-font-stacks-with-unicode-range"
  }]
}
!*/
/*!
{
  "name": "Blob URLs",
  "property": "bloburls",
  "caniuse": "bloburls",
  "notes": [{
    "name": "W3C Working Draft Spec",
    "href": "https://www.w3.org/TR/FileAPI/#creating-revoking"
  }],
  "tags": ["file", "url"],
  "authors": ["Ron Waldon (@jokeyrhyme)"]
}
!*/
/*!
{
  "name": "Data URI",
  "property": "datauri",
  "caniuse": "datauri",
  "tags": ["url"],
  "builderAliases": ["url_data_uri"],
  "async": true,
  "notes": [{
    "name": "Wikipedia article",
    "href": "https://en.wikipedia.org/wiki/Data_URI_scheme"
  }],
  "warnings": ["Support in Internet Explorer 8 is limited to images and linked resources like CSS files, not HTML files"]
}
!*/
/*!
{
  "name": "URL parser",
  "property": "urlparser",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://url.spec.whatwg.org/"
  }],
  "polyfills": ["urlparser"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["url"]
}
!*/
/*!
{
  "property": "urlsearchparams",
  "caniuse": "urlsearchparams",
  "tags": ["querystring", "url"],
  "authors": ["Cătălin Mariș"],
  "name": "URLSearchParams API",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://url.spec.whatwg.org/#interface-urlsearchparams"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams"
  }]
}
!*/
/*!
{
  "name": "Vibration API",
  "property": "vibrate",
  "caniuse": "vibration",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en/DOM/window.navigator.mozVibrate"
  }, {
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/vibration/"
  }]
}
!*/
/*!
{
  "name": "HTML5 Video",
  "property": "video",
  "caniuse": "video",
  "tags": ["html5", "video", "media"],
  "knownBugs": ["Without QuickTime, `Modernizr.video.h264` will be `undefined`; https://github.com/Modernizr/Modernizr/issues/546"],
  "polyfills": [
    "html5media",
    "mediaelementjs",
    "videojs",
    "leanbackplayer",
    "videoforeverybody"
  ]
}
!*/
/*!
{
  "name": "Video Autoplay",
  "property": "videoautoplay",
  "tags": ["video"],
  "async": true,
  "warnings": ["This test is very large – only include it if you absolutely need it"],
  "knownBugs": ["crashes with an alert on iOS7 when added to homescreen"]
}
!*/
/*!
{
  "name": "Video crossOrigin",
  "property": "videocrossorigin",
  "caniuse": "cors",
  "authors": ["Florian Mailliet"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes"
  }]
}
!*/
/*!
{
  "name": "Video Loop Attribute",
  "property": "videoloop",
  "tags": ["video", "media"]
}
!*/
/*!
{
  "name": "Video Preload Attribute",
  "property": "videopreload",
  "tags": ["video", "media"]
}
!*/
/*!
{
  "name": "VML",
  "property": "vml",
  "tags": ["vml"],
  "authors": ["Craig Andrews (@candrews)"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/NOTE-VML"
  }, {
    "name": "MSDN Documentation",
    "href": "https://docs.microsoft.com/en-us/windows/desktop/VML/msdn-online-vml-introduction"
  }]
}
!*/
/*!
{
  "name": "Web Intents",
  "property": "webintents",
  "authors": ["Eric Bidelman"],
  "notes": [{
    "name": "Web Intents project site",
    "href": "http://www.webintents.org/"
  }],
  "builderAliases": ["web_intents"]
}
!*/
/*!
{
  "name": "Web Animation API",
  "property": "webanimations",
  "caniuse": "web-animation",
  "tags": ["webanimations"],
  "polyfills": ["webanimationsjs"],
  "notes": [{
    "name": "Introducing Web Animations",
    "href": "https://birtles.wordpress.com/2013/06/26/introducing-web-animations/"
  }]
}
!*/
/*!
{
  "name": "PublicKeyCredential",
  "notes": [
    {
      "name": "MDN Documentation",
      "href": "https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential"
    },
    {
      "name": "Google Developers solution",
      "href": "https://developers.google.com/web/updates/2018/03/webauthn-credential-management#the_solution"
    }
  ],
  "property": "publickeycredential",
  "tags": ["webauthn", "web authentication"],
  "authors": ["Eric Delia"]
}
!*/
/*!
{
  "name": "WebGL",
  "property": "webgl",
  "caniuse": "webgl",
  "tags": ["webgl", "graphics"],
  "polyfills": ["jebgl", "cwebgl", "iewebgl"]
}
!*/
/*!
{
  "name": "WebGL Extensions",
  "property": "webglextensions",
  "tags": ["webgl", "graphics"],
  "builderAliases": ["webgl_extensions"],
  "async": true,
  "authors": ["Ilmari Heikkinen"],
  "notes": [{
    "name": "Kronos extensions registry",
    "href": "https://www.khronos.org/registry/webgl/extensions/"
  }]
}
!*/
/*!
{
  "name": "RTC Peer Connection",
  "property": "peerconnection",
  "caniuse": "rtcpeerconnection",
  "tags": ["webrtc"],
  "authors": ["Ankur Oberoi"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/webrtc/"
  }]
}
!*/
/*!
{
  "name": "RTC Data Channel",
  "property": "datachannel",
  "notes": [{
    "name": "HTML5 Rocks Tutorial",
    "href": "https://www.html5rocks.com/en/tutorials/webrtc/datachannels/"
  }]
}
!*/
/*!
{
  "name": "getUserMedia",
  "property": "getusermedia",
  "caniuse": "stream",
  "tags": ["webrtc"],
  "authors": ["Eric Bidelman", "Masataka Yakura"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://w3c.github.io/mediacapture-main/#dom-mediadevices-getusermedia"
  }]
}
!*/
/*!
{
  "name": "MediaStream Recording API",
  "property": "mediarecorder",
  "caniuse": "mediarecorder",
  "tags": ["mediarecorder", "media"],
  "authors": ["Onkar Dahale"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API"
  }]
}
!*/
/*!
{
  "name": "WebSockets Support",
  "property": "websockets",
  "authors": ["Phread (@fearphage)", "Mike Sherov (@mikesherov)", "Burak Yigit Kaya (@BYK)"],
  "caniuse": "websockets",
  "tags": ["html5"],
  "knownBugs": ["This test will reject any old version of WebSockets even if it is not prefixed such as in Safari 5.1"],
  "notes": [{
    "name": "CLOSING State and Spec",
    "href": "https://www.w3.org/TR/websockets/#the-websocket-interface"
  }],
  "polyfills": [
    "sockjs",
    "socketio",
    "websocketjs",
    "atmosphere",
    "graceful-websocket",
    "portal",
    "datachannel"
  ]
}
!*/
/*!
{
  "name": "Binary WebSockets",
  "property": "websocketsbinary",
  "tags": ["websockets"],
  "builderAliases": ["websockets_binary"]
}
!*/
/*!
{
  "name": "Base 64 encoding/decoding",
  "property": "atobbtoa",
  "builderAliases": ["atob-btoa"],
  "caniuse": "atob-btoa",
  "tags": ["atob", "base64", "WindowBase64", "btoa"],
  "authors": ["Christian Ulbrich"],
  "notes": [{
    "name": "WindowBase64",
    "href": "https://www.w3.org/TR/html5/webappapis.html#windowbase64"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/atob"
  }],
  "polyfills": ["base64js"]
}
!*/
/*!
{
  "name": "Framed window",
  "property": "framed",
  "tags": ["window"],
  "builderAliases": ["window_framed"]
}
!*/
/*!
{
  "name": "matchMedia",
  "property": "matchmedia",
  "caniuse": "matchmedia",
  "tags": ["matchmedia"],
  "authors": ["Alberto Elias"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://drafts.csswg.org/cssom-view/#the-mediaquerylist-interface"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Window.matchMedia"
  }],
  "polyfills": ["matchmediajs"]
}
!*/
/*!
{
  "name": "PushManager",
  "property": "pushmanager",
  "caniuse": "mdn-api_pushmanager",
  "authors": ["Dawid Kulpa (@dawidkulpa)"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/PushManager"
  }]
}
!*/
/*!
{
  "name": "ResizeObserver",
  "property": "resizeobserver",
  "caniuse": "resizeobserver",
  "tags": ["ResizeObserver"],
  "authors": ["Christian Andersson"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/resize-observer/"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver"
  }, {
    "name": "Web.dev Article",
    "href": "https://web.dev/resize-observer/"
  }, {
    "name": "Digital Ocean tutorial",
    "href": "https://www.digitalocean.com/community/tutorials/js-resize-observer"
  }]
}
!*/
/*!
{
  "name": "worker type option test",
  "property": "workertypeoption",
  "caniuse":"mdn-api_worker_worker_ecmascript_modules",
  "tags": ["web worker type options", "web worker"],
  "builderAliases": ["worker_type_options"],
  "authors": ["Debadutta Panda"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker"
  }]
}
!*/
/*!
{
  "name": "Workers from Blob URIs",
  "property": "blobworkers",
  "tags": ["performance", "workers"],
  "builderAliases": ["workers_blobworkers"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/workers/"
  }],
  "warnings": ["This test may output garbage to console."],
  "authors": ["Jussi Kalliokoski"],
  "async": true
}
!*/
/*!
{
  "name": "Workers from Data URIs",
  "property": "dataworkers",
  "tags": ["performance", "workers"],
  "builderAliases": ["workers_dataworkers"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/workers/"
  }],
  "warnings": ["This test may output garbage to console."],
  "authors": ["Jussi Kalliokoski"],
  "async": true
}
!*/
/*!
{
  "name": "Shared Workers",
  "property": "sharedworkers",
  "caniuse": "sharedworkers",
  "tags": ["performance", "workers"],
  "builderAliases": ["workers_sharedworkers"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/workers/"
  }]
}
!*/
/*!
{
  "name": "Web Workers",
  "property": "webworkers",
  "caniuse": "webworkers",
  "tags": ["performance", "workers"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/workers/"
  }, {
    "name": "HTML5 Rocks Tutorial",
    "href": "https://www.html5rocks.com/en/tutorials/workers/basics/"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers"
  }],
  "polyfills": ["fakeworker", "html5shims"]
}
!*/
/*!
{
  "name": "Transferables Objects",
  "property": "transferables",
  "tags": ["performance", "workers"],
  "builderAliases": ["transferables"],
  "notes": [{
    "name": "Transferable Objects: Lightning Fast!",
    "href": "https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast"
  }],
  "async": true
}
!*/
/*!
{
  "name": "XDomainRequest",
  "property": "xdomainrequest",
  "tags": ["cors", "xdomainrequest", "ie9", "ie8"],
  "authors": ["Ivan Pan (@hypotenuse)"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/XDomainRequest"
  }]
}
!*/

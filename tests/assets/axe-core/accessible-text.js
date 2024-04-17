module.exports = [
  {
    html: '<label><input type="button"></label>',
    target: 'input',
    accessibleText: '',
  },

  {
    html:
      '<ul role="menubar">' +
      ' <!-- Rule 2A: "File" label via aria-labelledby -->' +
      '  <li role="menuitem" aria-haspopup="true" aria-labelledby="fileLabel" id="rule2a">' +
      '    <span id="fileLabel">File</span>' +
      '    <ul role="menu">' +
      '      <!-- Rule 2C: "New" label via Namefrom:contents -->' +
      '      <li role="menuitem" id="rule2c">New</li>' +
      '      <li role="menuitem">Open…</li>' +
      '      …' +
      '    </ul>' +
      '  </li>' +
      '</ul>',
    target: ['#rule2a', '#rule2c'],
    accessibleText: ['File', 'New'],
  },

  {
    html:
      '<fieldset>' +
      '  <legend>Meeting alarms</legend>' +
      '  <!-- Rule 2A: "Beep" label given by native HTML label element -->' +
      '  <input type="checkbox" id="beep"> <label for="beep">Beep</label> <br>' +
      '  <input type="checkbox" id="mtgTitle"> <label for="mtgTitle">Display the meeting title</label> <br>' +
      '  <!-- Rule 2B -->' +
      '  <input type="checkbox" id="flash">' +
      '  <label for="flash">' +
      '    Flash the screen' +
      '    <!-- Rule 2A: label of text input given by aria-label, "Number of times to flash screen" -->' +
      '    <input type="text" value="3" size="2" id="numTimes" title="Number of times to flash screen">' +
      '    times' +
      '  </label>' +
      '</fieldset>',
    target: ['#beep', '#flash'],
    accessibleText: ['Beep', 'Flash the screen 3 times'],
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'aria-labelledby="t1label" aria-label="ARIA Label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t1',
    accessibleText: 'This is a label',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'aria-labelledby="t1 t1label" aria-label="ARIA Label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t1',
    accessibleText: 'ARIA Label This is a label',
  },

  {
    html:
      '<div id="t1label" style="display:none">This is a ' +
      '<span style="visibility:hidden">hidden </span>' +
      '<span aria-hidden="true">secret</span></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t1" aria-labelledby="t1label">',
    target: '#t1',
    accessibleText: 'This is a hidden secret',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'aria-label="ARIA Label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t1',
    accessibleText: 'ARIA Label',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'id="t1"> of <i>everything</i></div>' +
      '<img alt="Alt text goes here" id="target">' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#target',
    accessibleText: 'Alt text goes here',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'id="t1"> of <i>everything</i></div>' +
      '<input type="image" alt="Alt text goes here" id="target">' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#target',
    accessibleText: 'Alt text goes here',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'id="t1"> of <i>everything</i></div>' +
      '<input type="text" alt="Alt text goes here" id="target">' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#target',
    accessibleText: '',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t1',
    accessibleText: 'HTML Label',
  },

  {
    html:
      '<div id="t2label" role="heading">This is <input type="text" value="the value" ' +
      'aria-labelledby="t1label" aria-label="ARIA Label" id="t1"> of <i title="italics"></i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2label',
    accessibleText: 'This is This is a label of italics',
  },

  {
    html:
      '<div id="t2label" role="heading">This is <input type="text" value="the value" ' +
      'aria-labelledby="t1label" aria-label="ARIA Label" id="t1"> of <i></i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2label',
    accessibleText: 'This is This is a label of',
  },

  {
    html:
      '<div id="t2label" role="heading">This is ' +
      '  <input type="text" value="the value" ' +
      '    aria-labelledby="t1label" aria-label="ARIA Label" id="t1">' +
      '  of <i role="alert">everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2label',
    // accessibleText: 'This is This is a label of everything',
    // Chrome and axe-core disagree, we follow Chrome and spec proposal
    // https://github.com/w3c/aria/issues/1821.
    accessibleText: 'This is This is a label of',
  },

  {
    html:
      '<div id="target" role="heading"><label for="tb1">My form input</label>' +
      '<input type="text" id="tb1"></div>',
    target: '#target',
    accessibleText: 'My form input',
  },

  {
    html:
      '<div id="target" role="heading">' +
      '<input type="text" id="tb1"></div>' +
      '<label for="tb1">My form input</label>',
    target: '#target',
    // accessibleText: 'My form input',
    // All browsers and the spec (kind of) agree that input inside the target element should
    // use it's value as an "embedded control", rather than a label.
    // From the spec:
    //   If traversal of the current node is due to recursion and the current node
    //   is an embedded control, ignore aria-label and skip to rule Embedded Control.
    accessibleText: '',
  },

  {
    html:
      '<div id="t2label" role="heading">This is <input type="text" value="the value" ' +
      'aria-labelledby="t1label" aria-label="ARIA Label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2label',
    accessibleText: 'This is This is a label of everything',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'aria-labelledby="t1label" aria-label="ARIA Label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2',
    accessibleText: 'This is the value of everything',
  },

  {
    html:
      '<div id="t2label">This is <input type="hidden" value="the value" ' +
      'Label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2',
    accessibleText: 'This is of everything',
  },

  {
    html:
      '<div id="t2label">This is <input value="the value" ' +
      'aria-labelledby="t1label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2',
    accessibleText: 'This is the value of everything',
  },

  {
    html:
      '<div id="t2label">This is <select multiple ' +
      'aria-labelledby="t1label" id="t1">' +
      '<option selected>first</option><option>second</option><option selected>third</option>' +
      '</select> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2',
    accessibleText: 'This is first third of everything',
  },

  {
    html:
      '<div id="t2label">This is <textarea ' +
      'aria-labelledby="t1label" id="t1">the value</textarea> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2',
    accessibleText: 'This is the value of everything',
  },

  {
    html:
      '<div id="t2label">This <span aria-label="not a span">span</span>' +
      ' is <input type="text" value="the value" ' +
      'aria-labelledby="t1label" id="t1"> of <i>everything</i></div>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">',
    target: '#t2',
    accessibleText: 'This not a span is the value of everything',
  },

  {
    html:
      '<label for="target">' +
      '<select id="select">' +
      '	<option selected="selected">Chosen</option>' +
      '	<option>Not Selected</option>' +
      '</select>' +
      '</label>' +
      '<input id="target" type="text" />',
    target: '#target',
    accessibleText: 'Chosen',
  },

  {
    html:
      '<label for="select">My Select</label>' +
      '<label for="target">' +
      '<select id="select">' +
      '	<option selected="selected">Chosen</option>' +
      '	<option>Not Selected</option>' +
      '</select>' +
      '</label>' +
      '<input id="target" type="text" />',
    target: '#target',
    // accessibleText: '',
    // Chrome and axe-core disagree, we follow Chrome and spec.
    accessibleText: 'Chosen',
  },

  {
    html:
      '<label>' +
      '<span class="label"></span>' +
      '<select id="target">' +
      '<option value="1" selected="selected">Please choose a region</option>' +
      '<option value="2">Coastal</option>' +
      '<option value="3">Forest</option>' +
      '<option value="4">Grasslands</option>' +
      '<option value="5">Mountains</option>' +
      '</select>' +
      '</label>',
    target: '#target',
    accessibleText: '',
  },

  {
    html:
      '<label>' +
      '<select id="select">' +
      '	<option selected="selected">Chosen</option>' +
      '	<option>Not Selected</option>' +
      '</select>' +
      '</label>' +
      '<input aria-labelledby="select" type="text" id="target" />',
    target: '#target',
    // accessibleText: '',
    // Chrome and axe-core disagree, we follow Chrome and spec.
    accessibleText: 'Chosen',
  },

  {
    html: '<a href="#" role="presentation" title="Hello"></a>',
    target: 'a',
    accessibleText: 'Hello',
  },

  {
    html: '<a href="#" role="presentation">Hello</a>',
    target: 'a',
    accessibleText: 'Hello',
  },

  {
    html: '<button role="presentation">Hello</button>',
    target: 'button',
    accessibleText: 'Hello',
  },

  {
    html: '<summary role="presentation">Hello</summary>',
    target: 'summary',
    // accessibleText: 'Hello',
    // Chrome and axe-core disagree, we follow Chrome and spec.
    accessibleText: '',
  },

  {
    html: '<a href="#" role="none" title="Hello"></a>',
    target: 'a',
    accessibleText: 'Hello',
  },

  {
    html: '<a href="#" role="none">Hello</a>',
    target: 'a',
    accessibleText: 'Hello',
  },

  {
    html: '<button role="none">Hello</button>',
    target: 'button',
    accessibleText: 'Hello',
  },

  {
    html: '<summary role="none">Hello</summary>',
    target: 'summary',
    // accessibleText: 'Hello',
    // Chrome and axe-core disagree, we follow Chrome and spec.
    accessibleText: '',
  },

  {
    html: '<a href="#">Hello<span>World</span></a>',
    target: 'a',
    accessibleText: 'HelloWorld',
  },

  {
    html: '<a href="#">Hello<div>World</div></a>',
    target: 'a',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<a href="#"><script> var ajiasdf = true; </script></a>',
    target: 'a',
    accessibleText: '',
  },

  {
    html: '<label><input type="button"></label>',
    target: 'input',
    accessibleText: '',
  },

  {
    html:
      '<button aria-label=" " aria-labelledby=" ">Hello World</button>',
    target: 'button',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t2label">This is <input type="text" value="the value" ' +
      'aria-labelledby="t1label" aria-label="ARIA Label" id="t1"> of <i>everything</i></div>' +
      '<div id="shadow"><template shadow>' +
      '<div id="t1label">This is a <b>label</b></div>' +
      '<label for="t1">HTML Label</label>' +
      '<input type="text" id="t2" aria-labelledby="t2label">' +
      '</template></div>',
    target: '#t1',
    accessibleText: 'ARIA Label',
  },

  {
    html: '<div id="shadow"><template shadow><input type="text" id="t1" title="I will be king"></template></div>',
    target: 'input',
    accessibleText: 'I will be king',
  },

  {
    html:
      '<div id="shadow"><template shadow><slot></slot></template>' +
      '<input type="text" id="t1" title="you will be queen"></div>',
    target: 'input',
    accessibleText: 'you will be queen',
  },

  {
    html: '<div id="shadow"><template shadow>' +
      '<input type="text" id="t1"><label for="t1"><slot>Fallback content heroes</slot></label>' +
      '</template></div>',
    target: 'input',
    accessibleText: 'Fallback content heroes',
  },

  {
    html:
      '<div id="t1">Hello</div>' +
      '<figure aria-labelledby="t1">Not part of a11yName <figcaption>Fail</figcaption></figure>',
    target: 'figure',
    accessibleText: 'Hello',
  },

  {
    html:
      '<figure aria-label="Hello">Not part of a11yName <figcaption>Fail</figcaption></figure>',
    target: 'figure',
    accessibleText: 'Hello',
  },

  {
    html:
      '<figure>Not part of a11yName <figcaption>Hello</figcaption></figure>',
    target: 'figure',
    accessibleText: 'Hello',
  },

  {
    html:
      '<figure title="Hello">Not part of a11yName <figcaption></figcaption></figure>',
    target: 'figure',
    // accessibleText: 'Hello',
    // Chrome and axe-core disagree, we follow Chrome and spec.
    accessibleText: '',
  },

  {
    html: '<figure>Hello<figcaption></figcaption></figure>',
    target: 'figure',
    // accessibleText: 'Hello',
    // Chrome and axe-core disagree, we follow Chrome and spec.
    accessibleText: '',
  },

  {
    html: '<div><template shadow><figure>Not part of a11yName <figcaption><slot></slot></figcaption></figure></template></div>',
    target: 'figure',
    // accessibleText: 'Hello',
    // Chrome and axe-core disagree, we follow Chrome and spec.
    accessibleText: '',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<img aria-labelledby="t1 t2">',
    target: 'img',
    accessibleText: 'Hello World',
  },

  {
    html: '<img aria-label="Hello World">',
    target: 'img',
    accessibleText: 'Hello World',
  },

  {
    html: '<img alt="Hello World">',
    target: 'img',
    accessibleText: 'Hello World',
  },

  {
    html: '<img title="Hello World">',
    target: 'img',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type="button" value="Hello">',
    target: 'input',
    accessibleText: 'Hello',
  },

  {
    html: '<input type="reset" value="Hello">',
    target: 'input',
    accessibleText: 'Hello',
  },

  {
    html: '<input type="submit" value="Hello">',
    target: 'input',
    accessibleText: 'Hello',
  },

  {
    html: '<input type="submit">',
    target: 'input',
    accessibleText: 'Submit',
  },

  {
    html: '<input type="reset">',
    target: 'input',
    accessibleText: 'Reset',
  },

  {
    html: '<input type="button" title="Hello">',
    target: 'input',
    accessibleText: 'Hello',
  },

  {
    html: '<input type="reset" title="Hello">',
    target: 'input',
    // accessibleText: 'Hello',
    // Chrome and axe-core disagree. We follow Chrome and spec.
    accessibleText: 'Reset',
  },

  {
    html: '<input type="submit" title="Hello">',
    target: 'input',
    // accessibleText: 'Hello',
    // Chrome and axe-core disagree. We follow Chrome and spec.
    accessibleText: 'Submit',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<table aria-labelledby="t1 t2"></table>',
    target: 'table',
    accessibleText: 'Hello World',
  },

  {
    html: '<table aria-label="Hello World"></table>',
    target: 'table',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<table><caption>Hello World</caption><tr><td>Stuff</td></tr></table>',
    target: 'table',
    accessibleText: 'Hello World',
  },

  {
    html: '<table title="Hello World"></table>',
    target: 'table',
    accessibleText: 'Hello World',
  },

  {
    html: '<table summary="Hello World"></table>',
    target: 'table',
    accessibleText: 'Hello World',
  },

  {
    html: '<table summary="Hello World" title="FAIL"></table>',
    target: 'table',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input type=text aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input type=password aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input type=search aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input type=tel aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input type=email aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input type=url aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=text aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=password aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=search aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=email aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=url aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=tel aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<input type=text></label>',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<input type=password></label>',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<input type=search></label>',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<input type=tel></label>',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<input type=email></label>',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<input type=url></label>',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<input></label>',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<input type=text id="t1">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<input type=password id="t1">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<input type=search id="t1">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<input type=tel id="t1">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<input type=email id="t1">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<input type=url id="t1">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<input id="t1">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=text placeholder="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=password placeholder="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=search placeholder="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=email placeholder="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=tel placeholder="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=url placeholder="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input placeholder="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=text title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=password title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=search title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=tel title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=email title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=url title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type=text>',
    target: 'input',
    accessibleText: '',
  },

  {
    html: '<input type=password>',
    target: 'input',
    accessibleText: '',
  },

  {
    html: '<input type=search>',
    target: 'input',
    accessibleText: '',
  },

  {
    html: '<input type=tel>',
    target: 'input',
    accessibleText: '',
  },

  {
    html: '<input type=email>',
    target: 'input',
    accessibleText: '',
  },

  {
    html: '<input type=url>',
    target: 'input',
    accessibleText: '',
  },

  {
    html: '<input>',
    target: 'input',
    accessibleText: '',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<textarea aria-labelledby="t1 t2"></textarea>',
    target: 'textarea',
    accessibleText: 'Hello World',
  },

  {
    html: '<textarea aria-label="Hello World"></textarea>',
    target: 'textarea',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label>Hello World' + '<textarea></textarea></label>',
    target: 'textarea',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<label for="t1">Hello World</label>' + '<textarea id="t1"></textarea>',
    target: 'textarea',
    accessibleText: 'Hello World',
  },

  {
    html: '<textarea placeholder="Hello World"></textarea>',
    target: 'textarea',
    accessibleText: 'Hello World',
  },

  {
    html: '<textarea title="Hello World"></textarea>',
    target: 'textarea',
    accessibleText: 'Hello World',
  },

  {
    html: '<textarea></textarea>',
    target: 'textarea',
    accessibleText: '',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<input type="image" aria-labelledby="t1 t2">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type="image" aria-label="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type="image" alt="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type="image" title="Hello World">',
    target: 'input',
    accessibleText: 'Hello World',
  },

  {
    html: '<input type="image">',
    target: 'input',
    accessibleText: 'Submit',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<a aria-labelledby="t1 t2"></a>',
    target: 'a',
    accessibleText: 'Hello World',
  },

  {
    html: '<a aria-label="Hello World"></a>',
    target: 'a',
    accessibleText: 'Hello World',
  },

  {
    html: '<a href="hey"><span>Hello<span> World</span></span></a>',
    target: 'a',
    // axe-core does not need href to be present, but spec and Chrome do.
    accessibleText: 'Hello World',
  },

  {
    html: '<a title="Hello World"></a>',
    target: 'a',
    accessibleText: 'Hello World',
  },

  {
    html: '<a></a>',
    target: 'a',
    accessibleText: '',
  },

  {
    html:
      '<a href="example.html">' +
      '<table role="presentation">' +
      '<tr>' +
      '<td>' +
      'Descriptive Link Text' +
      '</td>' +
      '</tr>' +
      '</table>' +
      '</a>',
    target: 'a',
    accessibleText: 'Descriptive Link Text',
  },

  {
    html:
      '<div id="t1">Hello</div><div id="t2">World</div>' +
      '<button aria-labelledby="t1 t2"></button>',
    target: 'button',
    accessibleText: 'Hello World',
  },

  {
    html: '<button aria-label="Hello World"></button>',
    target: 'button',
    accessibleText: 'Hello World',
  },

  {
    html:
      '<button><span>Hello<span> World</span></span></button>',
    target: 'button',
    accessibleText: 'Hello World',
  },

  {
    html: '<button title="Hello World"></button>',
    target: 'button',
    accessibleText: 'Hello World',
  },

  {
    html: '<button></button>',
    target: 'button',
    accessibleText: '',
  },

  {
    html: '<div id="t1">Hello</div><div id="t2">World</div><cite aria-labelledby="t1 t2" style="display:inline">',
    target: 'cite',
    accessibleText: 'Hello World',
  },

  {
    html: '<cite aria-label="Hello World" style="display:inline"></cite>',
    target: 'cite',
    accessibleText: 'Hello World',
  },

  {
    html: '<cite title="Hello World" style="display:inline"></cite>',
    target: 'cite',
    accessibleText: 'Hello World',
  },

  {
    html: '<cite style="display:inline"></cite>',
    target: 'cite',
    accessibleText: '',
  },
];

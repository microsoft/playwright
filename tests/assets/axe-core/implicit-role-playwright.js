module.exports = [
  // All TH in thead row -> columnheader
  {
    html: '<table><thead><tr><th id="target">A</th><th>B</th></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    target: '#target',
    role: 'columnheader',
  },
  {
    html: '<table><thead><tr><th>A</th><th id="target">B</th></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    target: '#target',
    role: 'columnheader',
  },
  // TH with TD sibling in same row -> rowheader
  {
    html: '<table><thead><tr><th id="target">A</th><td>B</td></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    target: '#target',
    role: 'rowheader',
  },
  // TH in tbody with TD sibling -> rowheader (even with TDs in same column)
  {
    html: '<table><thead><tr><th>A</th><th>B</th></thead><tbody><tr><th id="target">1</th><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>',
    target: '#target',
    role: 'rowheader',
  },
  // TH in tbody, second row, with TD sibling -> rowheader
  {
    html: '<table><thead><tr><th>A</th><th>B</th></thead><tbody><tr><th>1</th><td>2</td></tr><tr><th id="target">3</th><td>4</td></tr></tbody></table>',
    target: '#target',
    role: 'rowheader',
  },
    // TH with TD above and below in same column -> rowheader
  {
    html: '<table><thead><tr><th>A</th><th>B</th></thead><tbody><tr><td>5</td><td>6</td></tr><tr><th id="target">1</th><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>',
    target: '#target',
    role: 'rowheader',
  },
  // TH only cell in row -> no role
  {
    html: '<table><tr><th id="target">Only</th></tr></table>',
    target: '#target',
    role: null,
  },
    // TH only cell in row, but table has multiple rows -> columnheader
  {
    html: '<table><tr><th id="target">Header</th></tr><tr><td>Data</td></tr></table>',
    target: '#target',
    role: 'columnheader',
  },
  // TH surrounded by other TH -> columnheader
  {
    html: '<table><tr><th>A</th><th id="target">B</th><th>C</th></tr></table>',
    target: '#target',
    role: 'columnheader',
  },
  // Row with first cell as TD -> rowheader
  {
    html: '<table><tr><td>A</td><th id="target">B</th><th>C</th></tr></table>',
    target: '#target',
    role: 'rowheader',
  },
  // Row with last cell as TD -> rowheader
  {
    html: '<table><tr><th>A</th><th id="target">B</th><td>C</td></tr></table>',
    target: '#target',
    role: 'rowheader',
  },
  // scope="col" -> columnheader
  {
    html: '<table><tr><th id="target" scope="col">A</th><td>B</td></tr></table>',
    target: '#target',
    role: 'columnheader',
  },
  // scope="row" -> rowheader
  {
    html: '<table><tr><th id="target" scope="row">A</th><th>B</th></tr></table>',
    target: '#target',
    role: 'rowheader',
  },
  // scope="colgroup" -> columnheader
  {
    html: '<table><tr><th id="target" scope="colgroup">A</th><td>B</td></tr></table>',
    target: '#target',
    role: 'columnheader',
  },
  // scope="rowgroup" -> rowheader
  {
    html: '<table><tr><th id="target" scope="rowgroup">A</th><th>B</th></tr></table>',
    target: '#target',
    role: 'rowheader',
  },
];

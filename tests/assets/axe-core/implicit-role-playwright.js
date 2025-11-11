module.exports = [
  {
    html: '<table><thead><tr><th id="A">A</th><th>B</th></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    target: '#A',
    role: 'columnheader',
  },
  {
    html: '<table><thead><tr><th>A</th><th id="B">B</th></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    target: '#B',
    role: 'columnheader',
  },
  {
    html: '<table><thead><tr><th id="A">A</th><td>B</td></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    target: '#A',
    role: 'columnheader',
  },
  // All cells in the first column are TH, check first row
  {
    html: '<table><thead><tr><th>A</th><th>B</th></thead><tbody><tr><th id="A">1</th><td>2</td></tr><tr><th>3</th><td>4</td></tr></tbody></table>',
    target: '#A',
    role: 'rowheader',
  },
  // All cells in the first column are TH, check second row
  {
    html: '<table><thead><tr><th>A</th><th>B</th></thead><tbody><tr><th>1</th><td>2</td></tr><tr><th id="B">3</th><td>4</td></tr></tbody></table>',
    target: '#B',
    role: 'rowheader',
  },
  // Only first cell in the first column is TH
  {
    html: '<table><thead><tr><th>A</th><th>B</th></thead><tbody><tr><th id="A">1</th><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>',
    target: '#A',
    role: 'rowheader',
  },
];

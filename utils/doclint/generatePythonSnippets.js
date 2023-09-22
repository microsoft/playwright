// @ts-check

const fs = require("fs");
const md = require("../markdown");


/**
 * @param {string[]} input
 * @param {boolean} isSync
 */
function transformValue(input, isSync) {
  const out = [];
  const suffix = [];
  for (let line of input) {
    let match = line.match(/const { (\w+) } = require\('playwright'\);/);
    if (match) {
      if (isSync) {
        out.push('from playwright.sync_api import sync_playwright, Playwright');
        out.push('');
        out.push('def run(playwright: Playwright):');
        out.push(`    ${match[1]} = playwright.${match[1]}`);
        suffix.push(``);
        suffix.push(`with sync_playwright() as playwright:`);
        suffix.push(`    run(playwright)`);
      } else {
        out.push('import asyncio');
        out.push('from playwright.async_api import async_playwright, Playwright');
        out.push('');
        out.push('async def run(playwright: Playwright):');
        out.push(`    ${match[1]} = playwright.${match[1]}`);
        suffix.push(``);
        suffix.push(`async def main():`);
        suffix.push(`    async with async_playwright() as playwright:`);
        suffix.push(`        await run(playwright)`);
        suffix.push(`asyncio.run(main())`);
      }
      continue;
    }
    if (line.trim() === '(async () => {' || line.trim() === '})();')
      continue;
    if (!line)
      continue;
    if (line.trim() === '}')
      continue;
    line = line.replace(/\$\$eval/g, 'eval_on_selector_all');
    line = line.replace(/\$eval/g, 'eval_on_selector');
    line = line.replace(/\$\$/g, 'query_selector_all');
    line = line.replace(/\$/g, 'query_selector');
    line = line.replace(/([a-zA-Z$]+)/g, (match, p1) => toSnakeCase(p1));
    line = line.replace(/try {/, 'try:');
    line = line.replace(/async \(([^)]+)\) => {/, 'lambda $1:');
    line = line.replace(/} catch \(e\) {/, 'except Error as e:');
    line = line.replace(/;$/, '');
    line = line.replace(/  /g, '    ');
    line = line.replace(/'/g, '"');
    line = line.replace(/const /g, '');
    line = line.replace(/{\s*(\w+):\s*([^} ]+)\s*}/, "$1=$2");
    line = line.replace(/\/\/ /, "# ");
    line = line.replace(/\(\) => /, 'lambda: ');
    line = line.replace(/console.log/, 'print');
    line = line.replace(/function /, 'def ');
    line = line.replace(/{$/, '');
    if (isSync)
      line = line.replace(/await /g, "")
    out.push(line)
  }
  return [...out, ...suffix].join("\n");
}

/**
 *
 * @param {md.MarkdownNode} node
 * @param {boolean} isSync
 */
function generateComment(node, isSync) {
  const commentNode = md.clone(node)
  commentNode.codeLang = isSync ? "python sync" : "python async";
  commentNode.lines = ['# FIXME', ...transformValue(node.lines, isSync).split("\n")];
  return commentNode;
}

/**
 *
 * @param {md.MarkdownNode[]} spec
 */
function multiplyComment(spec) {
  const children = []
  for (const node of (spec || [])) {
    if (node.codeLang === "js")
      children.push(node, generateComment(node, false), generateComment(node, true));
    else
      children.push(node);
  }
  return children;
}

/**
 * @param {string} name
 */
function toSnakeCase(name) {
  const toSnakeCaseRegex = /((?<=[a-z0-9])[A-Z]|(?!^)[A-Z](?=[a-z]))/g;
  return name.replace(toSnakeCaseRegex, `_$1`).toLowerCase();
}

for (const name of fs.readdirSync("docs/src")) {
  if (!name.endsWith(".md"))
    continue;
  const inputFile = `docs/src/${name}`;
  const fileContent = fs.readFileSync(inputFile).toString();
  const nodes = md.parse(fileContent);
  
  md.visitAll(nodes, node => {
    if (node.children)
      node.children = multiplyComment(node.children);
  });
  
 
  const out = md.render(nodes, 120);
  fs.writeFileSync(inputFile, out);
}

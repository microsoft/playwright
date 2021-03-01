// @ts-check

const fs = require("fs");
const md = require("../markdown");


/**
 * @param {string[]} input
 */
function transformValue(input) {
  const out = [];
  const suffix = [];
  for (let line of input) {
    let match = line.match(/const { (\w+) } = require\('playwright'\);/);
    if (match) {
      out.push('import com.microsoft.playwright.*;');
      out.push('');
      out.push('public class Example {');
      out.push('  public static void main(String[] args) {');
      out.push('    try (Playwright playwright = Playwright.create()) {');      
      out.push(`      BrowserType ${match[1]} = playwright.${match[1]}();`);
      suffix.push('    }');
      suffix.push('  }');
      suffix.push('}');
      continue;
    }
    if (line.trim() === '(async () => {' || line.trim() === '})();')
      continue;
    if (!line)
      continue;
    if (line.trim() === '}')
      continue;
  
    // Remove await/Promise.all
    line = line.replace(/const \[(.+)\] = await Promise.all\(\[/g, '$1 =');
    line = line.replace(/Promise\.all\(\[/g, '');
    line = line.replace(/await /g, '');
  
    // Rename some methods
    line = line.replace(/\.goto\(/g, '.navigate(');
    line = line.replace(/\.continue\(/g, '.resume(');
    line = line.replace(/\.\$eval\(/g, '.evalOnSelector(');
    line = line.replace(/\.\$\$eval\(/g, '.evalOnSelectorAll(');
    line = line.replace(/\.\$\(/g, '.querySelector(');
    line = line.replace(/\.\$\$\(/g, '.querySelectorAll(');

    line = line.replace(/console.log/g, 'System.out.println');

    line = line.replace(/page.evaluate\((\(\) => [^\)]+)\)/g, 'page.evaluate("$1")');

    // Convert properties to methods
    line = line.replace(/\.keyboard\./g, '.keyboard().');
    line = line.replace(/\.mouse\./g, '.mouse().');
    line = line.replace(/\.coverage\./g, '.coverage().');
    line = line.replace(/\.accessibility\./g, '.accessibility().');
    line = line.replace(/\.chromium\./g, '.chromium().');
    line = line.replace(/\.webkit\./g, '.webkit().');
    line = line.replace(/\.firefox\./g, '.firefox().');
    line = line.replace(/\.length/g, '.size()');
  
    // JUnit asserts
    line = line.replace(/expect\((.+)\).toBeTruthy\(\);/g, 'assertNotNull($1);');
    line = line.replace(/expect\(error.message\)\.toContain\((.+)\);/g, 'assertTrue(e.getMessage().contains($1));');
    line = line.replace(/expect\((.+)\)\.toContain\((.+)\);/g, 'assertTrue($1.contains($2));');
    line = line.replace(/expect\((.+)\)\.toBe\(null\);/g, 'assertNull($1);');
    line = line.replace(/expect\((.+)\)\.not.toBe\(null\);/g, 'assertNotNull($1);');
    line = line.replace(/expect\((.+)\)\.toBe\(true\);/g, 'assertTrue($1);');
    line = line.replace(/expect\((.+)\)\.toBe\((.+)\);/g, 'assertEquals($2, $1);');
    line = line.replace(/expect\((.+)\)\.toEqual\(\[(.+)\]\);/g, 'assertEquals(Arrays.asList($2), $1);');
    line = line.replace(/expect\((.+)\)\.toEqual\((.+)\);/g, 'assertEquals($2, $1);');

    line = line.replace(/\[('[^']+')\]/g, '.get("$1")');
    line = line.replace(/.push\(/g, '.add(');
  
    // Define common types
    line = line.replace(/const browser = /g, 'Browser browser = ');
    line = line.replace(/const context = /g, 'BrowserContext context = ');
    line = line.replace(/const page = /g, 'Page page = ');
    line = line.replace(/const newPage = /g, 'Page newPage = ');
    line = line.replace(/const button/g, 'ElementHandle button');
    line = line.replace(/const result = /g, 'Object result = ');
    line = line.replace(/const response = /g, 'Response response = ');
    line = line.replace(/const request = /g, 'Request request = ');
    line = line.replace(/const requests = \[\];/g, 'List<Request> requests = new ArrayList<>();');
    line = line.replace(/const snapshot = page.accessibility/g, 'String snapshot = page.accessibility');
    line = line.replace(/snapshot\.children\./g, 'snapshot.children().');
    line = line.replace(/const (.+) = \[\];/g, 'List<> $1 = new ArrayList<>();');
    line = line.replace(/const (\w+ = .+evalOnSelector)/g, 'Object $1');
    line = line.replace(/const (\w+ = .+querySelector)/g, 'ElementHandle $1');
    line = line.replace(/const (.+= page.waitForNavigation)/g, 'Response $1');
    line = line.replace(/const messages = \[\]/g, 'List<String> messages = new ArrayList<>()');
    line = line.replace(/const frame = /g, 'Frame frame = ');
    line = line.replace(/const elementHandle = (.+)/g, 'JSHandle jsHandle = $1\n  ElementHandle elementHandle = jsHandle.asElement();\n');
    line = line.replace(/const (\w+ = \w+\.boundingBox)/g, 'BoundingBox $1');
    line = line.replace(/setViewportSize\({ width: (\d+), height: (\d+) }\)/g, 'setViewportSize($1, $2)');
    line = line.replace(/\.on\('([^']+)'/g, (match, p1, offset, string) => `.on${toTitleCase(p1)}(`);
    line = line.replace(/\.waitForEvent\('([^']+)'/g, (match, p1, offset, string) => `page.waitFor${toTitleCase(p1)}(() -> {})`);

    line = line.replace(/[`']/g, '"');

    out.push(line)
  }
  return [...out, ...suffix].join("\n");
}

/**
 * @param {string} name
 */
function toTitleCase(name) {
  return name[0].toUpperCase() + name.substring(1);
}

/**
 * @param {md.MarkdownNode} node
 */
function generateComment(node) {
  const commentNode = md.clone(node)
  commentNode.codeLang = 'java';
  commentNode.lines = ['// FIXME', ...transformValue(node.lines).split("\n")];
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
      children.push(node, generateComment(node));
    else
      children.push(node);
  }
  return children;
}

for (const name of fs.readdirSync("docs/src")) {
  if (!name.endsWith(".md"))
    continue;
  if (name.includes('android'))
    continue;
  const inputFile = `docs/src/${name}`;
  const fileline = fs.readFileSync(inputFile).toString();
  const nodes = md.parse(fileline);
  
  md.visitAll(nodes, node => {
    if (node.children)
      node.children = multiplyComment(node.children);
  });
  
  const out = md.render(nodes, 120);
  fs.writeFileSync(inputFile, out);
}

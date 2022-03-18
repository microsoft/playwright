// @ts-check

/** @typedef {import('../markdown').MarkdownNode} MarkdownNode */
const md = require('../markdown');

const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const glob = promisify(require('glob').glob);
const rimraf = require('rimraf');

const DOCS_DIR = path.normalize(path.join(__dirname, '..', '..', 'docs', 'src'));
const OUT_DIR = path.normalize(path.join(DOCS_DIR, "..", "tests", "generated"));

/**
 *
 * @param {string} src
 * @param {string} dst
 */
async function generateExamples(src, dst) {
    const contents = await fs.readFile(src);
    const ast = md.parse(contents.toString());

    let madeDir = false;

    /**
     *
     * @param {MarkdownNode} node
     */
    const walk = async (node) => {
        if (node.type === 'code' && node.codeLang.includes('RUNNABLE')) {
            const match = /js-flavor=(ts|js)/.exec(node.codeLang);
            if (!match)
                throw new Error(`
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
The following code block on line ${node.lineNo}, was marked RUNNABLE, but did
not have a valid js-flavor annotation:
-----------------------------------------------------------------------------
${JSON.stringify(node, null, '  ')}
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
`);

            const extension = match[1]
            if (node.lineNo === undefined)
                throw new Error(`Unexpected missing lineNo: ${JSON.stringify(node, null, '  ')}`);
            if (!node.lines || node.lines.length < 1)
                throw new Error(`Unexpected missing content: ${JSON.stringify(node, null, '  ')}`);

            if (!madeDir) {
                await fs.mkdir(path.dirname(dst), { recursive: true });
                madeDir = true;
            }

            await fs.writeFile(`${dst}-${node.lineNo}-${extension}.spec.${extension}`, [`// generated from ${src}:${node.lineNo}`, ...node.lines].join('\n'))
        }

        for (const c of (node.children || []))
            await walk(c);
    }

    for (const c of ast)
        await walk(c);
}


(async () => {
    const docs = await glob('./**/*.md', { cwd: DOCS_DIR });
    rimraf.sync(OUT_DIR);
    for (const doc of docs) {
        const fullPath = path.join(DOCS_DIR, doc);
        await generateExamples(fullPath, path.join(OUT_DIR, doc));
    }
})();

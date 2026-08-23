import fs from 'node:fs';
import path from 'node:path';

function tokenize(query) {
  return [...new Set(query.toLowerCase().trim().split(/\s+/).filter(Boolean))];
}

export function matchTopics(graph, terms) {
  const topics = [];
  const topicTerms = new Map();
  for (const node of graph.nodes) {
    if (node.type !== 'topic')
      continue;
    const matched = [];
    for (const term of terms) {
      if (node.name === term)
        matched.push({ term, exact: true });
      else if (node.name.includes(term))
        matched.push({ term, exact: false });
    }
    if (matched.length) {
      topics.push(node);
      topicTerms.set(node.id, matched);
    }
  }
  return { topics, topicTerms };
}

function referenceScore(node, matchedTerms) {
  let score = 0;
  const exact = matchedTerms.filter(m => m.exact);
  score += exact.length * 2;
  score += matchedTerms.length - exact.length;
  if (node.title) {
    const title = node.title.toLowerCase();
    for (const term of matchedTerms.map(m => m.term)) {
      if (title.includes(term))
        score += 1;
    }
  }
  return score;
}

export function search(graph, query, { limit = 20 } = {}) {
  const terms = tokenize(query);
  if (!terms.length)
    return { query, terms: [], topics: [], references: [], total: 0 };

  const { topics, topicTerms } = matchTopics(graph, terms);
  const topicIds = new Set(topics.map(n => n.id));

  const refMatches = new Map();
  for (const edge of graph.edges) {
    if (!topicIds.has(edge.to))
      continue;
    const termsForTopic = topicTerms.get(edge.to);
    const entry = refMatches.get(edge.from) ?? { node: null, matched: new Map() };
    const node = graph.nodes.find(n => n.id === edge.from);
    if (!node)
      continue;
    entry.node = node;
    for (const m of termsForTopic) {
      const prev = entry.matched.get(m.term);
      if (!prev || (m.exact && !prev.exact))
        entry.matched.set(m.term, m);
    }
    refMatches.set(edge.from, entry);
  }

  const references = [...refMatches.values()]
    .filter(entry => entry.node)
    .map(entry => {
      const matchedTerms = [...entry.matched.values()];
      return {
        id: entry.node.id,
        type: entry.node.type,
        file: entry.node.file,
        line: entry.node.line ?? null,
        title: entry.node.title ?? null,
        commit: entry.node.commit ?? null,
        commit_date: entry.node.commit_date ?? null,
        score: referenceScore(entry.node, matchedTerms),
        matched: matchedTerms.map(m => m.term).sort(),
      };
    })
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || (a.title ?? '').localeCompare(b.title ?? ''));

  const bounded = references.slice(0, limit);
  return { query, terms, topics, references: bounded, total: references.length };
}

function readFileLines(root, file) {
  const full = path.isAbsolute(file) ? file : path.join(root, file);
  if (!fs.existsSync(full))
    return null;
  return fs.readFileSync(full, 'utf8').split(/\r?\n/);
}

function sectionExcerpt(lines, line, excerptLines) {
  const start = Math.max(0, line - 1);
  let end = Math.min(lines.length, start + excerptLines);
  for (let i = start; i < end && i < lines.length; i++) {
    if (i !== start && /^#{1,4}\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return {
    excerpt: lines.slice(start, end).join('\n'),
    excerptStart: start + 1,
    excerptEnd: end,
  };
}

function exampleExcerpt(lines, maxExcerptLines) {
  if (lines.length <= maxExcerptLines) {
    return {
      excerpt: lines.join('\n'),
      excerptStart: 1,
      excerptEnd: lines.length,
    };
  }
  const head = lines.slice(0, maxExcerptLines);
  return {
    excerpt: `${head.join('\n')}\n... (${lines.length} lines total, truncated)`,
    excerptStart: 1,
    excerptEnd: maxExcerptLines,
  };
}

export function retrieveContext(graph, query, { limit = 10, excerptLines = 80, maxExcerptLines = 200, root = process.cwd() } = {}) {
  const { references } = search(graph, query, { limit });
  const enriched = references.map(ref => {
    const lines = readFileLines(root, ref.file);
    if (lines === null) {
      return { ...ref, excerpt: null, missing: true };
    }
    if (ref.type === 'section') {
      const { excerpt, excerptStart, excerptEnd } = sectionExcerpt(lines, ref.line, excerptLines);
      return { ...ref, excerpt, excerptStart, excerptEnd };
    }
    const { excerpt, excerptStart, excerptEnd } = exampleExcerpt(lines, maxExcerptLines);
    return { ...ref, excerpt, excerptStart, excerptEnd };
  });
  return { query, references: enriched, total: references.length };
}

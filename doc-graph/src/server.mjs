import http from 'node:http';
import { loadGraph } from './indexer.mjs';
import { search, retrieveContext } from './query.mjs';

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function createServer({ root, config, graphPath }) {
  const output = graphPath ?? config.output;
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;

    if (route === '/health') {
      sendJson(res, 200, { ok: true, project: config.project });
      return;
    }

    if (route !== '/search' && route !== '/context') {
      sendJson(res, 404, { error: 'Not found', endpoints: ['/search', '/context', '/health'] });
      return;
    }

    const q = url.searchParams.get('q')?.trim() ?? '';
    if (!q) {
      sendJson(res, 400, { error: 'Missing required query parameter "q"' });
      return;
    }
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    let graph;
    try {
      graph = loadGraph(root, output);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
      return;
    }

    try {
      if (route === '/search') {
        const result = search(graph, q, limit ? { limit } : {});
        sendJson(res, 200, result);
      } else {
        const result = retrieveContext(graph, q, {
          limit: limit ?? 10,
          excerptLines: config.excerptLines,
          maxExcerptLines: config.maxExcerptLines,
          root,
        });
        sendJson(res, 200, result);
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });
}

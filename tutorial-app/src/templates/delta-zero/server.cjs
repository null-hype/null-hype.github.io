// delta-zero lesson preview: Monaco markers, hover, CodeLens and an evidence
// widget over real delta-zero output (thread.pkl + findings.json + evidence).
// Rendering pieces adapted from ../otel-warm-log/server.cjs; no resolver,
// ledger, or grant code is involved. Findings are mapped to markers on their
// real location.line.
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, resolve, sep } = require('node:path');

const host = '0.0.0.0';
const port = Number(process.env.PORT || 4173);
const workspaceRoot = process.cwd();
const monacoRoot = resolve(workspaceRoot, 'node_modules', 'monaco-editor', 'min');
const VERSIONS = ['before', 'repaired'];

function send(response, body, statusCode = 200, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { 'cache-control': 'no-store', 'content-type': contentType });
  response.end(body);
}

function getContentType(filePath) {
  switch (extname(filePath)) {
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.json': case '.map': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.ttf': return 'font/ttf';
    default: return 'application/octet-stream';
  }
}

function isInside(base, target) {
  return target === base || target.startsWith(base + sep);
}

async function serveFile(response, filePath) {
  try {
    const contents = await readFile(filePath);
    response.writeHead(200, { 'cache-control': 'public, max-age=300', 'content-type': getContentType(filePath) });
    response.end(contents);
  } catch (error) {
    send(response, error && error.code === 'ENOENT' ? 'Not found' : 'Unable to load asset', error && error.code === 'ENOENT' ? 404 : 500);
  }
}

// One version of delta-zero's output: the thread, and each finding with the
// text of its evidence file attached.
async function loadVersion(version) {
  const dir = resolve(workspaceRoot, version);
  const thread = await readFile(resolve(dir, 'thread.pkl'), 'utf8');
  const parsed = JSON.parse(await readFile(resolve(dir, 'findings.json'), 'utf8'));
  const findings = [];
  for (const finding of parsed.findings || []) {
    const evidence = [];
    for (const rel of finding.evidence || []) {
      const file = resolve(dir, rel);
      if (!isInside(dir, file)) continue;
      evidence.push({ path: rel, text: await readFile(file, 'utf8') });
    }
    findings.push({ ...finding, evidence });
  }
  return { thread, findings };
}

function renderPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>delta-zero</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; height: 100%; }
      body { display: flex; flex-direction: column; background: #fffdf8; font: 13px system-ui, sans-serif; }
      header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #e5e0d4; }
      header span { color: #5c5648; margin-right: 4px; }
      button.version { font: inherit; padding: 4px 12px; border: 1px solid #b9b2a0; border-radius: 4px; background: #fff; cursor: pointer; }
      button.version[aria-pressed="true"] { background: #1e1e1e; color: #fff; border-color: #1e1e1e; }
      #count { margin-left: auto; color: #5c5648; }
      #monaco-root { flex: 1; min-height: 0; }
    </style>
  </head>
  <body>
    <header>
      <span>summary:</span>
      <button class="version" id="v-before" aria-pressed="true" data-version="before">Before repair</button>
      <button class="version" id="v-repaired" aria-pressed="false" data-version="repaired">Repaired</button>
      <span id="count"></span>
    </header>
    <div id="monaco-root"></div>

    <script>
      const rootEl = document.getElementById('monaco-root');
      const PEEK_COMMAND = 'delta-zero.peekEvidence';
      const WIDGET_ID = 'delta-zero.evidenceWidget';
      const MARKER_OWNER = 'delta-zero';
      let editor = null;
      let model = null;
      let monacoPromise = null;
      let findingsByLine = {};
      let widgetLine = null;
      const cache = {};

      // Evidence widget: a content widget under the finding's line showing
      // the evidence file's text, quoted.
      function buildEvidenceNode(finding) {
        const node = document.createElement('div');
        node.setAttribute('role', 'region');
        node.setAttribute('aria-label', 'Lost text');
        node.style.cssText =
          'background:#1e1e1e;color:#d4d4d4;border:1px solid #454545;border-radius:3px;' +
          'padding:6px 10px;font:12px "Roboto Mono",Menlo,Consolas,monospace;width:560px;max-width:80vw;max-height:300px;overflow:auto;white-space:pre-wrap;';
        finding.evidence.forEach((entry) => {
          const label = document.createElement('div');
          label.textContent = 'lost text, from ' + entry.path + ':';
          label.style.cssText = 'color:#9cdcfe;padding-bottom:2px;';
          const quote = document.createElement('div');
          quote.textContent = '> ' + entry.text.replace(/\\n/g, '\\n> ');
          quote.style.cssText = 'border-left:3px solid #569cd6;padding-left:8px;';
          node.appendChild(label);
          node.appendChild(quote);
        });
        return node;
      }

      function clearWidget() {
        if (widgetLine !== null && editor) {
          editor.removeContentWidget({ getId: () => WIDGET_ID });
        }
        widgetLine = null;
      }

      function toggleWidget(lineNumber, finding) {
        const same = widgetLine === lineNumber;
        clearWidget();
        if (same) return;
        const domNode = buildEvidenceNode(finding);
        editor.addContentWidget({
          getId: () => WIDGET_ID,
          getDomNode: () => domNode,
          getPosition: () => ({
            position: { lineNumber, column: 1 },
            preference: [window.monaco.editor.ContentWidgetPositionPreference.BELOW],
          }),
        });
        widgetLine = lineNumber;
      }

      // The finding's message reads: message 3 (user) dropped prose: "quoted..."
      // The lens keeps the part before the quote.
      function lensTitle(finding) {
        return finding.message.replace(/:\\s*".*$/s, '');
      }

      function loadMonaco() {
        if (monacoPromise) return monacoPromise;
        monacoPromise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/monaco/vs/loader.js';
          script.onload = () => configure(window.require, resolve, reject);
          script.onerror = () => reject(new Error('Failed to load Monaco assets'));
          document.head.appendChild(script);
        });
        return monacoPromise;
      }

      function configure(requireFn, resolve, reject) {
        requireFn.config({ paths: { vs: '/monaco/vs' } });
        requireFn(['vs/editor/editor.main'], () => {
          const monaco = window.monaco;
          const languageId = 'pkl';

          monaco.languages.register({ id: languageId });
          monaco.languages.setLanguageConfiguration(languageId, {
            comments: { lineComment: '//' },
            brackets: [['{', '}']],
          });
          // Small Monarch tokenizer for Pkl: comments, raw multi-line
          // strings (#"""..."""#), strings, keywords, numbers.
          monaco.languages.setMonarchTokensProvider(languageId, {
            keywords: ['amends', 'new', 'module', 'class', 'local', 'typealias', 'function', 'import', 'extends', 'open', 'hidden'],
            tokenizer: {
              root: [
                [/\\/\\/.*$/, 'comment'],
                [/#"""/, { token: 'string', next: '@rawBlock' }],
                [/"/, { token: 'string', next: '@string' }],
                [/\\b\\d+\\b/, 'number'],
                [/[a-zA-Z_]\\w*/, { cases: { '@keywords': 'keyword', 'true|false|null': 'keyword', '@default': 'identifier' } }],
              ],
              rawBlock: [
                [/"""#/, { token: 'string', next: '@pop' }],
                [/./, 'string'],
              ],
              string: [
                [/[^\\\\"]+/, 'string'],
                [/\\\\./, 'string.escape'],
                [/"/, { token: 'string', next: '@pop' }],
              ],
            },
          });

          monaco.languages.registerHoverProvider(languageId, {
            provideHover(hoverModel, position) {
              const finding = findingsByLine[position.lineNumber];
              if (!finding) return null;
              const contents = [{ value: '**' + finding.id + '**' }, { value: finding.message }];
              finding.evidence.forEach((entry) => {
                contents.push({ value: '_evidence_ (' + entry.path + '): ' + entry.text.split('\\n')[0].slice(0, 120) });
              });
              return {
                range: new monaco.Range(position.lineNumber, 1, position.lineNumber, hoverModel.getLineMaxColumn(position.lineNumber)),
                contents,
              };
            },
          });

          // Registered once per page load; Monaco throws on a duplicate.
          monaco.editor.registerCommand(PEEK_COMMAND, (_accessor, lineNumber) => {
            const finding = findingsByLine[lineNumber];
            if (!editor || !finding) return;
            editor.setPosition({ column: 1, lineNumber });
            toggleWidget(lineNumber, finding);
          });

          monaco.languages.registerCodeLensProvider(languageId, {
            onDidChange: lensEmitter.event,
            provideCodeLenses() {
              const lenses = Object.keys(findingsByLine).map((key) => {
                const lineNumber = Number(key);
                const finding = findingsByLine[key];
                return {
                  range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                  command: {
                    id: PEEK_COMMAND,
                    title: lensTitle(finding) + ' \\u00b7 ' + finding.evidence.length + ' related',
                    arguments: [lineNumber],
                  },
                };
              });
              return { lenses, dispose() {} };
            },
          });
          resolve(monaco);
        }, reject);
      }

      const lensEmitter = { _l: [], event(listener) { this._l.push(listener); return { dispose() {} }; }, fire() { this._l.forEach((l) => l(this)); } };

      async function ensureEditor() {
        const monaco = await loadMonaco();
        if (editor) return;
        rootEl.textContent = '';
        model = monaco.editor.createModel('', 'pkl');
        editor = monaco.editor.create(rootEl, {
          automaticLayout: true,
          fontFamily: '"Roboto Mono", "SFMono-Regular", Menlo, Consolas, monospace',
          fontSize: 13,
          glyphMargin: true,
          lineNumbers: 'on',
          minimap: { enabled: false },
          model,
          padding: { top: 16, bottom: 24 },
          readOnly: true,
          renderLineHighlight: 'none',
          scrollBeyondLastLine: false,
          stickyScroll: { enabled: false },
          theme: 'vs',
          wordWrap: 'on',
        });
      }

      async function show(version) {
        if (!cache[version]) {
          const response = await fetch('/__dz/' + version, { cache: 'no-store' });
          if (!response.ok) throw new Error('Failed to load ' + version);
          cache[version] = await response.json();
        }
        const data = cache[version];
        await ensureEditor();
        clearWidget();
        findingsByLine = {};
        const markers = [];
        data.findings.forEach((finding) => {
          const line = finding.location.line;
          findingsByLine[line] = finding;
          const content = data.thread.split('\\n')[line - 1] || '';
          markers.push({
            startLineNumber: line,
            startColumn: finding.location.column || 1,
            endLineNumber: line,
            endColumn: Math.max(2, content.length + 1),
            severity: window.monaco.MarkerSeverity.Info,
            message: finding.message,
            code: finding.id,
            source: 'delta-zero',
          });
        });
        if (model.getValue() !== data.thread) model.setValue(data.thread);
        window.monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
        lensEmitter.fire();
        document.getElementById('count').textContent =
          data.findings.length + (data.findings.length === 1 ? ' loss' : ' losses') + ' reported';
        document.querySelectorAll('button.version').forEach((b) =>
          b.setAttribute('aria-pressed', String(b.dataset.version === version)));
      }

      document.querySelectorAll('button.version').forEach((b) =>
        b.addEventListener('click', () => show(b.dataset.version).catch((e) => { rootEl.textContent = String(e); })));
      window.addEventListener('beforeunload', () => { editor && editor.dispose(); model && model.dispose(); });
      show('before').catch((e) => { rootEl.textContent = String(e); });
    </script>
  </body>
</html>`;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');

  const match = url.pathname.match(/^\/__dz\/(before|repaired)$/);
  if (match && VERSIONS.includes(match[1])) {
    try {
      send(response, JSON.stringify(await loadVersion(match[1])), 200, 'application/json; charset=utf-8');
    } catch (error) {
      send(response, 'Unable to load delta-zero output', 500);
    }
    return;
  }

  if (url.pathname.startsWith('/monaco/')) {
    const assetPath = resolve(monacoRoot, decodeURIComponent(url.pathname.slice('/monaco/'.length)));
    if (!isInside(monacoRoot, assetPath)) {
      send(response, 'Invalid asset path', 403);
      return;
    }
    await serveFile(response, assetPath);
    return;
  }

  send(response, renderPage(), 200, 'text/html; charset=utf-8');
});

server.listen(port, host, () => {
  console.log('delta-zero preview listening on http://%s:%d', host, port);
});

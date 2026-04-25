const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, resolve, sep } = require('node:path');

const host = '0.0.0.0';
const port = Number(process.env.PORT || 4173);
const workspaceRoot = process.cwd();
const monacoRoot = resolve(workspaceRoot, 'node_modules', 'monaco-editor', 'min');

function sendText(response, body, statusCode = 200, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': contentType,
  });
  response.end(body);
}

function getContentType(filePath) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.ttf':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
}

function isInside(basePath, targetPath) {
  return targetPath === basePath || targetPath.startsWith(`${basePath}${sep}`);
}

async function serveFile(response, filePath) {
  try {
    const fileContents = await readFile(filePath);

    response.writeHead(200, {
      'cache-control': 'public, max-age=300',
      'content-type': getContentType(filePath),
    });
    response.end(fileContents);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      sendText(response, 'Not found', 404);
      return;
    }

    sendText(response, 'Unable to load asset', 500);
  }
}

function resolveWorkspaceFile(requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return null;
  }

  const normalizedPath = requestedPath.startsWith('/') ? `.${requestedPath}` : requestedPath;
  const filePath = resolve(workspaceRoot, normalizedPath);

  if (!isInside(workspaceRoot, filePath)) {
    return null;
  }

  return filePath;
}

async function serveJsonFile(response, requestedPath) {
  const filePath = resolveWorkspaceFile(requestedPath);

  if (!filePath) {
    sendText(response, 'Invalid file path', 403);
    return;
  }

  try {
    const fileContents = await readFile(filePath, 'utf8');
    JSON.parse(fileContents);
    sendText(response, fileContents, 200, 'application/json; charset=utf-8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      sendText(response, 'Not found', 404);
      return;
    }

    sendText(response, 'Unable to load story', 500);
  }
}

function renderPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OTel Warm Log Template</title>
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
      }

      body {
        overflow: hidden;
        background: #fffdf8;
      }

      main {
        width: 100vw;
        height: 100vh;
      }

      #monaco-root {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <main>
      <div id="monaco-root"></div>
    </main>

    <script>
      const monacoRootEl = document.getElementById('monaco-root');
      const fallbackStory = {
        blocked: {
          title: 'trace otel.opentrader.place_order blocked',
          lines: ['note: solve the grammar rule to replay the warm log'],
        },
        scenario: 'opentrader-idor',
        trace: {
          lines: [
            'actor: alice',
            'objective: place an order under bob\\'s user_id',
            'result: anomaly detected',
          ],
          spans: [],
          title: 'trace otel.opentrader.place_order -> anomaly',
        },
      };
      const fallbackLoanwordStory = {
        scenario: 'fingerspitzengefuhl-preservation',
        states: {
          idle: {
            lines: ['note: type an English attempt in translation.en'],
            spans: [],
            title: 'trace lexeme.fingerspitzengefuhl.translation idle',
          },
          'loanword-pending-admission': {
            lines: [
              'source.lexeme: Schadenfreude',
              'attempt.en: Schadenfreude',
              'result: preserved surface still requires PersonalVocabulary.pkl admission',
            ],
            spans: [],
            title: 'loanword(Schadenfreude) -> pending admission',
          },
          'paraphrase-loss': {
            lines: [
              'source.lexeme: Fingerspitzengefühl',
              'attempt.en: tact',
              'result: paraphrase loses required structure before it reaches English',
            ],
            spans: [],
            title: 'trace lexeme.fingerspitzengefuhl.translation -> loss',
          },
          completed: {
            lines: [
              'status: translation.en preserved source surface',
              'surface: Fingerspitzengefühl',
              'move: you solved this by preserving the word, not paraphrasing it',
            ],
            spans: [],
            title: 'loanword(Fingerspitzengefühl) -> preserved',
          },
        },
      };

      let editor = null;
      let model = null;
      let monacoPromise = null;
      let editorPromise = null;
      let currentRevision = null;
      let currentState = null;
      let storyCache = new Map();

      function loadMonaco() {
        if (monacoPromise) {
          return monacoPromise;
        }

        monacoPromise = new Promise((resolve, reject) => {
          if (window.monaco && window.require) {
            configureMonaco(window.require, resolve, reject);
            return;
          }

          const script = document.createElement('script');
          script.src = '/monaco/vs/loader.js';
          script.onload = () => configureMonaco(window.require, resolve, reject);
          script.onerror = () => reject(new Error('Failed to load Monaco assets'));
          document.head.appendChild(script);
        });

        return monacoPromise;
      }

      function configureMonaco(requireFn, resolve, reject) {
        requireFn.config({ paths: { vs: '/monaco/vs' } });
        requireFn(['vs/editor/editor.main'], () => {
          const monaco = window.monaco;
          const languageId = 'otel-warm-log';

          monaco.languages.register({ id: languageId });
          monaco.languages.setLanguageConfiguration(languageId, {
            comments: {
              lineComment: '#',
            },
          });
          monaco.languages.setMonarchTokensProvider(languageId, {
            tokenizer: {
              root: [
                [/^#region.*$/, 'keyword'],
                [/^#endregion.*$/, 'keyword'],
                [/^(actor|objective|result|service.name|http.route|enduser.id|request.body.user_id|persistence.user_id|action|status|severity|summary|source.lexeme|attempt.en|effect|move|surface|adoptedAs):/, 'type'],
                [/\b(trace|span|rule|anomaly|loanword)\b/, 'keyword'],
              ],
            },
          });
          monaco.languages.registerFoldingRangeProvider(languageId, {
            provideFoldingRanges(model) {
              const ranges = [];
              const stack = [];

              for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
                const line = model.getLineContent(lineNumber).trim();

                if (line.startsWith('#region')) {
                  stack.push(lineNumber);
                } else if (line.startsWith('#endregion')) {
                  const start = stack.pop();

                  if (start) {
                    ranges.push({
                      end: lineNumber,
                      kind: monaco.languages.FoldingRangeKind.Region,
                      start,
                    });
                  }
                }
              }

              return ranges;
            },
          });

          resolve(monaco);
        }, reject);
      }

      async function ensureEditor() {
        if (!monacoRootEl) {
          return;
        }

        if (editor) {
          return;
        }

        if (!editorPromise) {
          editorPromise = (async () => {
            const monaco = await loadMonaco();

            if (editor) {
              return;
            }

            monacoRootEl.textContent = '';
            model = monaco.editor.createModel(renderTrace().text, 'otel-warm-log');
            editor = monaco.editor.create(monacoRootEl, {
              automaticLayout: true,
              folding: true,
              fontFamily: '"Roboto Mono", "SFMono-Regular", Menlo, Consolas, monospace',
              fontSize: 13,
              glyphMargin: true,
              lineDecorationsWidth: 12,
              lineNumbers: 'on',
              lineNumbersMinChars: 2,
              minimap: { enabled: false },
              model,
              padding: { top: 16, bottom: 24 },
              readOnly: true,
              renderLineHighlight: 'none',
              scrollBeyondLastLine: false,
              showFoldingControls: 'always',
              stickyScroll: { enabled: false },
              theme: 'vs',
              wordWrap: 'on',
            });
          })();
        }

        await editorPromise;
      }

      async function loadStory(storyFile, fallback) {
        const filePath = storyFile || '/trace-story.json';

        if (storyCache.has(filePath)) {
          return storyCache.get(filePath);
        }

        try {
          const response = await fetch('/__tk/file?path=' + encodeURIComponent(filePath), {
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error('Failed to fetch story');
          }

          const story = await response.json();
          storyCache.set(filePath, story);
          return story;
        } catch (_error) {
          storyCache.set(filePath, fallback);
          return fallback;
        }
      }

      function getPreviewMode(payload) {
        return payload && payload.previewMode === 'static-log-with-completion'
          ? 'static-log-with-completion'
          : 'blocked-until-valid';
      }

      function getFallbackForMode(previewMode) {
        return previewMode === 'static-log-with-completion' ? fallbackLoanwordStory : fallbackStory;
      }

      async function applyLessonState(payload) {
        const previewMode = getPreviewMode(payload);
        const revision =
          payload && typeof payload.revision === 'number' ? payload.revision : Date.now();
        const solved =
          payload && typeof payload.solved === 'boolean'
            ? payload.solved
            : Boolean(payload && payload.valid);
        const fallback = getFallbackForMode(previewMode);
        currentRevision = revision;

        const nextState = {
          previewMode,
          previewState:
            payload && typeof payload.previewState === 'string'
              ? payload.previewState
              : solved
                ? 'completed'
                : 'idle',
          scenario: payload && payload.scenario ? payload.scenario : fallback.scenario,
          solved,
          story: null,
          storyFile:
            payload && payload.storyFile
              ? payload.storyFile
              : previewMode === 'static-log-with-completion'
                ? '/warm-log-story.json'
                : '/trace-story.json',
          summary:
            payload && payload.summary
              ? payload.summary
              : getFallbackSummary(previewMode, fallback, solved),
        };

        if (previewMode === 'static-log-with-completion' || solved) {
          nextState.story = await loadStory(nextState.storyFile, fallback);
        }

        if (currentRevision !== revision) {
          return;
        }

        currentState = nextState;
        await renderIntoEditor();
      }

      function renderTrace() {
        if (!currentState) {
          return {
            collapsedLines: [],
            text: [
              '#region ' + fallbackStory.blocked.title,
              ...fallbackStory.blocked.lines.map((line) => '  ' + line),
              '#endregion',
            ].join('\\n'),
          };
        }

        const previewMode = currentState.previewMode || 'blocked-until-valid';
        const fallback = getFallbackForMode(previewMode);
        const story = currentState.story || fallback;

        if (currentState.scenario && story.scenario && currentState.scenario !== story.scenario) {
          return {
            collapsedLines: [],
            text: [
              '#region scenario mismatch',
              '  note: preview scenario does not match the requested lesson state',
              '#endregion',
            ].join('\\n'),
          };
        }

        if (previewMode === 'static-log-with-completion') {
          const node = getStaticNode(story, fallback, currentState.previewState, currentState.solved);
          const lines = [];
          const collapsedLines = [];
          renderNode(node, 0, lines, collapsedLines);
          return {
            collapsedLines,
            text: lines.join('\\n'),
          };
        }

        if (!currentState.solved) {
          const blocked = story.blocked || fallback.blocked;
          return {
            collapsedLines: [],
            text: [
              '#region ' + blocked.title,
              ...blocked.lines.map((line) => '  ' + line),
              '#endregion',
            ].join('\\n'),
          };
        }

        const lines = [];
        const collapsedLines = [];
        renderNode(story.trace || fallback.trace, 0, lines, collapsedLines);
        return {
          collapsedLines,
          text: lines.join('\\n'),
        };
      }

      function getFallbackSummary(previewMode, fallback, solved) {
        if (previewMode === 'static-log-with-completion') {
          const states = fallback.states || {};
          const node = solved ? states.completed : states['paraphrase-loss'] || states.idle;
          return node ? node.title : 'loanword lesson';
        }

        return solved ? fallback.trace.title : fallback.blocked.title;
      }

      function getStaticNode(story, fallback, previewState, solved) {
        if (story.states || fallback.states) {
          const storyStates = story.states || {};
          const fallbackStates = fallback.states || {};
          const stateKey = previewState || (solved ? 'completed' : 'idle');

          return (
            storyStates[stateKey] ||
            fallbackStates[stateKey] ||
            (solved ? storyStates.completed || fallbackStates.completed : undefined) ||
            storyStates['paraphrase-loss'] ||
            fallbackStates['paraphrase-loss'] ||
            storyStates.idle ||
            fallbackStates.idle
          );
        }

        return solved ? story.completion || fallback.completion : story.log || fallback.log;
      }

      function renderNode(node, depth, lines, collapsedLines) {
        const indent = '  '.repeat(depth);
        const startLine = lines.length + 1;
        lines.push(indent + '#region ' + node.title);

        if (node.startsCollapsed) {
          collapsedLines.push(startLine);
        }

        for (const line of node.lines || []) {
          lines.push(indent + '  ' + line);
        }

        for (const child of node.spans || []) {
          renderNode(child, depth + 1, lines, collapsedLines);
        }

        lines.push(indent + '#endregion');
      }

      async function applyCollapsedLines(lineNumbers) {
        if (!editor || !lineNumbers.length) {
          return;
        }

        const unfoldAll = editor.getAction('editor.unfoldAll');

        if (unfoldAll) {
          try {
            await unfoldAll.run();
          } catch (_error) {
            // Ignore missing unfold support in Monaco internals.
          }
        }

        for (const lineNumber of lineNumbers) {
          editor.setPosition({ column: 1, lineNumber });
          editor.revealLineInCenterIfOutsideViewport(lineNumber);

          const fold = editor.getAction('editor.fold');

          if (fold) {
            try {
              await fold.run();
            } catch (_error) {
              // Ignore missing fold support in Monaco internals.
            }
          }
        }

        editor.setPosition({ column: 1, lineNumber: 1 });
        editor.revealLine(1);
      }

      async function renderIntoEditor() {
        await ensureEditor();

        if (!model) {
          return;
        }

        const rendered = renderTrace();
        const nextValue = rendered.text;
        const changed = model.getValue() !== nextValue;

        if (changed) {
          model.setValue(nextValue);
        }

        if (editor && changed && rendered.collapsedLines.length > 0) {
          window.setTimeout(() => {
            applyCollapsedLines(rendered.collapsedLines).catch(() => {});
          }, 0);
        }
      }

      function onMessage(event) {
        const message = event.data;

        if (
          !message ||
          message.type !== 'lesson-state' ||
          !['tk-loanword-arc-bridge', 'tk-rule-trace-bridge'].includes(message.source)
        ) {
          return;
        }

        const payload = message.payload;

        if (!payload || typeof payload !== 'object') {
          return;
        }

        if (
          typeof payload.revision === 'number' &&
          typeof currentRevision === 'number' &&
          payload.revision <= currentRevision
        ) {
          return;
        }

        applyLessonState(payload).catch((error) => {
          if (model) {
            model.setValue(String(error));
          }
        });
      }

      window.addEventListener('message', onMessage);
      window.addEventListener('beforeunload', () => {
        editor?.dispose();
        model?.dispose();
        editorPromise = null;
      });

      currentState = {
        previewMode: 'blocked-until-valid',
        scenario: fallbackStory.scenario,
        solved: false,
        story: null,
        storyFile: '/trace-story.json',
        summary: fallbackStory.blocked.title,
      };
      renderIntoEditor().catch(() => {});
    </script>
  </body>
</html>`;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');

  if (url.pathname === '/__tk/file') {
    await serveJsonFile(response, url.searchParams.get('path'));
    return;
  }

  if (url.pathname.startsWith('/monaco/')) {
    const relativePath = decodeURIComponent(url.pathname.slice('/monaco/'.length));
    const assetPath = resolve(monacoRoot, relativePath);

    if (!isInside(monacoRoot, assetPath)) {
      sendText(response, 'Invalid asset path', 403);
      return;
    }

    await serveFile(response, assetPath);
    return;
  }

  sendText(response, renderPage(), 200, 'text/html; charset=utf-8');
});

server.listen(port, host, () => {
  console.log('otel-warm-log preview listening on http://%s:%d', host, port);
});

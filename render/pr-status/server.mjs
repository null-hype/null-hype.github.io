import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const port = Number.parseInt(process.env.PORT ?? '10000', 10);
const repoRoot = process.cwd();
const renderDir = path.join(repoRoot, '.render');
const logPath = path.join(renderDir, 'pr-pipeline.log');
const daggerPath = process.env.DAGGER_BIN ?? path.join(renderDir, 'bin', 'dagger');

const pipelineDefinitions = {
  plan: {
    description: 'Non-mutating Terraform plan for PR review.',
    requiredEnv: [
      'CLOUDFLARE_API_TOKEN',
      'SSH_PUBLIC_KEY',
      'BACKEND_BUCKET',
      'BACKEND_PREFIX',
      'GCP_PROJECT',
      'CLOUDFLARE_ZONE_ID',
    ],
    buildArgs: () => [
      'call',
      '-m',
      './infra',
      'plan',
      '--src=.',
      ...secretArg('gcp-credentials', 'GCP_CREDENTIALS'),
      ...secretArg('cloudflare-token', 'CLOUDFLARE_API_TOKEN'),
      ...secretArg('ssh-public-key', 'SSH_PUBLIC_KEY'),
      `--backend-bucket=${process.env.BACKEND_BUCKET}`,
      `--backend-prefix=${process.env.BACKEND_PREFIX}`,
      `--gcp-project=${process.env.GCP_PROJECT}`,
      `--cloudflare-zone-id=${process.env.CLOUDFLARE_ZONE_ID}`,
      `--gcp-zone=${process.env.GCP_ZONE ?? 'us-central1-a'}`,
      `--domain=${process.env.DOMAIN ?? 'tidelands.dev'}`,
      `--instance-name=${process.env.INSTANCE_NAME ?? 'tidelane-smallweb'}`,
    ],
  },
  check: {
    description: 'Ephemeral Terratest-backed check run.',
    requiredEnv: [
      'CLOUDFLARE_API_TOKEN',
      'GCP_PROJECT',
    ],
    buildArgs: () => [
      'call',
      '-m',
      './infra',
      'check',
      '--src=.',
      ...secretArg('gcp-credentials', 'GCP_CREDENTIALS'),
      ...secretArg('cloudflare-token', 'CLOUDFLARE_API_TOKEN'),
      `--gcp-project=${process.env.GCP_PROJECT}`,
      `--preserve-on-failure=${process.env.PRESERVE_ON_FAILURE ?? 'false'}`,
    ],
  },
  verify: {
    description: 'External smoke verification against the configured domain.',
    requiredEnv: [],
    buildArgs: () => [
      'call',
      '-m',
      './infra',
      'verify',
      `--domain=${process.env.DOMAIN ?? 'tidelands.dev'}`,
    ],
  },
};

const requestedFunction = process.env.DAGGER_FUNCTION ?? 'plan';
const effectiveFunction = pipelineDefinitions[requestedFunction] ? requestedFunction : 'plan';
const pipeline = pipelineDefinitions[effectiveFunction];

const state = {
  startedAt: new Date().toISOString(),
  finishedAt: null,
  status: 'pending',
  summary: 'Waiting to start.',
  command: '',
  missingEnv: [],
  logs: '',
  exitCode: null,
};

void initialize();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  if (url.pathname === '/status.json') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(publicState(), null, 2));
    return;
  }

  if (url.pathname === '/logs.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(state.logs || 'No logs captured yet.\n');
    return;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(renderHtml());
});

server.on('error', async (error) => {
  appendLog(`\n[server-error] ${error.message}\n`);
  state.status = 'failed';
  state.summary = `HTTP server failed to start: ${error.message}`;
  state.finishedAt = new Date().toISOString();
  await persistLog();
  process.exitCode = 1;
});

server.listen(port, '0.0.0.0');

async function initialize() {
  await mkdir(renderDir, { recursive: true });
  await persistLog();

  if (!existsSync(daggerPath)) {
    state.status = 'blocked';
    state.summary = `Dagger CLI not found at ${daggerPath}.`;
    await persistLog();
    return;
  }

  state.missingEnv = pipeline.requiredEnv.filter((name) => !process.env[name]);
  state.command = [daggerPath, ...pipeline.buildArgs()].join(' ');

  if (state.missingEnv.length > 0) {
    state.status = 'blocked';
    state.summary = `Missing required env vars: ${state.missingEnv.join(', ')}`;
    await persistLog();
    return;
  }

  state.status = 'running';
  state.summary = `Running Dagger ${effectiveFunction}.`;
  await persistLog();
  await runPipeline();
}

function runPipeline() {
  return new Promise((resolve) => {
    const child = spawn(daggerPath, pipeline.buildArgs(), {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => appendLog(chunk));
    child.stderr.on('data', (chunk) => appendLog(chunk));

    child.on('error', async (error) => {
      appendLog(`\n[runner-error] ${error.message}\n`);
      state.status = 'failed';
      state.summary = `Runner failed before execution: ${error.message}`;
      state.finishedAt = new Date().toISOString();
      await persistLog();
      resolve();
    });

    child.on('close', async (code) => {
      state.exitCode = code;
      state.finishedAt = new Date().toISOString();
      state.status = code === 0 ? 'passed' : 'failed';
      state.summary = code === 0
        ? `Dagger ${effectiveFunction} completed successfully.`
        : `Dagger ${effectiveFunction} failed with exit code ${code}.`;
      await persistLog();
      resolve();
    });
  });
}

function appendLog(chunk) {
  state.logs += chunk.toString();
  if (state.logs.length > 200_000) {
    state.logs = state.logs.slice(-200_000);
  }
  void persistLog();
}

async function persistLog() {
  await writeFile(logPath, state.logs, 'utf8');
}

function publicState() {
  return {
    branch: process.env.RENDER_GIT_BRANCH ?? process.env.RENDER_GIT_COMMIT ?? 'unknown',
    commit: process.env.RENDER_GIT_COMMIT ?? 'unknown',
    pullRequestId: process.env.RENDER_PULL_REQUEST_ID ?? null,
    service: process.env.RENDER_SERVICE_NAME ?? 'render-pr-status',
    function: effectiveFunction,
    requestedFunction,
    description: pipeline.description,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    status: state.status,
    summary: state.summary,
    exitCode: state.exitCode,
    command: state.command,
    missingEnv: state.missingEnv,
    logPath,
  };
}

function renderHtml() {
  const data = publicState();
  const logs = escapeHtml(state.logs || 'No logs captured yet.');
  const missingEnv = data.missingEnv.length > 0
    ? `<p><strong>Missing env:</strong> ${escapeHtml(data.missingEnv.join(', '))}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="15" />
    <title>PR Pipeline Status</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe6;
        --panel: #fffaf0;
        --ink: #1d1a16;
        --muted: #6c6255;
        --border: #d5c5ae;
        --accent: #9c4a2d;
        --passed: #2f6b46;
        --failed: #9a2b2b;
        --running: #8f5d12;
        --blocked: #5b4ca1;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(156, 74, 45, 0.14), transparent 28%),
          linear-gradient(180deg, #f6f1e6 0%, var(--bg) 100%);
        color: var(--ink);
        font: 16px/1.5 Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 980px;
        margin: 0 auto;
        padding: 40px 20px 64px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(2.5rem, 6vw, 4.5rem);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }
      .eyebrow {
        margin: 0 0 14px;
        color: var(--accent);
        font: 700 0.8rem/1.2 "Courier New", monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .panel {
        background: color-mix(in srgb, var(--panel) 92%, white 8%);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 18px 40px rgba(61, 42, 23, 0.08);
      }
      .status {
        display: inline-block;
        margin-bottom: 14px;
        padding: 6px 10px;
        border-radius: 999px;
        font: 700 0.78rem/1 "Courier New", monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: white;
      }
      .status-passed { background: var(--passed); }
      .status-failed { background: var(--failed); }
      .status-running { background: var(--running); }
      .status-blocked { background: var(--blocked); }
      .status-pending { background: var(--muted); }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 6px 14px;
        margin: 16px 0 0;
      }
      dt {
        font-weight: 700;
        color: var(--muted);
      }
      dd {
        margin: 0;
        word-break: break-word;
      }
      pre {
        margin: 24px 0 0;
        padding: 18px;
        overflow: auto;
        border-radius: 16px;
        border: 1px solid #2f2417;
        background: #18120d;
        color: #f4ebdd;
        font: 0.88rem/1.45 "SFMono-Regular", Consolas, monospace;
      }
      a { color: var(--accent); }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Render PR Pipeline</p>
      <h1>${escapeHtml(data.function)}</h1>
      <section class="panel">
        <span class="status status-${escapeHtml(data.status)}">${escapeHtml(data.status)}</span>
        <p>${escapeHtml(data.summary)}</p>
        <p>${escapeHtml(data.description)}</p>
        ${missingEnv}
        <dl>
          <dt>Service</dt><dd>${escapeHtml(data.service)}</dd>
          <dt>Branch</dt><dd>${escapeHtml(data.branch)}</dd>
          <dt>Commit</dt><dd>${escapeHtml(data.commit)}</dd>
          <dt>PR</dt><dd>${escapeHtml(data.pullRequestId ?? 'n/a')}</dd>
          <dt>Started</dt><dd>${escapeHtml(data.startedAt)}</dd>
          <dt>Finished</dt><dd>${escapeHtml(data.finishedAt ?? 'still running')}</dd>
          <dt>Exit Code</dt><dd>${escapeHtml(String(data.exitCode ?? 'n/a'))}</dd>
          <dt>Command</dt><dd>${escapeHtml(data.command || 'n/a')}</dd>
        </dl>
        <p><a href="/status.json">JSON</a> · <a href="/logs.txt">Plain logs</a></p>
        <pre>${logs}</pre>
      </section>
    </main>
  </body>
</html>`;
}

function secretArg(flag, envName) {
  if (!process.env[envName]) {
    return [];
  }

  return [`--${flag}=env:${envName}`];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

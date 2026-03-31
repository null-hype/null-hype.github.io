import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sidecarDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(sidecarDir, "..", "..");
const port = Number.parseInt(process.env.PORT ?? "7788", 10);
const daggerBin = path.join(repoRoot, ".render", "bin", "dagger");
const moduleRef = "./spikes/dagger-deno-upgrade";

function json(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(`${JSON.stringify(data, null, 2)}\n`);
}

function runDaggerProbe() {
  return new Promise((resolve, reject) => {
    const args = [
      "-s",
      "call",
      "-m",
      moduleRef,
      "container-echo",
      "--string-arg=sidecar-ok",
      "stdout",
    ];

    const child = spawn(daggerBin, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        DAGGER_NO_NAG: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          via: "sidecar",
          output: stdout.trim(),
          command: [daggerBin, ...args].join(" "),
        });
        return;
      }

      reject(new Error(`dagger exited with code ${code}\n${stderr.trim()}`));
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/healthz") {
    json(res, 200, {
      ok: true,
      service: "dagger-verify-sidecar",
      repoRoot,
      moduleRef,
    });
    return;
  }

  if (url.pathname !== "/verify") {
    json(res, 404, {
      ok: false,
      message: "not found",
    });
    return;
  }

  const startedAt = new Date().toISOString();

  try {
    const result = await runDaggerProbe();
    json(res, 200, {
      ...result,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    json(res, 500, {
      ok: false,
      via: "sidecar",
      startedAt,
      finishedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`dagger verify sidecar listening on http://127.0.0.1:${port}`);
});

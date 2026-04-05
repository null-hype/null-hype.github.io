#!/usr/bin/env node

import { createSign } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { execFileSync, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, "../..")
const DEFAULT_ENV_FILES = [
  resolve(REPO_ROOT, ".env"),
  resolve(REPO_ROOT, "infra/.env"),
]

if (process.env.NULL_HYPE_ENV_FILES) {
  for (const entry of process.env.NULL_HYPE_ENV_FILES.split(":")) {
    if (!entry) {
      continue
    }
    DEFAULT_ENV_FILES.push(entry.startsWith("/") ? entry : resolve(REPO_ROOT, entry))
  }
}

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {}
  }

  const env = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue
    }

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) {
      continue
    }

    let [, key, value] = match
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }

  return env
}

function loadEnv() {
  const merged = { ...process.env }
  for (const path of DEFAULT_ENV_FILES) {
    Object.assign(merged, parseEnvFile(path))
  }

  if (!merged.CLOUDFLARE_API_TOKEN && merged.CLOUDFLARE_API_KEY) {
    merged.CLOUDFLARE_API_TOKEN = merged.CLOUDFLARE_API_KEY
  }
  delete merged.CLOUDFLARE_API_KEY
  delete merged.CLOUDFLARE_EMAIL

  if (!merged.GCP_PROJECT && merged.PROJECT_ID) {
    merged.GCP_PROJECT = merged.PROJECT_ID
  }
  if (!merged.BACKEND_BUCKET && merged.BUCKET) {
    merged.BACKEND_BUCKET = merged.BUCKET
  }
  if (!merged.BACKEND_PREFIX_ROOT) {
    if (merged.BACKEND_PREFIX) {
      merged.BACKEND_PREFIX_ROOT = merged.BACKEND_PREFIX.replace(/\/terraform\.tfstate$/, "")
    } else {
      merged.BACKEND_PREFIX_ROOT = "tidelands-dev"
    }
  }

  merged.GCP_ZONE ||= "us-central1-a"
  merged.DOMAIN ||= "tidelands.dev"
  merged.INSTANCE_NAME ||= "tidelane-smallweb"
  merged.MUTAGEN_REMOTE_ROOT ||= "/opt/tidelands/smallweb"
  merged.GCP_CREDENTIALS_FILE ||= resolve(REPO_ROOT, "infra/tidelanes-deploy.json")

  const defaultKeyPath = join(homedir(), ".ssh", "null_hype_render_plan_key")
  merged.SSH_PRIVATE_KEY_FILE ||= defaultKeyPath
  merged.SSH_PUBLIC_KEY_FILE ||= `${merged.SSH_PRIVATE_KEY_FILE}.pub`

  merged.PATH = `${resolve(REPO_ROOT, ".tools/bin")}:${merged.PATH ?? ""}`
  return merged
}

function requireEnv(env, name) {
  const value = env[name]
  if (!value) {
    throw new Error(`missing required env ${name}`)
  }
  return value
}

function ensureSshKey(env) {
  const privateKey = env.SSH_PRIVATE_KEY_FILE
  const publicKey = env.SSH_PUBLIC_KEY_FILE

  mkdirSync(dirname(privateKey), { recursive: true })

  if (!existsSync(privateKey) || !existsSync(publicKey)) {
    run("ssh-keygen", ["-t", "ed25519", "-f", privateKey, "-N", ""], { env, stdio: "inherit" })
  }

  return {
    privateKey,
    publicKey,
    publicKeyValue: readFileSync(publicKey, "utf8").trim(),
  }
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env,
    input: options.input,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  })

  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed${result.stderr ? `\n${result.stderr}` : ""}`)
  }

  return result.stdout ?? ""
}

function decodeMaybeNestedJson(raw) {
  let value = JSON.parse(raw.trim())
  if (typeof value === "string") {
    value = JSON.parse(value)
  }
  return value
}

async function googleAccessToken(env) {
  const credentials = JSON.parse(readFileSync(requireEnv(env, "GCP_CREDENTIALS_FILE"), "utf8"))
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const claim = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: credentials.token_uri ?? "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url")
  const signingInput = `${header}.${claim}`
  const signer = createSign("RSA-SHA256")
  signer.update(signingInput)
  signer.end()
  const signature = signer.sign(credentials.private_key).toString("base64url")
  const assertion = `${signingInput}.${signature}`

  const response = await fetch(credentials.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })

  if (!response.ok) {
    throw new Error(`failed to mint GCP access token: ${response.status} ${await response.text()}`)
  }

  const body = await response.json()
  return body.access_token
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

async function cloudflareRequest(env, method, path, body) {
  const url = `https://api.cloudflare.com/client/v4${path}`
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv(env, "CLOUDFLARE_API_TOKEN")}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`)
  }

  const payload = await response.json()
  if (!payload.success) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(payload.errors)}`)
  }
  return payload.result
}

async function getDnsRecord(env, name) {
  const zoneId = requireEnv(env, "CLOUDFLARE_ZONE_ID")
  const result = await cloudflareRequest(env, "GET", `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`)
  return result[0] ?? null
}

async function upsertDnsRecord(env, { name, content, proxied, ttl }) {
  const zoneId = requireEnv(env, "CLOUDFLARE_ZONE_ID")
  const existing = await getDnsRecord(env, name)
  const body = {
    name,
    type: "A",
    content,
    proxied,
    ttl,
  }

  if (existing) {
    if (
      existing.type === "A" &&
      existing.content === content &&
      existing.proxied === proxied &&
      Number(existing.ttl) === Number(ttl)
    ) {
      return existing
    }
    return cloudflareRequest(env, "PUT", `/zones/${zoneId}/dns_records/${existing.id}`, body)
  }

  return cloudflareRequest(env, "POST", `/zones/${zoneId}/dns_records`, body)
}

function terraformEnv(env) {
  return {
    ...env,
    GOOGLE_APPLICATION_CREDENTIALS: requireEnv(env, "GCP_CREDENTIALS_FILE"),
    TF_VAR_cloudflare_api_token: requireEnv(env, "CLOUDFLARE_API_TOKEN"),
    TF_VAR_ssh_public_key: readFileSync(requireEnv(env, "SSH_PUBLIC_KEY_FILE"), "utf8").trim(),
  }
}

function terraformPrefix(env, slot) {
  return `${requireEnv(env, "BACKEND_PREFIX_ROOT").replace(/\/+$/, "")}/${slot}/terraform.tfstate`
}

function terraformVars(env, slot, manageDirectDnsRecords) {
  return [
    `-var=gcp_project_id=${requireEnv(env, "GCP_PROJECT")}`,
    `-var=gcp_zone=${requireEnv(env, "GCP_ZONE")}`,
    `-var=domain=${requireEnv(env, "DOMAIN")}`,
    `-var=cloudflare_zone_id=${requireEnv(env, "CLOUDFLARE_ZONE_ID")}`,
    `-var=instance_name=${requireEnv(env, "INSTANCE_NAME")}`,
    `-var=deployment_slot=${slot}`,
    `-var=manage_direct_dns_records=${manageDirectDnsRecords}`,
  ]
}

function terraformInit(env, slot) {
  run("terraform", [
    "init",
    "-reconfigure",
    `-backend-config=bucket=${requireEnv(env, "BACKEND_BUCKET")}`,
    `-backend-config=prefix=${terraformPrefix(env, slot)}`,
  ], {
    cwd: resolve(REPO_ROOT, "infra/terraform"),
    env: terraformEnv(env),
    stdio: "inherit",
  })
}

function terraformOutputs(env, slot, manageDirectDnsRecords) {
  terraformInit(env, slot)
  const raw = run("terraform", ["output", "-json"], {
    cwd: resolve(REPO_ROOT, "infra/terraform"),
    env: terraformEnv(env),
  })
  return decodeMaybeNestedJson(raw)
}

function terraformDeploy(env, slot, manageDirectDnsRecords) {
  terraformInit(env, slot)
  run("terraform", ["apply", "-auto-approve", ...terraformVars(env, slot, manageDirectDnsRecords)], {
    cwd: resolve(REPO_ROOT, "infra/terraform"),
    env: terraformEnv(env),
    stdio: "inherit",
  })
  return terraformOutputs(env, slot, manageDirectDnsRecords)
}

async function getLegacyBlueInstance(env) {
  const project = requireEnv(env, "GCP_PROJECT")
  const zone = requireEnv(env, "GCP_ZONE")
  const instanceName = env.LEGACY_BLUE_INSTANCE_NAME || env.INSTANCE_NAME
  const token = await googleAccessToken(env)
  return fetchJson(
    `https://compute.googleapis.com/compute/v1/projects/${project}/zones/${zone}/instances/${instanceName}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )
}

async function ensureLegacyBlueSsh(env, ssh) {
  const project = requireEnv(env, "GCP_PROJECT")
  const zone = requireEnv(env, "GCP_ZONE")
  const instanceName = env.LEGACY_BLUE_INSTANCE_NAME || env.INSTANCE_NAME
  const token = await googleAccessToken(env)
  const instance = await getLegacyBlueInstance(env)
  const items = instance.metadata?.items ?? []
  const sshItem = items.find((item) => item.key === "ssh-keys")
  const entries = (sshItem?.value ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)

  const desiredEntry = `smallweb:${ssh.publicKeyValue}`
  if (!entries.includes(desiredEntry)) {
    entries.push(desiredEntry)
  }

  const nextItems = items
    .filter((item) => item.key !== "ssh-keys")
    .concat([{ key: "ssh-keys", value: entries.join("\n") }])

  await fetchJson(
    `https://compute.googleapis.com/compute/v1/projects/${project}/zones/${zone}/instances/${instanceName}/setMetadata`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fingerprint: instance.metadata.fingerprint,
        items: nextItems,
      }),
    },
  )

  return instance
}

function sshArgs(env, target) {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-i",
    requireEnv(env, "SSH_PRIVATE_KEY_FILE"),
    target,
  ]
}

function ensureSshAlias(env, alias, sshConnection) {
  const [user, host] = sshConnection.split("@")
  if (!user || !host) {
    throw new Error(`invalid ssh connection: ${sshConnection}`)
  }

  const sshDir = join(homedir(), ".ssh")
  const configPath = join(sshDir, "config")
  mkdirSync(sshDir, { recursive: true })

  const start = `# BEGIN null-hype ${alias}`
  const end = `# END null-hype ${alias}`
  const block = [
    start,
    `Host ${alias}`,
    `  HostName ${host}`,
    `  User ${user}`,
    `  IdentityFile ${requireEnv(env, "SSH_PRIVATE_KEY_FILE")}`,
    "  BatchMode yes",
    "  StrictHostKeyChecking accept-new",
    end,
    "",
  ].join("\n")

  let current = existsSync(configPath) ? readFileSync(configPath, "utf8") : ""
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, "g")
  if (pattern.test(current)) {
    current = current.replace(pattern, block)
  } else {
    if (current && !current.endsWith("\n")) {
      current += "\n"
    }
    current += block
  }

  writeFileSync(configPath, current)
  return alias
}

function sshAvailable(env, target) {
  const result = spawnSync("ssh", [...sshArgs(env, target), "true"], {
    env,
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "pipe",
  })

  return result.status === 0
}

async function waitForSsh(env, target) {
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    if (sshAvailable(env, target)) {
      return
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 10_000))
  }

  throw new Error(`SSH did not become ready for ${target} within 5 minutes`)
}

function sshRun(env, target, scriptPath, args = []) {
  const script = readFileSync(scriptPath, "utf8")
  const result = spawnSync("ssh", [...sshArgs(env, target), "bash", "-s", "--", ...args], {
    cwd: REPO_ROOT,
    env,
    input: script,
    encoding: "utf8",
    stdio: "pipe",
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  if (result.status !== 0) {
    throw new Error(`ssh ${target} bootstrap failed`)
  }
}

function syncBundleToSlot(env, destination, slot) {
  run(resolve(REPO_ROOT, "infra/scripts/start-smallweb-mutagen-sync.sh"), [], {
    env: {
      ...env,
      DEPLOYMENT_SLOT: slot,
      MANAGE_DIRECT_DNS_RECORDS: "0",
      MUTAGEN_DESTINATION: destination,
      MUTAGEN_SESSION_NAME: `tidelands-smallweb-${slot}`,
      MUTAGEN_RESET: "1",
      SMALLWEB_ADDITIONAL_DOMAINS: slot === "green" ? `green-origin.${env.DOMAIN}` : "",
    },
    stdio: "inherit",
  })
}

function curlSuccess(url) {
  try {
    run("curl", ["-fsS", "--max-time", "20", url], { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

async function waitForCandidate(url) {
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    if (curlSuccess(url)) {
      return
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 10_000))
  }
  throw new Error(`candidate did not become healthy at ${url} within 5 minutes`)
}

async function slotInfo(env, slot) {
  if (slot === "blue") {
    const instance = await getLegacyBlueInstance(env)
    return {
      slot,
      instanceName: instance.name,
      ip: instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP,
      originHost: `blue-origin.${env.DOMAIN}`,
      sshConnection: `smallweb@${instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP}`,
    }
  }

  const outputs = terraformOutputs(env, slot, false)
  return {
    slot,
    instanceName: outputs.instance_name.value,
    ip: outputs.instance_ipv4.value,
    originHost: outputs.origin_hostname.value,
    sshConnection: outputs.ssh_connection.value,
  }
}

async function bridgeBlue(env, ssh) {
  const instance = await ensureLegacyBlueSsh(env, ssh)
  const ip = instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP
  if (!ip) {
    throw new Error("failed to determine live blue IP")
  }

  await upsertDnsRecord(env, {
    name: `blue-origin.${env.DOMAIN}`,
    content: ip,
    proxied: false,
    ttl: 60,
  })
  await upsertDnsRecord(env, {
    name: `*.blue-origin.${env.DOMAIN}`,
    content: ip,
    proxied: false,
    ttl: 60,
  })

  return {
    slot: "blue",
    instanceName: instance.name,
    ip,
    originHost: `blue-origin.${env.DOMAIN}`,
    sshConnection: `smallweb@${ip}`,
  }
}

async function deployGreen(env) {
  const outputs = terraformDeploy(env, "green", false)
  const sshConnection = outputs.ssh_connection.value
  const sshAlias = ensureSshAlias(env, "tidelands-smallweb-green", sshConnection)
  const remoteRoot = env.MUTAGEN_REMOTE_ROOT
  const bootstrapScript = resolve(REPO_ROOT, "infra/scripts/bootstrap-smallweb-slot.sh")

  await waitForSsh(env, sshConnection)
  sshRun(env, sshConnection, bootstrapScript, [remoteRoot, env.DOMAIN, "setup"])
  syncBundleToSlot(env, `${sshAlias}:${remoteRoot}`, "green")
  sshRun(env, sshConnection, bootstrapScript, [remoteRoot, env.DOMAIN, "start"])

  const candidateUrl = `https://www.${outputs.origin_hostname.value}/`
  await waitForCandidate(candidateUrl)

  return {
    slot: "green",
    instanceName: outputs.instance_name.value,
    ip: outputs.instance_ipv4.value,
    originHost: outputs.origin_hostname.value,
    sshConnection,
    candidateUrl,
  }
}

async function switchTraffic(env, slot) {
  const info = await slotInfo(env, slot)
  for (const name of [env.DOMAIN, `*.${env.DOMAIN}`]) {
    await upsertDnsRecord(env, {
      name,
      content: info.ip,
      proxied: true,
      ttl: 1,
    })
  }

  return info
}

async function status(env) {
  const blue = await slotInfo(env, "blue")
  let green = null
  try {
    green = await slotInfo(env, "green")
  } catch {
    green = null
  }

  const apex = await getDnsRecord(env, env.DOMAIN)
  const wildcard = await getDnsRecord(env, `*.${env.DOMAIN}`)
  const activeSlot =
    apex?.content === blue.ip && wildcard?.content === blue.ip
      ? "blue"
      : green && apex?.content === green.ip && wildcard?.content === green.ip
        ? "green"
        : "unknown"

  return {
    active_slot: activeSlot,
    blue,
    green,
    apex_record: apex ? { content: apex.content, proxied: apex.proxied } : null,
    wildcard_record: wildcard ? { content: wildcard.content, proxied: wildcard.proxied } : null,
  }
}

async function main() {
  const env = loadEnv()
  const ssh = ensureSshKey(env)

  requireEnv(env, "CLOUDFLARE_API_TOKEN")
  requireEnv(env, "CLOUDFLARE_ZONE_ID")
  requireEnv(env, "GCP_PROJECT")
  requireEnv(env, "BACKEND_BUCKET")
  requireEnv(env, "GCP_CREDENTIALS_FILE")

  const command = process.argv[2] ?? "mvp"

  if (command === "bridge-blue") {
    console.log(JSON.stringify(await bridgeBlue(env, ssh), null, 2))
    return
  }

  if (command === "deploy-green") {
    console.log(JSON.stringify(await deployGreen(env), null, 2))
    return
  }

  if (command === "promote") {
    const slot = process.argv[3] ?? "green"
    console.log(JSON.stringify(await switchTraffic(env, slot), null, 2))
    return
  }

  if (command === "status") {
    console.log(JSON.stringify(await status(env), null, 2))
    return
  }

  if (command === "mvp") {
    const blue = await bridgeBlue(env, ssh)
    const green = await deployGreen(env)
    console.log(JSON.stringify({
      active_slot: "blue",
      candidate_slot: "green",
      candidate_weight: 0,
      rollback_target: "blue",
      blue,
      green,
    }, null, 2))
    return
  }

  throw new Error(`unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})

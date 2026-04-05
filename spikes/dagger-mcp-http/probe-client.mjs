import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const serverUrl = new URL(process.env.MCP_SERVER_URL ?? "http://127.0.0.1:7790/mcp")
const hostHeader = process.env.MCP_HOST_HEADER

const transport = new StreamableHTTPClientTransport(serverUrl, {
  requestInit: hostHeader
    ? {
        headers: {
          Host: hostHeader,
        },
      }
    : undefined,
})

const client = new Client(
  {
    name: "dagger-mcp-http-probe",
    version: "0.0.1",
  },
  {
    capabilities: {},
  },
)

await client.connect(transport)

const tools = await client.listTools()
const methods = await client.callTool({
  name: "ListMethods",
  arguments: {},
})
const selected = await client.callTool({
  name: "SelectMethods",
  arguments: {
    methods: ["DenoUpgradeSpike_echoValue"],
  },
})
const result = await client.callTool({
  name: "CallMethod",
  arguments: {
    method: "DenoUpgradeSpike_echoValue",
    args: {
      value: "mcp-http-ok",
    },
  },
})

console.log(JSON.stringify({
  serverUrl: serverUrl.toString(),
  hostHeader: hostHeader ?? null,
  toolCount: tools.tools.length,
  toolNames: tools.tools.map((tool) => tool.name),
  methods,
  selected,
  result,
}, null, 2))

await client.close()

/**
 * ListPeersTool — Discover and list active HeliosAE peers / sub-agents
 * Part of HeliosAE / AERIS Nexus
 *
 * Scans for other HeliosAE instances running locally via:
 *  - Unix domain sockets (~/.helios/peers/*.sock) on Linux/macOS
 *  - Named pipes (\\.\pipe\helios-*) on Windows
 *  - Optional HTTP peer discovery via HELIOS_PEER_REGISTRY env
 */

import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const LIST_PEERS_TOOL_NAME = 'ListPeers'

const inputSchema = lazySchema(() =>
  z.strictObject({
    include_details: z
      .boolean()
      .default(false)
      .describe('Include provider and model info per peer (default: false)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    peers: z.array(
      z.object({
        id: z.string(),
        transport: z.enum(['unix-socket', 'named-pipe', 'http', 'process']),
        address: z.string(),
        alive: z.boolean(),
        provider: z.string().optional(),
        model: z.string().optional(),
        pid: z.number().optional(),
      }),
    ),
    count: z.number(),
    discovery_paths: z.array(z.string()),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

type Peer = Output['peers'][number]

// ── Linux / macOS: Unix domain sockets ────────────────────────────────────────

async function discoverUnixSocketPeers(includeDetails: boolean): Promise<{ peers: Peer[]; paths: string[] }> {
  const peersDir = join(homedir(), '.helios', 'peers')
  const paths = [peersDir]

  if (!existsSync(peersDir)) {
    return { peers: [], paths }
  }

  let sockFiles: string[] = []
  try {
    sockFiles = readdirSync(peersDir).filter(f => f.endsWith('.sock'))
  } catch {
    return { peers: [], paths }
  }

  const peers: Peer[] = []

  for (const sockFile of sockFiles) {
    const sockPath = join(peersDir, sockFile)
    const id = sockFile.replace('.sock', '')

    // Try to connect — if we can, it's alive
    let alive = false
    let provider: string | undefined
    let model: string | undefined

    try {
      const { createConnection } = await import('net')
      await new Promise<void>((resolve, reject) => {
        const socket = createConnection(sockPath)
        socket.setTimeout(1000)
        socket.on('connect', () => {
          alive = true
          if (includeDetails) {
            socket.write(JSON.stringify({ type: 'ping' }) + '\n')
            socket.once('data', (data) => {
              try {
                const msg = JSON.parse(data.toString())
                provider = msg.provider
                model = msg.model
              } catch {}
              socket.destroy()
              resolve()
            })
          } else {
            socket.destroy()
            resolve()
          }
        })
        socket.on('error', () => { socket.destroy(); resolve() })
        socket.on('timeout', () => { socket.destroy(); resolve() })
      })
    } catch {}

    peers.push({ id, transport: 'unix-socket', address: sockPath, alive, provider, model })
  }

  return { peers, paths }
}

// ── Windows: Named pipes ───────────────────────────────────────────────────────

async function discoverNamedPipePeers(includeDetails: boolean): Promise<{ peers: Peer[]; paths: string[] }> {
  const pipePath = '\\\\.\\pipe'
  const paths = [pipePath]
  const peers: Peer[] = []

  try {
    const { spawnSync } = await import('child_process')
    // List named pipes via PowerShell
    const r = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', '[System.IO.Directory]::GetFiles("\\\\.\\pipe") | Where-Object { $_ -like "*helios*" }'],
      { timeout: 3000, encoding: 'utf8', windowsHide: true },
    )
    if (r.status === 0 && r.stdout) {
      const pipes = r.stdout.trim().split('\n').filter(Boolean)
      for (const pipe of pipes) {
        const id = pipe.replace(/^.*helios-?/i, '').trim() || 'peer'
        peers.push({
          id,
          transport: 'named-pipe',
          address: pipe.trim(),
          alive: true, // If pipe exists, it's likely alive
        })
      }
    }
  } catch {}

  return { peers, paths }
}

// ── Process-based discovery ────────────────────────────────────────────────────

async function discoverProcessPeers(): Promise<{ peers: Peer[]; paths: string[] }> {
  const peers: Peer[] = []

  try {
    const { spawnSync } = await import('child_process')

    if (process.platform === 'win32') {
      const r = spawnSync(
        'powershell',
        ['-NoProfile', '-Command', 'Get-Process -Name node | Select-Object -ExpandProperty Id'],
        { timeout: 3000, encoding: 'utf8', windowsHide: true },
      )
      if (r.status === 0 && r.stdout) {
        const pids = r.stdout.trim().split('\n').map(Number).filter(p => p && p !== process.pid)
        for (const pid of pids) {
          peers.push({
            id: `node-${pid}`,
            transport: 'process',
            address: `pid:${pid}`,
            alive: true,
            pid,
          })
        }
      }
    } else {
      const r = spawnSync(
        'sh',
        ['-c', `pgrep -f "helios|cli.mjs" | grep -v ${process.pid}`],
        { timeout: 2000, encoding: 'utf8' },
      )
      if (r.status === 0 && r.stdout) {
        const pids = r.stdout.trim().split('\n').map(Number).filter(Boolean)
        for (const pid of pids) {
          peers.push({
            id: `helios-${pid}`,
            transport: 'process',
            address: `pid:${pid}`,
            alive: true,
            pid,
          })
        }
      }
    }
  } catch {}

  return { peers, paths: [] }
}

// ── HTTP registry (optional) ───────────────────────────────────────────────────

async function discoverHttpPeers(includeDetails: boolean): Promise<{ peers: Peer[]; paths: string[] }> {
  const registry = process.env.HELIOS_PEER_REGISTRY
  if (!registry) return { peers: [], paths: [] }

  try {
    const response = await fetch(`${registry}/peers`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return { peers: [], paths: [registry] }
    const data = await response.json() as { peers?: Peer[] }
    const peers = (data.peers ?? []).map((p: Peer) => ({ ...p, transport: 'http' as const }))
    return { peers, paths: [registry] }
  } catch {}

  return { peers: [], paths: [registry] }
}

export const ListPeersTool = buildTool({
  name: LIST_PEERS_TOOL_NAME,
  searchHint: 'list peers, discover agents, multi-agent, other helios instances',
  maxResultSizeChars: 5000,
  async description() {
    return 'Discover and list other active HeliosAE instances (peers / sub-agents) running on this machine or network.'
  },
  async prompt() {
    return `Discover active HeliosAE peers — other instances running locally or on the network.

Discovery methods (auto-used, all at once):
  Linux/macOS: Unix domain sockets at ~/.helios/peers/*.sock
  Windows:     Named pipes \\\\.\pipe\helios-*
  All:         Process scan (pgrep / Get-Process node)
  Optional:    HTTP peer registry (set HELIOS_PEER_REGISTRY=http://host:port)

Use this to:
- Check if sub-agents or parallel sessions are running
- Coordinate multi-agent workflows
- Debug peer connectivity

To register a peer socket, the peer instance sets HELIOS_PEER_SOCKET=<path>.`
  },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema(): OutputSchema { return outputSchema() },
  userFacingName() { return 'ListPeers' },
  isEnabled() { return true },
  isConcurrencySafe() { return true },
  isReadOnly() { return true },
  renderToolUseMessage(_input: z.infer<InputSchema>) { return null },
  async call(input: z.infer<InputSchema>) {
    const allPaths: string[] = []
    const allPeers: Peer[] = []

    if (process.platform === 'win32') {
      const { peers, paths } = await discoverNamedPipePeers(input.include_details)
      allPeers.push(...peers); allPaths.push(...paths)
    } else {
      const { peers, paths } = await discoverUnixSocketPeers(input.include_details)
      allPeers.push(...peers); allPaths.push(...paths)
    }

    const { peers: procPeers, paths: procPaths } = await discoverProcessPeers()
    allPeers.push(...procPeers); allPaths.push(...procPaths)

    const { peers: httpPeers, paths: httpPaths } = await discoverHttpPeers(input.include_details)
    allPeers.push(...httpPeers); allPaths.push(...httpPaths)

    // Deduplicate by address
    const seen = new Set<string>()
    const uniquePeers = allPeers.filter(p => {
      if (seen.has(p.address)) return false
      seen.add(p.address)
      return true
    })

    return {
      data: {
        peers: uniquePeers,
        count: uniquePeers.length,
        discovery_paths: [...new Set(allPaths)],
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { peers, count } = content as Output
    if (count === 0) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: 'No HeliosAE peers found. Start another instance to enable multi-agent workflows.',
      }
    }
    const lines = peers.map(p =>
      `• ${p.id} [${p.transport}] ${p.address} — ${p.alive ? '✓ alive' : '✗ dead'}` +
      (p.provider ? ` | ${p.provider}/${p.model ?? '?'}` : '')
    )
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `Found ${count} peer(s):\n${lines.join('\n')}`,
    }
  },
} satisfies ToolDef<InputSchema, Output>)

export default ListPeersTool

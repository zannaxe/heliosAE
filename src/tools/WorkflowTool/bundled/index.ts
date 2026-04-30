/**
 * WorkflowTool bundled workflows — built-in automations for HeliosAE
 * Part of AERIS Nexus
 *
 * Built-in workflows that ship with HeliosAE.
 * Add custom workflows in ~/.helios/workflows/<name>.ts
 */

export interface WorkflowStep {
  id: string
  tool: string
  input: Record<string, unknown>
  description?: string
  continueOnError?: boolean
}

export interface WorkflowDefinition {
  name: string
  description: string
  version: string
  tags: string[]
  steps: WorkflowStep[]
}

const BUNDLED_WORKFLOWS: WorkflowDefinition[] = [
  {
    name: 'project-health-check',
    description: 'Check project health: lint, test, build status, and git state',
    version: '1.0.0',
    tags: ['dev', 'ci'],
    steps: [
      { id: 'git-status',  tool: 'Bash', input: { command: 'git status --short' },          description: 'Git status' },
      { id: 'lint',        tool: 'Bash', input: { command: 'bun run lint 2>&1 || true' },   description: 'Lint', continueOnError: true },
      { id: 'typecheck',   tool: 'Bash', input: { command: 'bun run typecheck 2>&1 || true' }, description: 'Type check', continueOnError: true },
      { id: 'test',        tool: 'Bash', input: { command: 'bun test --bail 2>&1 || true' }, description: 'Tests', continueOnError: true },
      { id: 'build',       tool: 'Bash', input: { command: 'bun run build 2>&1 || true' },  description: 'Build', continueOnError: true },
    ],
  },
  {
    name: 'helios-status',
    description: 'Show HeliosAE provider status, context window, and active peers',
    version: '1.0.0',
    tags: ['helios', 'diagnostic'],
    steps: [
      { id: 'ctx',   tool: 'CtxInspect',  input: { check_smart_route: true },  description: 'Context window status' },
      { id: 'peers', tool: 'ListPeers',   input: { include_details: false },    description: 'Active peers' },
    ],
  },
  {
    name: 'capture-session',
    description: 'Capture terminal output + screenshot and save to ~/.helios/sessions/',
    version: '1.0.0',
    tags: ['capture', 'debug'],
    steps: [
      { id: 'terminal', tool: 'TerminalCapture', input: { lines: 200, include_timestamps: true }, description: 'Terminal capture' },
      { id: 'screen',   tool: 'Snip',            input: {},                                        description: 'Screenshot', continueOnError: true },
    ],
  },
]

let _initialized = false
const _registry = new Map<string, WorkflowDefinition>()

export function initBundledWorkflows(): void {
  if (_initialized) return
  for (const wf of BUNDLED_WORKFLOWS) {
    _registry.set(wf.name, wf)
  }
  _initialized = true
}

export function getWorkflow(name: string): WorkflowDefinition | undefined {
  return _registry.get(name)
}

export function listWorkflows(): WorkflowDefinition[] {
  return Array.from(_registry.values())
}

export function registerWorkflow(wf: WorkflowDefinition): void {
  _registry.set(wf.name, wf)
}

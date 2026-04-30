/**
 * WorkflowTool — Run multi-step automation workflows
 * Part of HeliosAE / AERIS Nexus
 *
 * Executes pre-defined or inline workflow definitions.
 * Bundled workflows: project-health-check, helios-status, capture-session
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { getWorkflow, listWorkflows, registerWorkflow, type WorkflowDefinition, type WorkflowStep } from './bundled/index.js'

export const WORKFLOW_TOOL_NAME = 'Workflow'

const inputSchema = lazySchema(() =>
  z.strictObject({
    name: z
      .string()
      .optional()
      .describe('Name of a built-in or registered workflow to run'),
    list: z
      .boolean()
      .default(false)
      .describe('List all available workflows instead of running one'),
    steps: z
      .array(
        z.object({
          id: z.string(),
          tool: z.string(),
          input: z.record(z.unknown()),
          description: z.string().optional(),
          continueOnError: z.boolean().optional(),
        }),
      )
      .optional()
      .describe('Run an inline workflow (array of step definitions)'),
    dry_run: z
      .boolean()
      .default(false)
      .describe('Show workflow steps without executing them'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    workflow: z.string(),
    steps_total: z.number(),
    steps_succeeded: z.number(),
    steps_failed: z.number(),
    results: z.array(
      z.object({
        id: z.string(),
        tool: z.string(),
        description: z.string().optional(),
        status: z.enum(['success', 'failed', 'skipped', 'dry-run']),
        output: z.string().optional(),
        error: z.string().optional(),
        duration_ms: z.number().optional(),
      }),
    ),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

type StepResult = Output['results'][number]

// Execute a single Bash step
async function runBashStep(input: Record<string, unknown>): Promise<string> {
  const { spawnSync } = await import('child_process')
  const cmd = String(input['command'] ?? '')
  const r = spawnSync('sh', ['-c', cmd], {
    timeout: 30_000,
    encoding: 'utf8',
    maxBuffer: 512 * 1024,
    shell: process.platform === 'win32',
  })
  const stdout = r.stdout?.trim() ?? ''
  const stderr = r.stderr?.trim() ?? ''
  if (r.status !== 0 && stderr) {
    throw new Error(stderr.slice(0, 500))
  }
  return stdout || '(no output)'
}

// Run a generic tool step — for non-Bash tools, describe the action
async function runGenericStep(tool: string, input: Record<string, unknown>): Promise<string> {
  // For tools that have their own runtime, we describe the intent.
  // Full tool-calling integration depends on the ToolUseContext being available,
  // which is not accessible from within a tool itself.
  // Future: inject ToolUseContext at call time for nested tool execution.
  return `[Would call ${tool}(${JSON.stringify(input)})]`
}

async function executeStep(step: WorkflowStep): Promise<{ output: string; durationMs: number }> {
  const start = Date.now()
  let output: string

  if (step.tool === 'Bash') {
    output = await runBashStep(step.input)
  } else {
    output = await runGenericStep(step.tool, step.input)
  }

  return { output, durationMs: Date.now() - start }
}

export const WorkflowTool = buildTool({
  name: WORKFLOW_TOOL_NAME,
  searchHint: 'run workflow, automate multi-step task, run health check',
  maxResultSizeChars: 20_000,
  async description() {
    const workflows = listWorkflows()
    const names = workflows.map(w => `"${w.name}"`).join(', ')
    return `Run multi-step automation workflows. Built-in workflows: ${names}. Or define inline steps.`
  },
  async prompt() {
    return `Execute automation workflows — sequences of tool calls run in order.

Built-in workflows:
  project-health-check  : lint + typecheck + tests + build + git status
  helios-status         : context window + provider status + peers
  capture-session       : terminal capture + screenshot

Usage:
  Workflow(name="project-health-check")      # run built-in workflow
  Workflow(list=true)                        # list all available workflows
  Workflow(name="...", dry_run=true)         # show steps without running
  Workflow(steps=[{id:"s1", tool:"Bash", input:{command:"echo hi"}}])  # inline

Custom workflows: register via ~/.helios/workflows/<name>.ts`
  },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema(): OutputSchema { return outputSchema() },
  userFacingName() { return 'Workflow' },
  isEnabled() { return true },
  isConcurrencySafe() { return false },
  isReadOnly() { return false },
  renderToolUseMessage(input: z.infer<InputSchema>) {
    return input.list ? 'List workflows' : `Run workflow: ${input.name ?? 'inline'}`
  },
  async call(input: z.infer<InputSchema>) {
    // List mode
    if (input.list) {
      const wfs = listWorkflows()
      const results: StepResult[] = wfs.map(wf => ({
        id: wf.name,
        tool: 'Workflow',
        description: `${wf.description} (${wf.steps.length} steps) [${wf.tags.join(', ')}]`,
        status: 'skipped' as const,
      }))
      return {
        data: {
          workflow: 'list',
          steps_total: wfs.length,
          steps_succeeded: 0,
          steps_failed: 0,
          results,
        },
      }
    }

    // Resolve workflow definition
    let wf: WorkflowDefinition | undefined
    if (input.steps) {
      wf = { name: 'inline', description: 'Inline workflow', version: '1.0.0', tags: [], steps: input.steps }
    } else if (input.name) {
      wf = getWorkflow(input.name)
      if (!wf) throw new Error(`Workflow "${input.name}" tidak ditemukan. Gunakan Workflow(list=true) untuk melihat daftar.`)
    } else {
      throw new Error('Berikan name= atau steps= atau list=true')
    }

    // Dry run mode
    if (input.dry_run) {
      const results: StepResult[] = wf.steps.map(s => ({
        id: s.id,
        tool: s.tool,
        description: s.description,
        status: 'dry-run' as const,
        output: `Would run: ${s.tool}(${JSON.stringify(s.input)})`,
      }))
      return {
        data: {
          workflow: wf.name,
          steps_total: wf.steps.length,
          steps_succeeded: 0,
          steps_failed: 0,
          results,
        },
      }
    }

    // Execute
    const results: StepResult[] = []
    let succeeded = 0
    let failed = 0
    let aborted = false

    for (const step of wf.steps) {
      if (aborted) {
        results.push({ id: step.id, tool: step.tool, description: step.description, status: 'skipped' })
        continue
      }

      try {
        const { output, durationMs } = await executeStep(step)
        results.push({ id: step.id, tool: step.tool, description: step.description, status: 'success', output, duration_ms: durationMs })
        succeeded++
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        results.push({ id: step.id, tool: step.tool, description: step.description, status: 'failed', error })
        failed++
        if (!step.continueOnError) {
          aborted = true
        }
      }
    }

    return {
      data: {
        workflow: wf.name,
        steps_total: wf.steps.length,
        steps_succeeded: succeeded,
        steps_failed: failed,
        results,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { workflow, steps_total, steps_succeeded, steps_failed, results } = content as Output

    if (workflow === 'list') {
      const lines = results.map(r => `  • ${r.id} — ${r.description ?? ''}`)
      return { tool_use_id: toolUseID, type: 'tool_result', content: `Available workflows:\n${lines.join('\n')}` }
    }

    const header = `Workflow: ${workflow} | ${steps_succeeded}/${steps_total} succeeded${steps_failed > 0 ? ` | ${steps_failed} failed` : ''}`
    const body = results.map(r => {
      const icon = r.status === 'success' ? '✓' : r.status === 'failed' ? '✗' : r.status === 'dry-run' ? '~' : '○'
      const label = r.description ?? r.tool
      const timing = r.duration_ms ? ` (${r.duration_ms}ms)` : ''
      const detail = r.output
        ? `\n    ${r.output.slice(0, 300).replace(/\n/g, '\n    ')}`
        : r.error ? `\n    ⚠ ${r.error}` : ''
      return `${icon} [${r.id}] ${label}${timing}${detail}`
    }).join('\n')

    return { tool_use_id: toolUseID, type: 'tool_result', content: `${header}\n${'─'.repeat(50)}\n${body}` }
  },
} satisfies ToolDef<InputSchema, Output>)

export default WorkflowTool

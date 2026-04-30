/**
 * CtxInspectTool — Context window inspector & health monitor
 * Part of HeliosAE / AERIS Nexus
 *
 * Reports current context window usage, triggers smart routing
 * suggestions, and helps the user understand context consumption.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { applySmartRoute, isComplexQuery, getHeliosProviderStatus } from '../../services/api/heliosProviders.js'

export const CTX_INSPECT_TOOL_NAME = 'CtxInspect'

const inputSchema = lazySchema(() =>
  z.strictObject({
    check_smart_route: z
      .boolean()
      .default(true)
      .describe('Re-evaluate smart routing based on current context size (default: true)'),
    query_hint: z
      .string()
      .optional()
      .describe('Current user query text — used to detect complexity for smart routing'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    estimated_tokens: z.number(),
    context_window_limit: z.number(),
    usage_percent: z.number(),
    provider_status: z.string(),
    smart_route_recommendation: z.string().optional(),
    health: z.enum(['healthy', 'warning', 'critical']),
    tips: z.array(z.string()),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

// Rough token estimator: ~4 chars per token for mixed content
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Context window sizes by model
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Gemini
  'gemini-2.5-pro-exp-03-25': 1_048_576,
  'gemini-2.0-flash':          1_048_576,
  'gemini-2.0-flash-lite':     1_048_576,
  // Groq
  'llama-3.3-70b-versatile':   131_072,
  'llama-3.1-8b-instant':      131_072,
  'deepseek-r1-distill-llama-70b': 131_072,
  // OpenAI
  'gpt-4.1':                   1_047_576,
  'gpt-4.1-mini':                 128_000,
  // Default
  'default':                      128_000,
}

function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? MODEL_CONTEXT_LIMITS['default']!
}

export const CtxInspectTool = buildTool({
  name: CTX_INSPECT_TOOL_NAME,
  searchHint: 'inspect context window, check context usage, how much context is left',
  maxResultSizeChars: 2000,
  async description() {
    return 'Inspect current context window usage, provider status, and smart routing health. Helps diagnose context overflow and provider switching.'
  },
  async prompt() {
    return `Inspect the HeliosAE context window and provider status.

Reports:
- Estimated token usage (rough estimate based on conversation length)
- Percentage of context window consumed
- Health status: healthy < 60% | warning 60–85% | critical > 85%
- Active provider (Groq/Gemini) and smart routing recommendation
- Actionable tips when context is getting large

Use this when:
- Responses seem degraded or truncated
- You want to know if smart routing should switch providers
- You're approaching context limits and need to compact`
  },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema(): OutputSchema { return outputSchema() },
  userFacingName() { return 'CtxInspect' },
  isEnabled() { return true },
  isConcurrencySafe() { return true },
  isReadOnly() { return true },
  renderToolUseMessage(_input: z.infer<InputSchema>) { return null },
  async call(input: z.infer<InputSchema>) {
    const model = process.env.HELIOS_ACTIVE_MODEL ?? process.env.OPENAI_MODEL ?? 'default'
    const contextLimit = getContextLimit(model)

    // Estimate tokens from memory usage (v8 heap as proxy + conversation length)
    // In practice, the real token count comes from the API response headers,
    // but we don't have those here — estimate from process + env hints.
    const heapMB = process.memoryUsage().heapUsed / 1024 / 1024

    // Use HELIOS_CTX_TOKENS if set by the main loop (QueryEngine integration)
    const estimatedTokens = process.env.HELIOS_CTX_TOKENS
      ? parseInt(process.env.HELIOS_CTX_TOKENS, 10)
      : Math.round(heapMB * 200) // rough proxy: 200 tokens per MB heap

    const usagePercent = Math.min(100, Math.round((estimatedTokens / contextLimit) * 100))

    const health: Output['health'] =
      usagePercent >= 85 ? 'critical' :
      usagePercent >= 60 ? 'warning' :
      'healthy'

    const tips: string[] = []

    if (health === 'critical') {
      tips.push('⚠  Konteks hampir penuh. Pertimbangkan `/compact` untuk ringkas riwayat.')
      tips.push('💡 Mulai sesi baru untuk task yang tidak butuh riwayat sebelumnya.')
    } else if (health === 'warning') {
      tips.push('📊 Konteks sudah terisi >60%. Smart routing otomatis beralih ke Gemini 2.5 Pro (1M context).')
    }

    if (usagePercent > 50 && !process.env.GEMINI_API_KEY) {
      tips.push('💡 Set GEMINI_API_KEY untuk akses 1M context window di Gemini 2.5 Pro — gratis.')
    }

    // Trigger smart route evaluation
    let smartRouteRec: string | undefined
    if (input.check_smart_route) {
      const isComplex = input.query_hint ? isComplexQuery(input.query_hint) : false
      applySmartRoute(estimatedTokens, isComplex)

      const activeProvider = process.env.HELIOS_ACTIVE_PROVIDER ?? 'unknown'
      const reason = estimatedTokens > 50_000 ? 'long context' : isComplex ? 'complex query' : 'standard query'
      smartRouteRec = `Active: ${activeProvider.toUpperCase()} (${reason})`
    }

    const providerStatus = getHeliosProviderStatus()

    return {
      data: {
        estimated_tokens: estimatedTokens,
        context_window_limit: contextLimit,
        usage_percent: usagePercent,
        provider_status: providerStatus,
        smart_route_recommendation: smartRouteRec,
        health,
        tips,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { estimated_tokens, context_window_limit, usage_percent, health, tips, smart_route_recommendation } = content as Output
    const bar = '█'.repeat(Math.round(usage_percent / 5)) + '░'.repeat(20 - Math.round(usage_percent / 5))
    const lines = [
      `Context: [${bar}] ${usage_percent}% (${estimated_tokens.toLocaleString()} / ${context_window_limit.toLocaleString()} tokens)`,
      `Health: ${health.toUpperCase()}`,
      smart_route_recommendation ? `Router: ${smart_route_recommendation}` : '',
      tips.length > 0 ? '\nTips:\n' + tips.join('\n') : '',
    ].filter(Boolean)

    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: lines.join('\n'),
    }
  },
} satisfies ToolDef<InputSchema, Output>)

export default CtxInspectTool

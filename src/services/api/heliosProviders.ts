/**
 * HeliosAE Provider Configuration
 * Part of AERIS Nexus
 *
 * Supported free providers:
 *   - Gemini (Google AI Free Tier) — Gemini 2.5 Pro, best for long context & deep reasoning
 *   - Groq (Free Tier)            — llama-3.3-70b-versatile, best for fast real-time responses
 *
 * Environment variables:
 *   HELIOS_PROVIDER=gemini|groq|auto  — select provider (default: auto)
 *   GEMINI_API_KEY=...                — Google AI Studio free API key
 *   GROQ_API_KEY=...                  — Groq Console free API key
 *   HELIOS_MODEL=...                  — optional model override
 *   HELIOS_SMART_ROUTE=0              — disable mid-session smart routing
 *
 * Smart Router logic:
 *   - Context < 50k tokens + not complex  → Groq (fast, real-time feel)
 *   - Context ≥ 50k tokens OR complex     → Gemini 2.5 Pro (1M context window, deep reasoning)
 *   - Only one key available              → always use that provider
 *   - HELIOS_PROVIDER=gemini|groq         → lock to that provider, no switching
 */

export type HeliosProvider = 'gemini' | 'groq' | 'auto'

export interface HeliosProviderConfig {
  provider: HeliosProvider
  apiKey: string
  baseUrl: string
  model: string
}

// ── Free tier model catalogue ──────────────────────────────────────────────

export const GEMINI_MODELS = {
  default: 'gemini-2.5-flash-preview-04-17',  // Gemini 2.5 Flash — cepat + thinking, 1M context, gratis
  pro:     'gemini-2.5-pro-exp-03-25',         // Gemini 2.5 Pro — reasoning terdalam (opsional)
  lite:    'gemini-2.0-flash-lite',             // Latency terendah
} as const

export const GROQ_MODELS = {
  default:  'llama-3.3-70b-versatile',           // Terbaik gratis Groq: kualitas + kecepatan
  fast:     'llama-3.1-8b-instant',              // Tercepat, 128K context
  deepseek: 'deepseek-r1-distill-llama-70b',     // Reasoning & math
} as const

export const PROVIDER_URLS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq:   'https://api.groq.com/openai/v1',
} as const

// ── Context complexity detection ──────────────────────────────────────────

/**
 * Keywords that suggest a query needs deeper reasoning — should prefer Gemini 2.5 Pro
 * even at lower context sizes.
 */
const COMPLEX_QUERY_SIGNALS = [
  'analisis', 'analyze', 'analyse',
  'rancang', 'design', 'architect',
  'debug', 'troubleshoot',
  'explain', 'jelaskan',
  'compare', 'bandingkan',
  'refactor', 'restructure',
  'review', 'evaluate',
  'kenapa', 'mengapa', 'why',
  'how does', 'bagaimana cara',
  'strategi', 'strategy',
]

/**
 * Estimate if a user query is complex based on keyword signals.
 */
export function isComplexQuery(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()
  return COMPLEX_QUERY_SIGNALS.some(signal => lower.includes(signal))
}

// ── Core routing logic ─────────────────────────────────────────────────────

/**
 * Choose best provider for given context size and complexity.
 * Returns 'gemini' or 'groq' — never 'auto'.
 */
export function smartRoute(contextTokens: number, isComplex: boolean): Exclude<HeliosProvider, 'auto'> {
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const locked = process.env.HELIOS_PROVIDER

  // Hard lock — user explicitly picked a provider
  if (locked === 'gemini' && geminiKey) return 'gemini'
  if (locked === 'groq' && groqKey) return 'groq'

  // Only one key available
  if (!groqKey && geminiKey) return 'gemini'
  if (!geminiKey && groqKey) return 'groq'

  // Both available — route by context + complexity
  // Gemini 2.5 Pro untuk konteks panjang atau query kompleks
  if (contextTokens > 50_000 || isComplex) return 'gemini'
  return 'groq'
}

/**
 * Mid-session smart switch: re-wire the OpenAI shim env vars if the best
 * provider has changed (e.g. context grew past 50k tokens).
 *
 * Called from the main query loop with current context size.
 * Only acts when both GROQ_API_KEY and GEMINI_API_KEY are set.
 * Does nothing if HELIOS_SMART_ROUTE=0 or provider is locked.
 */
export function applySmartRoute(contextTokens: number, isComplex = false): void {
  // Opt-out
  if (process.env.HELIOS_SMART_ROUTE === '0') return

  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  if (!groqKey || !geminiKey) return // nothing to switch to

  const locked = process.env.HELIOS_PROVIDER
  if (locked === 'gemini' || locked === 'groq') return // user locked it

  const desired = smartRoute(contextTokens, isComplex)
  const current = process.env.HELIOS_ACTIVE_PROVIDER

  if (desired === current) return // already on best provider

  // Re-wire shim
  if (desired === 'gemini') {
    process.env.OPENAI_API_KEY = geminiKey
    process.env.OPENAI_BASE_URL = PROVIDER_URLS.gemini
    process.env.OPENAI_MODEL = process.env.HELIOS_MODEL ?? GEMINI_MODELS.default
  } else {
    process.env.OPENAI_API_KEY = groqKey
    process.env.OPENAI_BASE_URL = PROVIDER_URLS.groq
    process.env.OPENAI_MODEL = process.env.HELIOS_MODEL ?? GROQ_MODELS.default
  }

  process.env.HELIOS_ACTIVE_PROVIDER = desired
  process.env.HELIOS_ACTIVE_MODEL = process.env.OPENAI_MODEL!

  const reason = contextTokens > 50_000
    ? `konteks panjang (${Math.round(contextTokens / 1000)}k token)`
    : isComplex
      ? 'query kompleks terdeteksi'
      : 'query ringan'

  const modelLabel = desired === 'gemini'
    ? `Gemini 2.5 Flash (${process.env.OPENAI_MODEL})`
    : `Groq llama-3.3-70b (${process.env.OPENAI_MODEL})`

  // Handoff notification — tulis ke stdout supaya selalu terlihat user di CLI
  process.stdout.write(
    `\n\x1b[36m[HELIOS ⚡] Handoff → ${desired.toUpperCase()} — ${reason}\x1b[0m\n` +
    `\x1b[2m           Model: ${modelLabel}\x1b[0m\n\n`
  )
}

// ── Provider resolution ────────────────────────────────────────────────────

/**
 * Resolve the active provider config from environment.
 * Priority: explicit HELIOS_PROVIDER → auto-detect from available keys.
 */
export function resolveHeliosProvider(): HeliosProviderConfig | null {
  const requested = (process.env.HELIOS_PROVIDER ?? 'auto') as HeliosProvider
  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  if (requested === 'auto') {
    // Default: Groq untuk kecepatan kalau tersedia, fallback ke Gemini
    if (groqKey) {
      return {
        provider: 'groq',
        apiKey: groqKey,
        baseUrl: PROVIDER_URLS.groq,
        model: process.env.HELIOS_MODEL ?? GROQ_MODELS.default,
      }
    }
    if (geminiKey) {
      return {
        provider: 'gemini',
        apiKey: geminiKey,
        baseUrl: PROVIDER_URLS.gemini,
        model: process.env.HELIOS_MODEL ?? GEMINI_MODELS.default,
      }
    }
    return null
  }

  if (requested === 'groq' && groqKey) {
    return {
      provider: 'groq',
      apiKey: groqKey,
      baseUrl: PROVIDER_URLS.groq,
      model: process.env.HELIOS_MODEL ?? GROQ_MODELS.default,
    }
  }

  if (requested === 'gemini' && geminiKey) {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      baseUrl: PROVIDER_URLS.gemini,
      model: process.env.HELIOS_MODEL ?? GEMINI_MODELS.default,
    }
  }

  return null
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * Inject HeliosAE provider settings into environment for the OpenAI shim.
 * Called in main.tsx after loadHeliosEnv(), before the main loop.
 *
 * Fix: exit(1) kalau tidak ada API key — bukan silent continue.
 */
export function bootstrapHeliosProvider(): void {
  const config = resolveHeliosProvider()

  if (!config) {
    const configPath = process.platform === 'win32'
      ? '%USERPROFILE%\\.helios\\.env'
      : '~/.helios/.env'
    process.stderr.write(`
\x1b[31m[HELIOS] ✗  Tidak ada API key yang ditemukan!\x1b[0m

Set salah satu variabel berikut:
  \x1b[36mGEMINI_API_KEY=your_key\x1b[0m   → gratis di aistudio.google.com (Gemini 2.5 Pro)
  \x1b[36mGROQ_API_KEY=your_key\x1b[0m     → gratis di console.groq.com

Atau taruh di \x1b[33m${configPath}\x1b[0m:
  GEMINI_API_KEY=your_key_here
  GROQ_API_KEY=your_key_here

`)
    // Fix: exit dengan kode error agar tidak lanjut dengan API calls yang pasti gagal
    process.exit(1)
  }

  // Wire into the existing OpenAI shim
  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  process.env.OPENAI_API_KEY = config.apiKey
  process.env.OPENAI_BASE_URL = config.baseUrl
  process.env.OPENAI_MODEL = config.model

  // HeliosAE tracking vars (used by applySmartRoute)
  process.env.HELIOS_ACTIVE_PROVIDER = config.provider
  process.env.HELIOS_ACTIVE_MODEL = config.model

  // Startup log
  const hasGroq = !!process.env.GROQ_API_KEY
  const hasGemini = !!process.env.GEMINI_API_KEY
  const smartEnabled = process.env.HELIOS_SMART_ROUTE !== '0' && hasGroq && hasGemini

  const modelLabel = config.provider === 'gemini'
    ? `Gemini 2.5 Flash (${config.model})`
    : `Groq (${config.model})`

  process.stderr.write(
    `\x1b[36m[HELIOS ⚡] Provider: ${config.provider.toUpperCase()} | Model: ${modelLabel}\x1b[0m` +
    (smartEnabled ? '\x1b[2m | Smart routing: ON (Groq↔Gemini 2.5 Flash)\x1b[0m' : '') +
    '\n'
  )
}

// ── Status ─────────────────────────────────────────────────────────────────

/**
 * Return a human-readable provider status string.
 * Used by /helios-status slash command.
 */
export function getHeliosProviderStatus(): string {
  const provider = process.env.HELIOS_ACTIVE_PROVIDER ?? 'unknown'
  const model = process.env.HELIOS_ACTIVE_MODEL ?? 'unknown'
  const hasGroq = !!process.env.GROQ_API_KEY
  const hasGemini = !!process.env.GEMINI_API_KEY
  const smartEnabled = process.env.HELIOS_SMART_ROUTE !== '0' && hasGroq && hasGemini
  const locked = process.env.HELIOS_PROVIDER

  return [
    `Provider aktif : ${provider.toUpperCase()}`,
    `Model aktif    : ${model}`,
    `Groq key       : ${hasGroq ? '✓ tersedia' : '✗ tidak ada'}`,
    `Gemini key     : ${hasGemini ? '✓ tersedia' : '✗ tidak ada'}`,
    `Smart routing  : ${smartEnabled ? '✓ aktif (Groq↔Gemini 2.5 Flash)' : locked ? `✗ dikunci ke ${locked}` : '✗ nonaktif (set kedua key untuk aktifkan)'}`,
  ].join('\n')
}

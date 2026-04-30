import type { LocalCommandCall } from '../../types/command.js'
import { GEMINI_MODELS, GROQ_MODELS } from '../../services/api/heliosProviders.js'

export const call: LocalCommandCall = async () => {
  const activeProvider = process.env['HELIOS_ACTIVE_PROVIDER'] ?? 'unknown'
  const activeModel = process.env['HELIOS_ACTIVE_MODEL'] ?? 'unknown'

  const geminiRows = Object.entries(GEMINI_MODELS)
    .map(([key, model]) => {
      const isActive = model === activeModel ? ' ← aktif' : ''
      const desc = key === 'default' ? '1M context, cepat, gratis' : 'paling canggih, gratis experimental'
      return `  ${model.padEnd(36)} ${desc}${isActive}`
    })
    .join('\n')

  const groqRows = Object.entries(GROQ_MODELS)
    .map(([key, model]) => {
      const isActive = model === activeModel ? ' ← aktif' : ''
      const desc = key === 'fast' ? '128K ctx, tercepat, gratis'
                 : key === 'default' ? 'kualitas terbaik Groq, gratis'
                 : 'bagus untuk reasoning/math'
      return `  ${model.padEnd(36)} ${desc}${isActive}`
    })
    .join('\n')

  const output = `
[HELIOS ⚡] Model yang Tersedia
${'─'.repeat(60)}

Provider aktif : ${activeProvider.toUpperCase()}
Model aktif    : ${activeModel}

GEMINI  (set GEMINI_API_KEY → aistudio.google.com)
${'─'.repeat(60)}
${geminiRows}

GROQ  (set GROQ_API_KEY → console.groq.com)
${'─'.repeat(60)}
${groqRows}

Cara ganti model:
  HELIOS_MODEL=nama-model  (di ~/.helios/.env atau shell)

Cara paksa provider:
  HELIOS_PROVIDER=gemini   atau   HELIOS_PROVIDER=groq
${'─'.repeat(60)}
`
  return { type: 'text', value: output }
}

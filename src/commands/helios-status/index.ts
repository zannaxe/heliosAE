import type { Command } from '../../commands.js'

const heliosStatus = {
  type: 'local',
  name: 'helios-status',
  description: 'Tampilkan status provider HeliosAE (Groq/Gemini) dan smart routing',
  aliases: ['provider', 'helios'],
  isEnabled: () => true,
  isHidden: false,
  load: () => import('./helios-status.js'),
} satisfies Command

export default heliosStatus

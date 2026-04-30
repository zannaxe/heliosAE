import type { Command } from '../../commands.js'

const heliosModels = {
  type: 'local',
  name: 'helios-models',
  description: 'Tampilkan semua model Gemini dan Groq yang tersedia',
  aliases: ['models'],
  isEnabled: () => true,
  isHidden: false,
  load: () => import('./helios-models.js'),
} satisfies Command

export default heliosModels

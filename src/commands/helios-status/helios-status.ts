import type { LocalCommandCall } from '../../types/command.js'
import { getHeliosProviderStatus } from '../../services/api/heliosProviders.js'

export const call: LocalCommandCall = async () => {
  const status = getHeliosProviderStatus()
  return {
    type: 'text',
    value: `\n[HELIOS ⚡] Status Provider\n${'─'.repeat(40)}\n${status}\n`,
  }
}

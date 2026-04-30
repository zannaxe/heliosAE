// HeliosAE — Part of AERIS Nexus
export const PRODUCT_NAME = 'HeliosAE'
export const PRODUCT_TAGLINE = 'AI Personal Assistant — AERIS Nexus'
export const PRODUCT_URL = 'https://aeris-nexus.dev'
export const PRODUCT_VERSION = '0.1.0'

// Legacy stubs — bridge removed, kept to avoid import errors
export const CLAUDE_AI_BASE_URL = 'https://aeris-nexus.dev'

export function isRemoteSessionStaging(): boolean { return false }
export function isRemoteSessionLocal(): boolean { return false }
export function getClaudeAiBaseUrl(): string { return CLAUDE_AI_BASE_URL }
export function getRemoteSessionUrl(sessionId: string): string {
  return `${CLAUDE_AI_BASE_URL}/session/${sessionId}`
}

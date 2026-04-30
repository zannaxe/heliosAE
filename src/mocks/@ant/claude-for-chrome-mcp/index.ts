// HeliosAE stub — @ant/claude-for-chrome-mcp (Chrome extension bridge)
// Internal Anthropic package for Claude in Chrome feature. Disabled on HeliosAE.

export type PermissionMode = 'auto' | 'manual'

export interface Logger {
  debug(msg: string, ...args: unknown[]): void
  info(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  error(msg: string, ...args: unknown[]): void
}

export interface ClaudeForChromeContext {
  sessionId: string
  tabId?: number
  permissionMode: PermissionMode
}

export const BROWSER_TOOLS: string[] = []

export function createClaudeForChromeMcpServer(_options?: unknown): unknown {
  return null
}

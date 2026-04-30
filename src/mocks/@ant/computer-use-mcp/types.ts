/**
 * HeliosAE stub — @ant/computer-use-mcp/types
 */

export type CoordinateMode = 'pixels' | 'normalized'

export interface CuSubGates {
  pixelValidation: boolean
  clipboardPasteMultiline: boolean
  mouseAnimation: boolean
  hideBeforeAction: boolean
  autoTargetDisplay: boolean
  clipboardGuard: boolean
}

export interface CuPermissionRequest {
  type: string
  description?: string
  resource?: string
}

export interface CuPermissionResponse {
  granted: boolean
  grantFlags?: Record<string, boolean>
}

export interface Logger {
  silly(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface ComputerUseHostAdapter {
  executor: {
    screenshot(): Promise<unknown>
    listInstalledApps(): Promise<unknown[]>
    listRunningApps(): Promise<unknown[]>
    getFrontmostApp(): Promise<unknown>
  }
  logger?: Logger
}

export const DEFAULT_GRANT_FLAGS: Record<string, boolean> = {}

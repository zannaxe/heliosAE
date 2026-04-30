/**
 * HeliosAE stub — @ant/computer-use-mcp
 * Anthropic internal package (macOS computer-use feature).
 * Not available on npm. HeliosAE runs on Windows 11 — computer-use disabled.
 * All exports are no-ops so the build passes cleanly.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScreenshotDims {
  width: number
  height: number
}

export interface DisplayGeometry {
  width: number
  height: number
  scaleFactor: number
}

export interface ScreenshotResult {
  base64: string
  mimeType: string
  dims: ScreenshotDims
}

export interface FrontmostApp {
  bundleId: string
  name: string
}

export interface InstalledApp {
  bundleId: string
  name: string
  path: string
}

export interface RunningApp {
  bundleId: string
  name: string
  pid: number
}

export interface ResolvePrepareCaptureResult {
  displayId: number
  geometry: DisplayGeometry
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

export interface CuCallToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

export interface ComputerUseSessionContext {
  sessionId: string
  displayId?: number
}

export interface ComputerExecutor {
  screenshot(): Promise<ScreenshotResult>
  mouseMove(x: number, y: number): Promise<void>
  mouseClick(x: number, y: number, button?: string): Promise<void>
  keyPress(key: string): Promise<void>
  typeText(text: string): Promise<void>
  listInstalledApps(): Promise<InstalledApp[]>
  listRunningApps(): Promise<RunningApp[]>
  getFrontmostApp(): Promise<FrontmostApp | null>
}

// ── Constants ──────────────────────────────────────────────────────────────

export const API_RESIZE_PARAMS = { width: 1280, height: 800 }
export const DEFAULT_GRANT_FLAGS: Record<string, boolean> = {}

// ── Functions ──────────────────────────────────────────────────────────────

export function targetImageSize(dims: ScreenshotDims): ScreenshotDims {
  return { width: dims?.width ?? 1280, height: dims?.height ?? 800 }
}

export function buildComputerUseTools(
  _capabilities: unknown,
  _coordinateMode?: string,
): Array<{ name: string; description: string }> {
  return []
}

export function createComputerUseMcpServer(_options?: unknown): unknown {
  return null
}

export function bindSessionContext(
  _ctx: ComputerUseSessionContext,
): (_fn: unknown) => null {
  return () => null
}

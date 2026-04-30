/**
 * SnipTool — Cross-platform screenshot / screen capture tool
 * Part of HeliosAE / AERIS Nexus
 *
 * Linux:   scrot → gnome-screenshot → import (ImageMagick) → xwd
 * Windows: PowerShell + System.Windows.Forms (no extra deps)
 */

import { execSync, spawnSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const SNIP_TOOL_NAME = 'Snip'

const inputSchema = lazySchema(() =>
  z.strictObject({
    output_path: z
      .string()
      .optional()
      .describe(
        'Path to save the screenshot. Defaults to ~/.helios/screenshots/snip-<timestamp>.png',
      ),
    region: z
      .string()
      .optional()
      .describe(
        'Optional region to capture, format: "x,y,width,height". Omit for full screen.',
      ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    saved_to: z.string(),
    size_bytes: z.number().optional(),
    message: z.string(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

function defaultSnipPath(): string {
  const dir = join(homedir(), '.helios', 'screenshots')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return join(dir, `snip-${ts}.png`)
}

function captureLinux(outputPath: string, region?: string): void {
  // Try scrot first (most common on minimal Linux)
  if (commandAvailable('scrot')) {
    const args: string[] = [outputPath]
    if (region) {
      const [x, y, w, h] = region.split(',').map(s => s.trim())
      args.unshift('-a', `${x},${y},${w},${h}`)
    }
    const r = spawnSync('scrot', args, { timeout: 10_000 })
    if (r.status === 0) return
  }

  // Try gnome-screenshot
  if (commandAvailable('gnome-screenshot')) {
    const args = ['-f', outputPath]
    if (region) {
      const [x, y, w, h] = region.split(',').map(s => s.trim())
      args.push('--area', `${x},${y},${w},${h}`)
    } else {
      args.push('--display=:0')
    }
    const r = spawnSync('gnome-screenshot', args, { timeout: 10_000 })
    if (r.status === 0) return
  }

  // Try ImageMagick import
  if (commandAvailable('import')) {
    const args: string[] = []
    if (region) {
      const parts = region.split(',').map(s => s.trim())
      args.push('-crop', `${parts[2]}x${parts[3]}+${parts[0]}+${parts[1]}`)
    } else {
      args.push('-window', 'root')
    }
    args.push(outputPath)
    const r = spawnSync('import', args, { timeout: 10_000 })
    if (r.status === 0) return
  }

  // Try xwd → convert (for headless/X11 environments)
  if (commandAvailable('xwd') && commandAvailable('convert')) {
    const xwdPath = outputPath.replace('.png', '.xwd')
    spawnSync('xwd', ['-root', '-silent', '-out', xwdPath], { timeout: 10_000 })
    if (existsSync(xwdPath)) {
      spawnSync('convert', [xwdPath, outputPath], { timeout: 10_000 })
      return
    }
  }

  throw new Error(
    'Tidak ada screenshot tool yang tersedia.\n' +
    'Install salah satu: scrot, gnome-screenshot, imagemagick\n' +
    '  sudo apt install scrot\n' +
    '  sudo apt install gnome-screenshot\n' +
    '  sudo apt install imagemagick',
  )
}

function captureWindows(outputPath: string, region?: string): void {
  // Use PowerShell + System.Windows.Forms — no extra dependencies required
  let psScript: string
  if (region) {
    const [x, y, w, h] = region.split(',').map(s => s.trim())
    psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(${w}, ${h})
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(${x}, ${y}, 0, 0, [System.Drawing.Size]::new(${w}, ${h}))
$g.Dispose()
$bmp.Save('${outputPath.replace(/\\/g, '\\\\')}')
$bmp.Dispose()
`
  } else {
    psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$g.Dispose()
$bmp.Save('${outputPath.replace(/\\/g, '\\\\')}')
$bmp.Dispose()
`
  }
  const r = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
    timeout: 15_000,
    windowsHide: true,
  })
  if (r.status !== 0) {
    const stderr = r.stderr?.toString() ?? ''
    throw new Error(`PowerShell screenshot gagal: ${stderr}`)
  }
}

function commandAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe', timeout: 1000 })
    return true
  } catch {
    return false
  }
}

export const SnipTool = buildTool({
  name: SNIP_TOOL_NAME,
  searchHint: 'take a screenshot, capture screen',
  maxResultSizeChars: 500,
  async description() {
    return 'Capture a screenshot of the current screen. Saves as PNG. Supports full-screen or region capture.'
  },
  async prompt() {
    return `Take a screenshot of the screen using the platform's native screenshot capability.
On Linux: uses scrot, gnome-screenshot, or ImageMagick import.
On Windows: uses PowerShell with System.Windows.Forms (no extra installs needed).

Use this when you need to:
- Visually verify what's on screen
- Capture error dialogs or GUI states
- Document the current state of a program`
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'Snip'
  },
  isEnabled() {
    return true
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    return false
  },
  renderToolUseMessage(_input: z.infer<InputSchema>) {
    return null
  },
  async call(input: z.infer<InputSchema>) {
    const outputPath = input.output_path ?? defaultSnipPath()

    try {
      if (process.platform === 'win32') {
        captureWindows(outputPath, input.region)
      } else {
        captureLinux(outputPath, input.region)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`SnipTool: ${msg}`)
    }

    let sizeBytes: number | undefined
    try {
      const { statSync } = await import('fs')
      sizeBytes = statSync(outputPath).size
    } catch {}

    return {
      data: {
        saved_to: outputPath,
        size_bytes: sizeBytes,
        message: `Screenshot disimpan ke ${outputPath}${sizeBytes ? ` (${Math.round(sizeBytes / 1024)} KB)` : ''}`,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { saved_to, message } = content as Output
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `${message}\nPath: ${saved_to}`,
    }
  },
} satisfies ToolDef<InputSchema, Output>)

export default SnipTool

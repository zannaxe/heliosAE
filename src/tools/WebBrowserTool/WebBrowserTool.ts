/**
 * WebBrowserTool — Headless browser automation tool
 * Part of HeliosAE / AERIS Nexus
 *
 * Uses Playwright (chromium) if available, falls back to puppeteer,
 * then falls back to curl/wget for pure text extraction.
 *
 * Linux:   playwright install chromium (auto-detected)
 * Windows: playwright install chromium (auto-detected)
 */

import { execSync, spawnSync } from 'child_process'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const WEB_BROWSER_TOOL_NAME = 'WebBrowser'

const inputSchema = lazySchema(() =>
  z.strictObject({
    url: z.string().describe('URL to open in the browser'),
    action: z
      .enum(['navigate', 'screenshot', 'extract_text', 'click', 'type', 'scroll', 'evaluate'])
      .default('extract_text')
      .describe('Action to perform'),
    selector: z
      .string()
      .optional()
      .describe('CSS selector for click/type/scroll actions'),
    text: z
      .string()
      .optional()
      .describe('Text to type when action=type'),
    script: z
      .string()
      .optional()
      .describe('JavaScript to evaluate when action=evaluate'),
    wait_for: z
      .string()
      .optional()
      .describe('CSS selector or milliseconds to wait before extracting'),
    screenshot_path: z
      .string()
      .optional()
      .describe('Path to save screenshot (for action=screenshot)'),
    headless: z
      .boolean()
      .default(true)
      .describe('Run browser in headless mode (default: true)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    url: z.string(),
    action: z.string(),
    result: z.string(),
    screenshot_path: z.string().optional(),
    backend: z.string(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

function commandAvailable(cmd: string): boolean {
  try {
    const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`
    execSync(check, { stdio: 'pipe', timeout: 2000 })
    return true
  } catch {
    return false
  }
}

function hasPlaywright(): boolean {
  try {
    require.resolve('playwright')
    return true
  } catch {
    return false
  }
}

function hasPuppeteer(): boolean {
  try {
    require.resolve('puppeteer')
    return true
  } catch {
    return false
  }
}

async function runWithPlaywright(input: z.infer<InputSchema>): Promise<Output> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('playwright') as typeof import('playwright')

  const browser = await chromium.launch({ headless: input.headless })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    if (input.wait_for) {
      const waitMs = parseInt(input.wait_for, 10)
      if (!isNaN(waitMs)) {
        await page.waitForTimeout(waitMs)
      } else {
        await page.waitForSelector(input.wait_for, { timeout: 10_000 })
      }
    }

    let result = ''
    let screenshotPath: string | undefined

    switch (input.action) {
      case 'navigate':
        result = `Navigated to ${page.url()}`
        break

      case 'screenshot': {
        const { homedir } = await import('os')
        const { join } = await import('path')
        const { mkdirSync } = await import('fs')
        const dir = join(homedir(), '.helios', 'screenshots')
        mkdirSync(dir, { recursive: true })
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        screenshotPath = input.screenshot_path ?? join(dir, `browser-${ts}.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })
        result = `Screenshot saved to ${screenshotPath}`
        break
      }

      case 'extract_text': {
        result = await page.evaluate(() => {
          // Remove scripts, styles, nav for cleaner text
          const remove = document.querySelectorAll('script, style, nav, footer, [aria-hidden]')
          remove.forEach(el => el.remove())
          return document.body?.innerText?.trim() ?? ''
        })
        // Limit to 8k chars to avoid context overflow
        if (result.length > 8000) {
          result = result.slice(0, 8000) + '\n\n[... truncated at 8000 chars]'
        }
        break
      }

      case 'click': {
        if (!input.selector) throw new Error('selector required for click action')
        await page.click(input.selector)
        result = `Clicked "${input.selector}" on ${page.url()}`
        break
      }

      case 'type': {
        if (!input.selector) throw new Error('selector required for type action')
        if (!input.text) throw new Error('text required for type action')
        await page.fill(input.selector, input.text)
        result = `Typed "${input.text}" into "${input.selector}"`
        break
      }

      case 'scroll': {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        result = 'Scrolled to bottom of page'
        break
      }

      case 'evaluate': {
        if (!input.script) throw new Error('script required for evaluate action')
        const evalResult = await page.evaluate(input.script)
        result = typeof evalResult === 'string' ? evalResult : JSON.stringify(evalResult, null, 2)
        break
      }
    }

    return { url: page.url(), action: input.action, result, screenshot_path: screenshotPath, backend: 'playwright' }
  } finally {
    await browser.close()
  }
}

async function runWithPuppeteer(input: z.infer<InputSchema>): Promise<Output> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer') as typeof import('puppeteer')
  const browser = await puppeteer.launch({ headless: input.headless })
  const page = await browser.newPage()

  try {
    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    if (input.wait_for) {
      const ms = parseInt(input.wait_for, 10)
      if (!isNaN(ms)) await new Promise(r => setTimeout(r, ms))
      else await page.waitForSelector(input.wait_for)
    }

    let result = ''
    let screenshotPath: string | undefined

    switch (input.action) {
      case 'navigate':
        result = `Navigated to ${page.url()}`
        break
      case 'screenshot': {
        const { homedir } = await import('os')
        const { join } = await import('path')
        const { mkdirSync } = await import('fs')
        const dir = join(homedir(), '.helios', 'screenshots')
        mkdirSync(dir, { recursive: true })
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        screenshotPath = input.screenshot_path ?? join(dir, `browser-${ts}.png`)
        await page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: true })
        result = `Screenshot saved to ${screenshotPath}`
        break
      }
      case 'extract_text': {
        result = await page.evaluate(() => document.body?.innerText?.trim() ?? '')
        if (result.length > 8000) result = result.slice(0, 8000) + '\n\n[... truncated]'
        break
      }
      case 'click':
        if (!input.selector) throw new Error('selector required')
        await page.click(input.selector)
        result = `Clicked "${input.selector}"`
        break
      case 'type':
        if (!input.selector || !input.text) throw new Error('selector and text required')
        await page.type(input.selector, input.text)
        result = `Typed "${input.text}"`
        break
      case 'scroll':
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        result = 'Scrolled to bottom'
        break
      case 'evaluate':
        if (!input.script) throw new Error('script required')
        result = String(await page.evaluate(input.script))
        break
    }

    return { url: page.url(), action: input.action, result, screenshot_path: screenshotPath, backend: 'puppeteer' }
  } finally {
    await browser.close()
  }
}

async function runWithCurl(input: z.infer<InputSchema>): Promise<Output> {
  // Lightweight fallback — text extraction only
  if (input.action !== 'extract_text' && input.action !== 'navigate') {
    throw new Error(
      `Action "${input.action}" requires playwright or puppeteer.\n` +
      'Install: bun add playwright && bunx playwright install chromium',
    )
  }

  const curl = commandAvailable('curl') ? 'curl' : null
  const wget = commandAvailable('wget') ? 'wget' : null

  if (!curl && !wget) {
    throw new Error('Tidak ada backend browser tersedia (playwright/puppeteer/curl/wget)')
  }

  const cmd = curl
    ? `curl -sL --max-time 15 --user-agent "Mozilla/5.0" "${input.url}"`
    : `wget -qO- --timeout=15 "${input.url}"`

  const { stdout } = spawnSync('sh' , ['-c', cmd], { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 })
  const html = stdout?.toString() ?? ''

  // Very simple HTML → text: strip tags
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n\n[... truncated]' : text
  return {
    url: input.url,
    action: input.action,
    result: truncated,
    backend: curl ? 'curl' : 'wget',
  }
}

export const WebBrowserTool = buildTool({
  name: WEB_BROWSER_TOOL_NAME,
  searchHint: 'open a website, browse the web, click buttons, fill forms',
  maxResultSizeChars: 10_000,
  async description() {
    return 'Open URLs in a headless browser. Navigate, extract text, take screenshots, click elements, type into forms, and run JavaScript. Auto-detects playwright > puppeteer > curl.'
  },
  async prompt() {
    return `Headless browser automation tool for HeliosAE.

Supported actions:
- navigate       : Go to URL and return final URL
- extract_text   : Extract readable text from page (default)
- screenshot     : Save full-page PNG screenshot
- click          : Click a CSS selector
- type           : Type text into an input field
- scroll         : Scroll to bottom of page
- evaluate       : Run arbitrary JavaScript and return result

Backends (auto-detected, best first):
  1. playwright  — install: bun add playwright && bunx playwright install chromium
  2. puppeteer   — install: bun add puppeteer
  3. curl/wget   — always available (text-only fallback)

Examples:
  WebBrowser(url="https://github.com", action="extract_text")
  WebBrowser(url="https://example.com", action="screenshot")
  WebBrowser(url="https://form.example", action="type", selector="#email", text="me@email.com")`
  },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema(): OutputSchema { return outputSchema() },
  userFacingName() { return 'WebBrowser' },
  isEnabled() { return true },
  isConcurrencySafe() { return false },
  isReadOnly() { return true },
  renderToolUseMessage(input: z.infer<InputSchema>) {
    return `🌐 ${input.action} → ${input.url}`
  },
  async call(input: z.infer<InputSchema>) {
    let result: Output

    if (hasPlaywright()) {
      result = await runWithPlaywright(input)
    } else if (hasPuppeteer()) {
      result = await runWithPuppeteer(input)
    } else {
      result = await runWithCurl(input)
    }

    return { data: result }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { url, action, result, backend } = content as Output
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `[WebBrowser:${action} via ${backend}]\nURL: ${url}\n\n${result}`,
    }
  },
} satisfies ToolDef<InputSchema, Output>)

export default WebBrowserTool

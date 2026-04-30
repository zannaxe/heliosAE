// HeliosAE stub — @ant/computer-use-swift (macOS Swift native module)
// Not available on Windows. Computer-use is disabled on HeliosAE.

export interface ComputerUseAPI {
  screenshot(displayId?: number): Promise<{ base64: string; width: number; height: number }>
  listInstalledApps(): Promise<Array<{ bundleId: string; name: string; path: string }>>
  listRunningApps(): Promise<Array<{ bundleId: string; name: string; pid: number }>>
  activateApp(bundleId: string): Promise<void>
  prepareDisplay(displayId: number): Promise<void>
}

export const ComputerUseAPI: { create(): ComputerUseAPI } = {
  create: () => ({
    screenshot: async () => ({ base64: '', width: 1280, height: 800 }),
    listInstalledApps: async () => [],
    listRunningApps: async () => [],
    activateApp: async () => {},
    prepareDisplay: async () => {},
  }),
}

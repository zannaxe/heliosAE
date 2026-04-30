// HeliosAE stub — @ant/computer-use-input (macOS Rust/enigo native module)
// Not available on Windows. Computer-use is disabled on HeliosAE.

export interface ComputerUseInputAPI {
  mouseMove(x: number, y: number): Promise<void>
  mouseClick(x: number, y: number, button?: string): Promise<void>
  keyPress(key: string): Promise<void>
  typeText(text: string): Promise<void>
  getFrontmostApp(): Promise<{ bundleId: string; name: string } | null>
}

export interface ComputerUseInput {
  create(): ComputerUseInputAPI
}

export const ComputerUseInput: ComputerUseInput = {
  create: () => ({
    mouseMove: async () => {},
    mouseClick: async () => {},
    keyPress: async () => {},
    typeText: async () => {},
    getFrontmostApp: async () => null,
  }),
}

export const ComputerUseInputAPI = ComputerUseInput

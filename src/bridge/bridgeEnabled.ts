// HeliosAE stub — bridge removed, local-only mode
export async function getBridgeDisabledReason(): Promise<string> {
  return 'HeliosAE runs locally — remote bridge not available.'
}
export function isBridgeEnabled(): boolean { return false }
export function isCcrMirrorEnabled(): boolean { return false }
export function checkBridgeMinVersion(): boolean { return false }
export function isEnvLessBridgeEnabled(): boolean { return false }

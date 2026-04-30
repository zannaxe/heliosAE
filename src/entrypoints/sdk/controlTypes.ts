// HeliosAE stub — SDK control types
export type SDKControlMessage = { type: 'stop' } | { type: 'continue' }
export type SDKStreamEvent = { type: string; data?: unknown }

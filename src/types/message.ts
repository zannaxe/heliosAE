// HeliosAE stub — types/message.ts (not in source leak, reconstructed)
// Covers all types imported across codebase

import type { ContentBlockParam, MessageParam } from '@anthropic-ai/sdk/resources/messages.mjs'

// Base UUID type
type UUID = string

// Core message content types
export type AssistantMessage = {
  type: 'assistant'
  message: { role: 'assistant'; content: string | ContentBlockParam[] }
  uuid: UUID
  timestamp: number
  isMeta?: boolean
  isCompactSummary?: boolean
  toolUseResult?: unknown
  isVisibleInTranscriptOnly?: boolean
}

export type UserMessage = {
  type: 'user'
  message: MessageParam
  uuid: UUID
  timestamp: number
  isMeta?: boolean
  isCompactSummary?: boolean
  toolUseResult?: unknown
  isVisibleInTranscriptOnly?: boolean
}

export type SystemMessage = {
  type: 'system'
  subtype: string
  content?: string
  uuid: UUID
  timestamp?: number
  isMeta?: boolean
  compactMetadata?: unknown
  [key: string]: unknown
}

export type SystemInformationalMessage = SystemMessage & {
  subtype: 'informational'
  content: string
}

export type SystemAPIErrorMessage = SystemMessage & {
  subtype: 'api_error'
  error: { type: string; message: string }
}

export type SystemBridgeStatusMessage = SystemMessage & {
  subtype: 'bridge_status'
}

export type SystemMemorySavedMessage = SystemMessage & {
  subtype: 'memory_saved'
  memorySaved: { path: string; content: string }
}

export type SystemThinkingMessage = SystemMessage & {
  subtype: 'thinking'
}

export type SystemTurnDurationMessage = SystemMessage & {
  subtype: 'turn_duration'
  durationMs: number
}

export type SystemStopHookSummaryMessage = SystemMessage & {
  subtype: 'stop_hook_summary'
}

export type AttachmentMessage = {
  type: 'attachment'
  uuid: UUID
  timestamp?: number
  [key: string]: unknown
}

export type ProgressMessage = {
  type: 'progress'
  uuid: UUID
  timestamp?: number
  toolUseID?: string
  [key: string]: unknown
}

export type HookResultMessage = {
  type: 'hook_result'
  uuid: UUID
  timestamp?: number
  [key: string]: unknown
}

export type QueueOperationMessage = {
  type: 'queue_operation'
  uuid: UUID
  timestamp?: number
  [key: string]: unknown
}

export type GroupedToolUseMessage = {
  type: 'grouped_tool_use'
  uuid: UUID
  timestamp?: number
  [key: string]: unknown
}

export type CollapsedReadSearchGroup = {
  type: 'collapsed_read_search'
  messages: NormalizedAssistantMessage[]
  uuid: UUID
}

// Union types
export type Message =
  | AssistantMessage
  | UserMessage
  | SystemMessage
  | AttachmentMessage
  | ProgressMessage
  | HookResultMessage
  | QueueOperationMessage
  | GroupedToolUseMessage

export type NormalizedMessage = Message

export type NormalizedAssistantMessage = AssistantMessage

export type NormalizedUserMessage = UserMessage

export type RenderableMessage = Message | CollapsedReadSearchGroup

export type PartialCompactDirection = 'before' | 'after' | null

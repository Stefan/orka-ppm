/**
 * Help Chat Components
 * Export all help chat related components
 */

export { HelpChat, default as HelpChatComponent } from '../HelpChat'
export { HelpChatToggle, HelpChatToggleCompact, default as HelpChatToggleComponent } from '../HelpChatToggle'

// Re-export types for convenience
export type {
  ChatMessage,
  QuickAction,
  SourceReference,
  ProactiveTip,
  HelpChatState,
  PageContext,
  HelpChatUserPreferences
} from '../../types/help-chat'
/**
 * useRealtimePMR Hook
 * 
 * Manages WebSocket connections for real-time PMR collaboration
 * Handles user presence, live editing, cursor tracking, and conflict resolution
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { 
  CollaborationEvent, 
  CursorPosition, 
  Comment,
  Conflict 
} from '../components/pmr/types'

export interface ActiveUser {
  id: string
  name: string
  email?: string
  color: string
  lastActivity: string
}

export interface RealtimePMRState {
  isConnected: boolean
  isReconnecting: boolean
  activeUsers: ActiveUser[]
  cursors: Map<string, CursorPosition>
  comments: Comment[]
  conflicts: Conflict[]
  connectionError: string | null
}

export interface RealtimePMRActions {
  broadcastSectionUpdate: (sectionId: string, content: any) => void
  broadcastCursorPosition: (sectionId: string, position: { x: number; y: number }) => void
  addComment: (sectionId: string, content: string, position?: { x: number; y: number }) => void
  resolveComment: (commentId: string) => void
  resolveConflict: (conflictId: string, resolution: 'merge' | 'overwrite' | 'manual', selectedContent?: any) => void
  reconnect: () => void
  disconnect: () => void
}

interface UseRealtimePMROptions {
  reportId: string
  userId: string
  userName: string
  userEmail?: string
  accessToken: string
  onSectionUpdate?: (sectionId: string, content: any, userId: string) => void
  onUserJoined?: (user: ActiveUser) => void
  onUserLeft?: (userId: string) => void
  onCommentAdded?: (comment: Comment) => void
  onConflictDetected?: (conflict: Conflict) => void
  autoReconnect?: boolean
  maxReconnectAttempts?: number
}

export function useRealtimePMR(options: UseRealtimePMROptions): [RealtimePMRState, RealtimePMRActions] {
  const {
    reportId,
    userId,
    userName,
    userEmail,
    accessToken,
    onSectionUpdate,
    onUserJoined,
    onUserLeft,
    onCommentAdded,
    onConflictDetected,
    autoReconnect = true,
    maxReconnectAttempts = 5
  } = options

  // State
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Refs
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Generate user color
  const getUserColor = useCallback(() => {
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#14B8A6', // teal
      '#F97316', // orange
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }, [])

  // Send message via WebSocket
  const sendMessage = useCallback((message: CollaborationEvent) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }, [])

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: CollaborationEvent = JSON.parse(event.data)
      
      switch (message.type) {
        case 'user_joined':
          const newUser: ActiveUser = {
            id: message.user_id,
            name: message.data.user_name || 'Anonymous',
            email: message.data.user_email,
            color: message.data.color || getUserColor(),
            lastActivity: message.timestamp
          }
          
          setActiveUsers(prev => {
            const exists = prev.some(u => u.id === message.user_id)
            if (exists) return prev
            return [...prev, newUser]
          })
          
          onUserJoined?.(newUser)
          break

        case 'user_left':
          setActiveUsers(prev => prev.filter(u => u.id !== message.user_id))
          setCursors(prev => {
            const newCursors = new Map(prev)
            newCursors.delete(message.user_id)
            return newCursors
          })
          onUserLeft?.(message.user_id)
          break

        case 'section_update':
          if (message.user_id !== userId) {
            onSectionUpdate?.(
              message.data.section_id,
              message.data.content,
              message.user_id
            )
          }
          break

        case 'cursor_position':
          if (message.user_id !== userId) {
            const cursorData: CursorPosition = {
              user_id: message.user_id,
              user_name: message.data.user_name,
              section_id: message.data.section_id,
              position: message.data.position,
              color: message.data.color
            }
            
            setCursors(prev => {
              const newCursors = new Map(prev)
              newCursors.set(message.user_id, cursorData)
              return newCursors
            })
          }
          break

        case 'comment_add':
          const comment: Comment = {
            id: message.data.comment_id,
            user_id: message.user_id,
            user_name: message.data.user_name,
            content: message.data.content,
            section_id: message.data.section_id,
            position: message.data.position,
            created_at: message.timestamp,
            resolved: false
          }
          
          setComments(prev => [...prev, comment])
          onCommentAdded?.(comment)
          break

        case 'comment_resolve':
          setComments(prev => prev.map(c => 
            c.id === message.data.comment_id
              ? { ...c, resolved: true, resolved_by: message.user_id, resolved_at: message.timestamp }
              : c
          ))
          break

        case 'conflict_detected':
          const conflict: Conflict = {
            id: message.data.conflict_id,
            section_id: message.data.section_id,
            conflicting_users: message.data.conflicting_users,
            conflict_type: message.data.conflict_type,
            original_content: message.data.original_content,
            conflicting_changes: message.data.conflicting_changes,
            resolved: false
          }
          
          setConflicts(prev => [...prev, conflict])
          onConflictDetected?.(conflict)
          break

        case 'conflict_resolved':
          setConflicts(prev => prev.map(c => 
            c.id === message.data.conflict_id
              ? { 
                  ...c, 
                  resolved: true, 
                  resolved_by: message.user_id, 
                  resolved_at: message.timestamp,
                  resolution_strategy: message.data.resolution_strategy
                }
              : c
          ))
          break

        case 'sync':
          // Handle full sync from server
          if (message.data.active_users) {
            setActiveUsers(message.data.active_users)
          }
          if (message.data.comments) {
            setComments(message.data.comments)
          }
          if (message.data.conflicts) {
            setConflicts(message.data.conflicts)
          }
          break

        default:
          console.warn('Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }, [userId, getUserColor, onSectionUpdate, onUserJoined, onUserLeft, onCommentAdded, onConflictDetected])

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendMessage({
          type: 'heartbeat' as any,
          user_id: userId,
          timestamp: new Date().toISOString(),
          data: {}
        })
      }
    }, 30000) // Send heartbeat every 30 seconds
  }, [userId, sendMessage])

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!accessToken || !reportId) {
      console.warn('Cannot connect: Missing access token or report ID')
      return
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsHost = process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_WS_HOST || 'orka-ppm.onrender.com'
        : 'localhost:8000'
      
      const wsUrl = `${wsProtocol}//${wsHost}/ws/reports/pmr/${reportId}/collaborate?token=${accessToken}`
      
      console.log('🔌 Connecting to WebSocket:', wsUrl)
      const websocket = new WebSocket(wsUrl)
      
      websocket.onopen = () => {
        console.log('✅ WebSocket connected')
        setIsConnected(true)
        setIsReconnecting(false)
        setConnectionError(null)
        reconnectAttemptsRef.current = 0
        
        // Send initial join message
        const joinMessage: CollaborationEvent = {
          type: 'user_joined',
          user_id: userId,
          timestamp: new Date().toISOString(),
          data: {
            user_name: userName,
            user_email: userEmail,
            color: getUserColor()
          }
        }
        websocket.send(JSON.stringify(joinMessage))
        
        // Start heartbeat
        startHeartbeat()
      }
      
      websocket.onmessage = handleMessage
      
      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setConnectionError('Connection error occurred')
      }
      
      websocket.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason)
        setIsConnected(false)
        stopHeartbeat()
        wsRef.current = null
        
        // Attempt reconnection if enabled and not a normal closure
        if (autoReconnect && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          setIsReconnecting(true)
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
          
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError('Maximum reconnection attempts reached')
        }
      }
      
      wsRef.current = websocket
    } catch (error) {
      console.error('Error creating WebSocket:', error)
      setConnectionError('Failed to create connection')
    }
  }, [accessToken, reportId, userId, userName, userEmail, autoReconnect, maxReconnectAttempts, getUserColor, handleMessage, startHeartbeat, stopHeartbeat])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Send leave message
      sendMessage({
        type: 'user_left',
        user_id: userId,
        timestamp: new Date().toISOString(),
        data: {}
      })
      
      wsRef.current.close(1000, 'User disconnected')
      wsRef.current = null
    }
    
    stopHeartbeat()
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    setIsConnected(false)
    setIsReconnecting(false)
  }, [userId, sendMessage, stopHeartbeat])

  // Actions
  const broadcastSectionUpdate = useCallback((sectionId: string, content: any) => {
    sendMessage({
      type: 'section_update',
      user_id: userId,
      timestamp: new Date().toISOString(),
      data: {
        section_id: sectionId,
        content
      }
    })
  }, [userId, sendMessage])

  const broadcastCursorPosition = useCallback((sectionId: string, position: { x: number; y: number }) => {
    sendMessage({
      type: 'cursor_position',
      user_id: userId,
      timestamp: new Date().toISOString(),
      data: {
        section_id: sectionId,
        position,
        user_name: userName,
        color: activeUsers.find(u => u.id === userId)?.color || getUserColor()
      }
    })
  }, [userId, userName, activeUsers, getUserColor, sendMessage])

  const addComment = useCallback((sectionId: string, content: string, position?: { x: number; y: number }) => {
    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    sendMessage({
      type: 'comment_add',
      user_id: userId,
      timestamp: new Date().toISOString(),
      data: {
        comment_id: commentId,
        section_id: sectionId,
        content,
        position,
        user_name: userName
      }
    })
  }, [userId, userName, sendMessage])

  const resolveComment = useCallback((commentId: string) => {
    sendMessage({
      type: 'comment_resolve' as any,
      user_id: userId,
      timestamp: new Date().toISOString(),
      data: {
        comment_id: commentId
      }
    })
  }, [userId, sendMessage])

  const resolveConflict = useCallback((
    conflictId: string, 
    resolution: 'merge' | 'overwrite' | 'manual', 
    selectedContent?: any
  ) => {
    sendMessage({
      type: 'conflict_resolved' as any,
      user_id: userId,
      timestamp: new Date().toISOString(),
      data: {
        conflict_id: conflictId,
        resolution_strategy: resolution,
        selected_content: selectedContent
      }
    })
  }, [userId, sendMessage])

  // Connect on mount
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, []) // Only run on mount/unmount

  // State object
  const state: RealtimePMRState = {
    isConnected,
    isReconnecting,
    activeUsers,
    cursors,
    comments,
    conflicts,
    connectionError
  }

  // Actions object
  const actions: RealtimePMRActions = {
    broadcastSectionUpdate,
    broadcastCursorPosition,
    addComment,
    resolveComment,
    resolveConflict,
    reconnect: connect,
    disconnect
  }

  return [state, actions]
}

'use client'

/**
 * WebSocket Service for Real-time Chart Data Streaming
 * Provides reliable WebSocket connections with automatic reconnection,
 * data buffering, and performance optimization for large datasets
 */

export interface WebSocketMessage {
  type: 'data' | 'error' | 'status' | 'config'
  payload: any
  timestamp: number
  id?: string
}

export interface ChartDataPoint {
  timestamp: number
  value: number
  label?: string
  metadata?: Record<string, any>
}

export interface WebSocketConfig {
  url: string
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatInterval: number
  bufferSize: number
  enableCompression: boolean
}

export interface ConnectionStatus {
  connected: boolean
  reconnecting: boolean
  lastConnected?: Date
  reconnectAttempts: number
  latency: number
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void
export type ConnectionStatusHandler = (status: ConnectionStatus) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private config: WebSocketConfig
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map()
  private statusHandlers: ConnectionStatusHandler[] = []
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private messageBuffer: WebSocketMessage[] = []
  private status: ConnectionStatus = {
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
    latency: 0
  }
  private lastPingTime: number = 0

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || 'ws://localhost:8080/ws',
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      bufferSize: config.bufferSize || 1000,
      enableCompression: config.enableCompression || true,
      ...config
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws?.readyState === WebSocket.OPEN) {
          resolve()
          return
        }

        this.ws = new WebSocket(this.config.url)

        this.ws.onopen = () => {
          this.status = {
            connected: true,
            reconnecting: false,
            lastConnected: new Date(),
            reconnectAttempts: 0,
            latency: 0
          }
          
          this.notifyStatusHandlers()
          this.startHeartbeat()
          this.flushMessageBuffer()
          
          console.log('WebSocket connected to:', this.config.url)
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onclose = (event) => {
          this.handleClose(event)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.status = {
      connected: false,
      reconnecting: false,
      reconnectAttempts: 0,
      latency: 0
    }
    
    this.notifyStatusHandlers()
  }

  /**
   * Send message to WebSocket server
   */
  send(message: Omit<WebSocketMessage, 'timestamp' | 'id'>): boolean {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now(),
      id: this.generateMessageId()
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(fullMessage))
        return true
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
        this.bufferMessage(fullMessage)
        return false
      }
    } else {
      this.bufferMessage(fullMessage)
      return false
    }
  }

  /**
   * Subscribe to specific message types
   */
  on(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    
    this.eventHandlers.get(eventType)!.push(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(handler: ConnectionStatusHandler): () => void {
    this.statusHandlers.push(handler)

    // Return unsubscribe function
    return () => {
      const index = this.statusHandlers.indexOf(handler)
      if (index > -1) {
        this.statusHandlers.splice(index, 1)
      }
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status }
  }

  /**
   * Request specific chart data stream
   */
  subscribeToChart(chartId: string, config?: { interval?: number; maxPoints?: number }): void {
    this.send({
      type: 'config',
      payload: {
        action: 'subscribe',
        chartId,
        config: {
          interval: config?.interval || 1000,
          maxPoints: config?.maxPoints || 100
        }
      }
    })
  }

  /**
   * Unsubscribe from chart data stream
   */
  unsubscribeFromChart(chartId: string): void {
    this.send({
      type: 'config',
      payload: {
        action: 'unsubscribe',
        chartId
      }
    })
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      // Handle pong response for latency calculation
      if (message.type === 'status' && message.payload?.type === 'pong') {
        this.status.latency = Date.now() - this.lastPingTime
        this.notifyStatusHandlers()
        return
      }

      // Notify event handlers
      const handlers = this.eventHandlers.get(message.type) || []
      handlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('Error in WebSocket event handler:', error)
        }
      })

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  private handleClose(event: CloseEvent): void {
    this.status.connected = false
    this.notifyStatusHandlers()

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Attempt reconnection if not a clean close
    if (event.code !== 1000 && this.status.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.attemptReconnect()
    }
  }

  private attemptReconnect(): void {
    if (this.status.reconnecting) return

    this.status.reconnecting = true
    this.status.reconnectAttempts++
    this.notifyStatusHandlers()

    console.log(`Attempting to reconnect (${this.status.reconnectAttempts}/${this.config.maxReconnectAttempts})...`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
        .then(() => {
          this.status.reconnecting = false
          this.notifyStatusHandlers()
        })
        .catch(() => {
          this.status.reconnecting = false
          if (this.status.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.attemptReconnect()
          } else {
            console.error('Max reconnection attempts reached')
            this.notifyStatusHandlers()
          }
        })
    }, this.config.reconnectInterval)
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now()
        this.send({
          type: 'status',
          payload: { type: 'ping' }
        })
      }
    }, this.config.heartbeatInterval)
  }

  private bufferMessage(message: WebSocketMessage): void {
    this.messageBuffer.push(message)
    
    // Limit buffer size
    if (this.messageBuffer.length > this.config.bufferSize) {
      this.messageBuffer.shift()
    }
  }

  private flushMessageBuffer(): void {
    while (this.messageBuffer.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageBuffer.shift()!
      try {
        this.ws.send(JSON.stringify(message))
      } catch (error) {
        console.error('Failed to flush buffered message:', error)
        break
      }
    }
  }

  private notifyStatusHandlers(): void {
    this.statusHandlers.forEach(handler => {
      try {
        handler(this.status)
      } catch (error) {
        console.error('Error in status handler:', error)
      }
    })
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Singleton instance for global use
let globalWebSocketService: WebSocketService | null = null

export const getWebSocketService = (config?: Partial<WebSocketConfig>): WebSocketService => {
  if (!globalWebSocketService) {
    globalWebSocketService = new WebSocketService(config)
  }
  return globalWebSocketService
}

export default WebSocketService
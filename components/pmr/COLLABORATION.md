# Real-Time Collaboration Components

This document describes the real-time collaboration features for the Enhanced PMR system.

## Overview

The collaboration system enables multiple users to work on PMR reports simultaneously with real-time updates, cursor tracking, commenting, and conflict resolution.

## Components

### 1. useRealtimePMR Hook

**Location**: `hooks/useRealtimePMR.ts`

A custom React hook that manages WebSocket connections for real-time collaboration.

**Features**:
- Automatic WebSocket connection management
- Reconnection with exponential backoff
- Heartbeat mechanism to keep connections alive
- Event broadcasting and handling
- User presence tracking
- Cursor position synchronization
- Comment management
- Conflict detection and resolution

**Usage**:
```typescript
const [realtimeState, realtimeActions] = useRealtimePMR({
  reportId: 'report-123',
  userId: 'user-456',
  userName: 'John Doe',
  userEmail: 'john@example.com',
  accessToken: 'jwt-token',
  onSectionUpdate: (sectionId, content, userId) => {
    // Handle section updates from other users
  },
  onConflictDetected: (conflict) => {
    // Handle editing conflicts
  }
})
```

**State**:
- `isConnected`: WebSocket connection status
- `isReconnecting`: Whether reconnection is in progress
- `activeUsers`: List of currently active users
- `cursors`: Map of user cursor positions
- `comments`: List of comments
- `conflicts`: List of unresolved conflicts
- `connectionError`: Connection error message if any

**Actions**:
- `broadcastSectionUpdate(sectionId, content)`: Broadcast section changes
- `broadcastCursorPosition(sectionId, position)`: Share cursor position
- `addComment(sectionId, content, position?)`: Add a comment
- `resolveComment(commentId)`: Mark comment as resolved
- `resolveConflict(conflictId, resolution, selectedContent?)`: Resolve editing conflict
- `reconnect()`: Manually trigger reconnection
- `disconnect()`: Close WebSocket connection

### 2. CollaborationPanel Component

**Location**: `components/pmr/CollaborationPanel.tsx`

A sidebar panel displaying collaboration features with three tabs:

**Users Tab**:
- Shows all active users with their avatars and colors
- Displays last activity timestamp
- Shows online status indicators

**Comments Tab**:
- Add new comments to specific sections
- View all unresolved comments
- Resolve comments (only by comment author)
- Real-time comment synchronization

**Conflicts Tab**:
- Lists all unresolved editing conflicts
- Shows conflicting users and changes
- Provides resolution options:
  - Use Latest: Apply the most recent change
  - Merge Changes: Attempt automatic merge
  - Resolve Manually: Mark as resolved for manual editing

**Props**:
```typescript
interface CollaborationPanelProps {
  activeUsers: ActiveUser[]
  comments: Comment[]
  conflicts: Conflict[]
  currentUserId: string
  onAddComment: (sectionId: string, content: string, position?: { x: number; y: number }) => void
  onResolveComment: (commentId: string) => void
  onResolveConflict: (conflictId: string, resolution: 'merge' | 'overwrite' | 'manual', selectedContent?: any) => void
  className?: string
}
```

### 3. CursorTracker Component

**Location**: `components/pmr/CursorTracker.tsx`

Displays live cursor positions of other users during collaborative editing.

**Features**:
- Real-time cursor position updates
- User-specific colors for easy identification
- User name labels next to cursors
- Smooth transitions between positions

**Props**:
```typescript
interface CursorTrackerProps {
  cursors: Map<string, CursorPosition>
  currentUserId: string
  containerRef?: React.RefObject<HTMLElement>
}
```

### 4. ConflictResolutionModal Component

**Location**: `components/pmr/ConflictResolutionModal.tsx`

A modal dialog for resolving editing conflicts when multiple users edit the same section simultaneously.

**Features**:
- Displays original content and all conflicting changes
- Shows user information and timestamps for each change
- Allows selection of preferred change
- Provides multiple resolution strategies
- Visual diff comparison

**Props**:
```typescript
interface ConflictResolutionModalProps {
  conflict: Conflict
  isOpen: boolean
  onClose: () => void
  onResolve: (conflictId: string, resolution: 'merge' | 'overwrite' | 'manual', selectedContent?: any) => void
}
```

## WebSocket Protocol

### Connection

```
wss://host/ws/reports/pmr/{reportId}/collaborate?token={accessToken}
```

### Message Types

#### User Joined
```json
{
  "type": "user_joined",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "color": "#3B82F6"
  }
}
```

#### User Left
```json
{
  "type": "user_left",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:35:00Z",
  "data": {}
}
```

#### Section Update
```json
{
  "type": "section_update",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:32:00Z",
  "data": {
    "section_id": "executive-summary",
    "content": "Updated content..."
  }
}
```

#### Cursor Position
```json
{
  "type": "cursor_position",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:32:05Z",
  "data": {
    "section_id": "executive-summary",
    "position": { "x": 150, "y": 200 },
    "user_name": "John Doe",
    "color": "#3B82F6"
  }
}
```

#### Comment Add
```json
{
  "type": "comment_add",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:33:00Z",
  "data": {
    "comment_id": "comment-456",
    "section_id": "executive-summary",
    "content": "This needs revision",
    "position": { "x": 100, "y": 150 },
    "user_name": "John Doe"
  }
}
```

#### Comment Resolve
```json
{
  "type": "comment_resolve",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:34:00Z",
  "data": {
    "comment_id": "comment-456"
  }
}
```

#### Conflict Detected
```json
{
  "type": "conflict_detected",
  "user_id": "system",
  "timestamp": "2026-01-15T10:35:00Z",
  "data": {
    "conflict_id": "conflict-789",
    "section_id": "executive-summary",
    "conflicting_users": ["user-123", "user-456"],
    "conflict_type": "simultaneous_edit",
    "original_content": "...",
    "conflicting_changes": [
      {
        "user_id": "user-123",
        "content": "...",
        "timestamp": "2026-01-15T10:34:50Z"
      },
      {
        "user_id": "user-456",
        "content": "...",
        "timestamp": "2026-01-15T10:34:52Z"
      }
    ]
  }
}
```

#### Conflict Resolved
```json
{
  "type": "conflict_resolved",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:36:00Z",
  "data": {
    "conflict_id": "conflict-789",
    "resolution_strategy": "overwrite",
    "selected_content": "..."
  }
}
```

#### Heartbeat
```json
{
  "type": "heartbeat",
  "user_id": "user-123",
  "timestamp": "2026-01-15T10:35:00Z",
  "data": {}
}
```

#### Sync
```json
{
  "type": "sync",
  "user_id": "system",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "report": { /* full report data */ },
    "active_users": [ /* user list */ ],
    "comments": [ /* comment list */ ],
    "conflicts": [ /* conflict list */ ]
  }
}
```

## Integration Example

```typescript
import { useRealtimePMR } from '../hooks/useRealtimePMR'
import CollaborationPanel from '../components/pmr/CollaborationPanel'
import CursorTracker from '../components/pmr/CursorTracker'
import ConflictResolutionModal from '../components/pmr/ConflictResolutionModal'

function PMRPage() {
  const { session, user } = useAuth()
  const [currentReport, setCurrentReport] = useState<PMRReport | null>(null)
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize real-time collaboration
  const [realtimeState, realtimeActions] = useRealtimePMR({
    reportId: currentReport?.id || '',
    userId: user?.id || '',
    userName: user?.email || 'Anonymous',
    userEmail: user?.email,
    accessToken: session?.access_token || '',
    onSectionUpdate: (sectionId, content, userId) => {
      // Update local report state
      setCurrentReport(prev => ({
        ...prev,
        sections: prev.sections.map(s => 
          s.section_id === sectionId 
            ? { ...s, content, modified_by: userId }
            : s
        )
      }))
    },
    onConflictDetected: (conflict) => {
      setSelectedConflict(conflict)
      setShowConflictModal(true)
    }
  })

  return (
    <div ref={containerRef}>
      {/* Cursor tracking overlay */}
      <CursorTracker
        cursors={realtimeState.cursors}
        currentUserId={user?.id || ''}
        containerRef={containerRef}
      />

      {/* Conflict resolution modal */}
      {selectedConflict && (
        <ConflictResolutionModal
          conflict={selectedConflict}
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          onResolve={realtimeActions.resolveConflict}
        />
      )}

      {/* Main content */}
      <div className="flex">
        {/* Editor */}
        <div className="flex-1">
          {/* Your editor component */}
        </div>

        {/* Collaboration panel */}
        <CollaborationPanel
          activeUsers={realtimeState.activeUsers}
          comments={realtimeState.comments}
          conflicts={realtimeState.conflicts}
          currentUserId={user?.id || ''}
          onAddComment={realtimeActions.addComment}
          onResolveComment={realtimeActions.resolveComment}
          onResolveConflict={realtimeActions.resolveConflict}
        />
      </div>
    </div>
  )
}
```

## Backend Requirements

The backend must implement the WebSocket endpoint at `/ws/reports/pmr/{reportId}/collaborate` with:

1. Authentication via query parameter token
2. Message broadcasting to all connected clients for the same report
3. Conflict detection when multiple users edit the same section
4. User presence tracking
5. Message persistence for offline users
6. Heartbeat monitoring to detect disconnected clients

## Performance Considerations

- WebSocket messages are kept minimal to reduce bandwidth
- Cursor position updates are throttled to avoid flooding
- Heartbeat interval is set to 30 seconds
- Automatic reconnection with exponential backoff
- Connection pooling for multiple reports
- Message buffering during reconnection

## Security

- All WebSocket connections require valid JWT tokens
- User permissions are validated on the backend
- Section-level access control
- Audit trail for all collaboration events
- Rate limiting to prevent abuse

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 13+)
- WebSocket fallback: Long polling (if needed)

## Testing

See `__tests__/pmr-collaboration.test.tsx` for unit tests and integration tests.

## Future Enhancements

- Voice/video chat integration
- Screen sharing for collaborative review
- Presence indicators in editor (who's editing what)
- Collaborative cursor following
- Undo/redo synchronization
- Offline editing with conflict resolution on reconnect
- Mobile-optimized collaboration UI

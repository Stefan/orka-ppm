# Real-Time Collaboration Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PMR Page                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    useRealtimePMR Hook                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           WebSocket Connection Manager              │  │  │
│  │  │  • Auto-connect/reconnect                           │  │  │
│  │  │  • Heartbeat (30s)                                  │  │  │
│  │  │  • Exponential backoff                              │  │  │
│  │  │  • Event broadcasting                               │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  State:                      Actions:                      │  │
│  │  • isConnected               • broadcastSectionUpdate()    │  │
│  │  • activeUsers               • broadcastCursorPosition()   │  │
│  │  • cursors                   • addComment()               │  │
│  │  • comments                  • resolveComment()           │  │
│  │  • conflicts                 • resolveConflict()          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Editor     │  │  AI Insights │  │  CollaborationPanel  │  │
│  │   Panel      │  │    Panel     │  │                      │  │
│  │              │  │              │  │  ┌────────────────┐  │  │
│  │              │  │              │  │  │  Users Tab     │  │  │
│  │              │  │              │  │  │  • Active list │  │  │
│  │              │  │              │  │  │  • Avatars     │  │  │
│  │              │  │              │  │  │  • Status      │  │  │
│  │              │  │              │  │  └────────────────┘  │  │
│  │              │  │              │  │  ┌────────────────┐  │  │
│  │              │  │              │  │  │ Comments Tab   │  │  │
│  │              │  │              │  │  │  • Add/view    │  │  │
│  │              │  │              │  │  │  • Resolve     │  │  │
│  │              │  │              │  │  └────────────────┘  │  │
│  │              │  │              │  │  ┌────────────────┐  │  │
│  │              │  │              │  │  │ Conflicts Tab  │  │  │
│  │              │  │              │  │  │  • List        │  │  │
│  │              │  │              │  │  │  • Resolve UI  │  │  │
│  │              │  │              │  │  └────────────────┘  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    CursorTracker                          │  │
│  │  • Overlay component                                      │  │
│  │  • Shows other users' cursors                            │  │
│  │  • Color-coded with names                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ConflictResolutionModal                      │  │
│  │  • Shows original content                                 │  │
│  │  • Lists conflicting changes                             │  │
│  │  • Resolution strategies                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              │ wss://host/ws/reports/pmr/{id}/collaborate
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Server                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              WebSocket Handler                            │  │
│  │  • Authentication (JWT)                                   │  │
│  │  • Connection management                                  │  │
│  │  • Message broadcasting                                   │  │
│  │  • Conflict detection                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Collaboration Service                        │  │
│  │  • User presence tracking                                 │  │
│  │  • Message persistence                                    │  │
│  │  • Conflict resolution logic                             │  │
│  │  • Audit trail                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Database                               │  │
│  │  • PMR reports                                           │  │
│  │  • Collaboration sessions                                │  │
│  │  • Comments                                              │  │
│  │  • Conflicts                                             │  │
│  │  • Audit logs                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### User Joins Session

```
User A                    Frontend                  Backend
  │                          │                         │
  │──── Load PMR Page ──────>│                         │
  │                          │                         │
  │                          │──── Connect WS ────────>│
  │                          │    (with JWT token)     │
  │                          │                         │
  │                          │<─── Connection OK ──────│
  │                          │                         │
  │                          │──── user_joined ───────>│
  │                          │                         │
  │                          │<─── sync (full state) ──│
  │                          │                         │
  │<─── Show active users ───│                         │
  │                          │                         │
```

### Section Update

```
User A                    Frontend                  Backend                User B
  │                          │                         │                      │
  │──── Edit section ───────>│                         │                      │
  │                          │                         │                      │
  │                          │─ section_update ───────>│                      │
  │                          │                         │                      │
  │                          │                         │─ broadcast ─────────>│
  │                          │                         │                      │
  │                          │                         │                      │──> Update UI
  │                          │                         │                      │
```

### Conflict Detection

```
User A                    Frontend                  Backend                User B
  │                          │                         │                      │
  │──── Edit section ───────>│                         │                      │
  │                          │─ section_update ───────>│                      │
  │                          │                         │<─ section_update ────│<──── Edit same
  │                          │                         │                      │     section
  │                          │                         │                      │
  │                          │                         │ (Detect conflict)    │
  │                          │                         │                      │
  │                          │<─ conflict_detected ────│─ conflict_detected ─>│
  │                          │                         │                      │
  │<─── Show modal ──────────│                         │                      │──> Show modal
  │                          │                         │                      │
  │──── Resolve ────────────>│                         │                      │
  │                          │─ conflict_resolved ────>│                      │
  │                          │                         │                      │
  │                          │                         │─ broadcast ─────────>│
  │                          │                         │                      │──> Update UI
```

### Cursor Tracking

```
User A                    Frontend                  Backend                User B
  │                          │                         │                      │
  │──── Move cursor ────────>│                         │                      │
  │                          │                         │                      │
  │                          │─ cursor_position ──────>│                      │
  │                          │   (throttled)           │                      │
  │                          │                         │                      │
  │                          │                         │─ broadcast ─────────>│
  │                          │                         │                      │
  │                          │                         │                      │──> Show cursor
  │                          │                         │                      │    overlay
```

### Comment Flow

```
User A                    Frontend                  Backend                User B
  │                          │                         │                      │
  │──── Add comment ────────>│                         │                      │
  │                          │                         │                      │
  │                          │─── comment_add ────────>│                      │
  │                          │                         │                      │
  │                          │                         │─ broadcast ─────────>│
  │                          │                         │                      │
  │                          │                         │                      │──> Show comment
  │                          │                         │                      │
  │                          │                         │                      │
  │                          │                         │<─ comment_resolve ───│<──── Resolve
  │                          │                         │                      │
  │                          │<─── broadcast ──────────│                      │
  │                          │                         │                      │
  │<─── Update UI ───────────│                         │                      │
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                      PMR Page Component                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │         useRealtimePMR Hook                        │     │
│  │                                                     │     │
│  │  const [state, actions] = useRealtimePMR({        │     │
│  │    reportId,                                       │     │
│  │    userId,                                         │     │
│  │    userName,                                       │     │
│  │    accessToken,                                    │     │
│  │    onSectionUpdate: (id, content, userId) => {    │     │
│  │      // Update local report state                 │     │
│  │    },                                              │     │
│  │    onConflictDetected: (conflict) => {            │     │
│  │      // Show conflict modal                       │     │
│  │    }                                               │     │
│  │  })                                                │     │
│  └────────────────────────────────────────────────────┘     │
│                          │                                   │
│                          │ provides state & actions          │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Child Components                           │     │
│  │                                                     │     │
│  │  <CursorTracker                                    │     │
│  │    cursors={state.cursors}                        │     │
│  │    currentUserId={userId}                         │     │
│  │  />                                                │     │
│  │                                                     │     │
│  │  <CollaborationPanel                               │     │
│  │    activeUsers={state.activeUsers}                │     │
│  │    comments={state.comments}                      │     │
│  │    conflicts={state.conflicts}                    │     │
│  │    onAddComment={actions.addComment}              │     │
│  │    onResolveComment={actions.resolveComment}      │     │
│  │    onResolveConflict={actions.resolveConflict}    │     │
│  │  />                                                │     │
│  │                                                     │     │
│  │  <ConflictResolutionModal                          │     │
│  │    conflict={selectedConflict}                    │     │
│  │    isOpen={showModal}                             │     │
│  │    onResolve={actions.resolveConflict}            │     │
│  │  />                                                │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## State Management Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    useRealtimePMR Hook                        │
│                                                               │
│  WebSocket Events          State Updates          Actions    │
│       │                         │                    │        │
│       ▼                         ▼                    ▼        │
│  ┌─────────┐              ┌─────────┐         ┌─────────┐   │
│  │ onopen  │─────────────>│Connected│         │broadcast│   │
│  └─────────┘              └─────────┘         │Section  │   │
│                                                │Update   │   │
│  ┌─────────┐              ┌─────────┐         └─────────┘   │
│  │onmessage│─────────────>│ Active  │                        │
│  │         │              │ Users   │         ┌─────────┐   │
│  │user_    │              │ Updated │         │broadcast│   │
│  │joined   │              └─────────┘         │Cursor   │   │
│  └─────────┘                                  │Position │   │
│                           ┌─────────┐         └─────────┘   │
│  ┌─────────┐              │ Cursors │                        │
│  │cursor_  │─────────────>│ Updated │         ┌─────────┐   │
│  │position │              └─────────┘         │  add    │   │
│  └─────────┘                                  │Comment  │   │
│                           ┌─────────┐         └─────────┘   │
│  ┌─────────┐              │Comments │                        │
│  │comment_ │─────────────>│ Updated │         ┌─────────┐   │
│  │add      │              └─────────┘         │resolve  │   │
│  └─────────┘                                  │Comment  │   │
│                           ┌─────────┐         └─────────┘   │
│  ┌─────────┐              │Conflicts│                        │
│  │conflict_│─────────────>│ Updated │         ┌─────────┐   │
│  │detected │              └─────────┘         │resolve  │   │
│  └─────────┘                                  │Conflict │   │
│                                               └─────────┘   │
│  ┌─────────┐              ┌─────────┐                        │
│  │onclose  │─────────────>│Reconnect│         ┌─────────┐   │
│  │         │              │ Logic   │         │reconnect│   │
│  └─────────┘              └─────────┘         └─────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Throttling Strategy

```
Cursor Movement Events:
  User moves cursor ──> Throttle (100ms) ──> Broadcast position
                              │
                              └──> Prevents flooding network
                                   with too many updates

Heartbeat:
  Every 30 seconds ──> Send heartbeat ──> Keep connection alive
                              │
                              └──> Detect disconnected clients
```

### Reconnection Strategy

```
Connection Lost:
  Attempt 1: Wait 1s    ──> Reconnect
  Attempt 2: Wait 2s    ──> Reconnect
  Attempt 3: Wait 4s    ──> Reconnect
  Attempt 4: Wait 8s    ──> Reconnect
  Attempt 5: Wait 10s   ──> Reconnect
  Max reached           ──> Show error, stop trying
```

### State Optimization

```
React Hooks:
  useState    ──> Local component state
  useCallback ──> Memoized functions (prevent re-renders)
  useMemo     ──> Computed values (unresolvedComments, etc.)
  useRef      ──> WebSocket instance (no re-renders)
  useEffect   ──> Lifecycle management (connect/cleanup)
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Security Layers                         │
│                                                              │
│  1. Authentication                                           │
│     ┌──────────────────────────────────────────────┐        │
│     │ JWT Token in WebSocket URL                   │        │
│     │ wss://host/ws/...?token={jwt}               │        │
│     └──────────────────────────────────────────────┘        │
│                          │                                   │
│                          ▼                                   │
│  2. Authorization                                            │
│     ┌──────────────────────────────────────────────┐        │
│     │ Backend validates:                           │        │
│     │ • User has access to report                  │        │
│     │ • User permissions (view/edit/admin)         │        │
│     │ • Section-level access control               │        │
│     └──────────────────────────────────────────────┘        │
│                          │                                   │
│                          ▼                                   │
│  3. Message Validation                                       │
│     ┌──────────────────────────────────────────────┐        │
│     │ Backend validates:                           │        │
│     │ • Message format                             │        │
│     │ • User can perform action                    │        │
│     │ • Data integrity                             │        │
│     └──────────────────────────────────────────────┘        │
│                          │                                   │
│                          ▼                                   │
│  4. Rate Limiting                                            │
│     ┌──────────────────────────────────────────────┐        │
│     │ Prevent abuse:                               │        │
│     │ • Max messages per second                    │        │
│     │ • Max connections per user                   │        │
│     │ • Throttle cursor updates                    │        │
│     └──────────────────────────────────────────────┘        │
│                          │                                   │
│                          ▼                                   │
│  5. Audit Trail                                              │
│     ┌──────────────────────────────────────────────┐        │
│     │ Log all events:                              │        │
│     │ • User actions                               │        │
│     │ • Timestamps                                 │        │
│     │ • IP addresses                               │        │
│     │ • Changes made                               │        │
│     └──────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Scalability Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Horizontal Scaling                        │
│                                                              │
│  Multiple Backend Instances:                                 │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ Backend  │    │ Backend  │    │ Backend  │             │
│  │ Server 1 │    │ Server 2 │    │ Server 3 │             │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘             │
│       │               │               │                     │
│       └───────────────┼───────────────┘                     │
│                       │                                     │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │  Redis Pub/Sub  │                            │
│              │                 │                            │
│              │  • Broadcast    │                            │
│              │  • Presence     │                            │
│              │  • State sync   │                            │
│              └─────────────────┘                            │
│                       │                                     │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │    Database     │                            │
│              │                 │                            │
│              │  • Reports      │                            │
│              │  • Sessions     │                            │
│              │  • Comments     │                            │
│              │  • Conflicts    │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

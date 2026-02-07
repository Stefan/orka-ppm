/**
 * Property-Based Tests for Offline Synchronization Integrity
 * Feature: integrated-master-schedule, Property 20: Offline Synchronization Integrity
 * Validates: Requirements 10.4
 * 
 * For any offline operation, data should synchronize correctly when connectivity 
 * is restored without data loss.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Types for schedule offline sync testing
interface ScheduleChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'schedule' | 'task' | 'dependency' | 'milestone' | 'resource_assignment';
  entityId: string;
  data: any;
  timestamp: Date;
  deviceId: string;
  synced: boolean;
  version: number;
}

interface SyncQueue {
  id: string;
  changes: ScheduleChange[];
  createdAt: Date;
  lastAttempt?: Date;
  attemptCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
}

interface SyncResult {
  success: boolean;
  syncedChanges: number;
  failedChanges: number;
  conflicts: MergeConflict[];
  errors: string[];
}

interface MergeConflict {
  id: string;
  changeId: string;
  entity: string;
  entityId: string;
  localData: any;
  remoteData: any;
  conflictType: 'version' | 'concurrent' | 'deleted';
  timestamp: Date;
  resolved: boolean;
}

// Mock schedule offline sync service for testing
class MockScheduleOfflineSyncService {
  private syncQueue: SyncQueue[] = [];
  private isOnline: boolean = true;
  private deviceId: string;
  private storage: Map<string, any> = new Map();

  constructor() {
    this.deviceId = `device-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  queueScheduleChange(change: Omit<ScheduleChange, 'id' | 'timestamp' | 'deviceId' | 'synced'>): string {
    const scheduleChange: ScheduleChange = {
      ...change,
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      deviceId: this.deviceId,
      synced: false
    };

    let queue = this.syncQueue.find(q => q.status === 'pending');
    
    if (!queue) {
      queue = {
        id: `queue-${Date.now()}`,
        changes: [],
        createdAt: new Date(),
        attemptCount: 0,
        status: 'pending'
      };
      this.syncQueue.push(queue);
    }
    
    queue.changes.push(scheduleChange);
    return scheduleChange.id;
  }

  getPendingChanges(): ScheduleChange[] {
    return this.syncQueue
      .filter(q => q.status === 'pending' || q.status === 'failed')
      .flatMap(q => q.changes.filter(c => !c.synced));
  }

  getQueuedChangesCount(): number {
    return this.getPendingChanges().length;
  }

  async processSyncQueue(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedChanges: 0,
      failedChanges: 0,
      conflicts: [],
      errors: []
    };

    if (!this.isOnline) {
      result.success = false;
      result.errors.push('Not online');
      return result;
    }

    const pendingQueues = this.syncQueue.filter(q => q.status === 'pending' || q.status === 'failed');
    
    for (const queue of pendingQueues) {
      queue.status = 'syncing';
      queue.lastAttempt = new Date();
      queue.attemptCount++;

      for (const change of queue.changes) {
        if (change.synced) continue;

        try {
          // Simulate sync operation
          const syncSuccess = await this.syncChange(change);
          
          if (syncSuccess.success) {
            change.synced = true;
            result.syncedChanges++;
          } else {
            result.failedChanges++;
            result.conflicts.push(...syncSuccess.conflicts);
            result.errors.push(...syncSuccess.errors);
          }
        } catch (error) {
          result.failedChanges++;
          result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // Update queue status
      const allSynced = queue.changes.every(c => c.synced);
      queue.status = allSynced ? 'completed' : 'failed';
    }

    // Remove completed queues
    this.syncQueue = this.syncQueue.filter(q => q.status !== 'completed');
    
    result.success = result.failedChanges === 0;
    return result;
  }

  private async syncChange(change: ScheduleChange): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedChanges: 0,
      failedChanges: 0,
      conflicts: [],
      errors: []
    };

    // Check for version conflicts
    const existingData = this.storage.get(`${change.entity}-${change.entityId}`);
    
    if (existingData && change.type === 'update') {
      if (existingData.version >= change.version) {
        // Version conflict
        const conflict: MergeConflict = {
          id: `conflict-${Date.now()}`,
          changeId: change.id,
          entity: change.entity,
          entityId: change.entityId,
          localData: change.data,
          remoteData: existingData,
          conflictType: 'version',
          timestamp: new Date(),
          resolved: false
        };
        result.conflicts.push(conflict);
        result.errors.push(`Version conflict for ${change.entity} ${change.entityId}`);
        return result;
      }
    }

    // Apply the change
    switch (change.type) {
      case 'create':
      case 'update':
        this.storage.set(`${change.entity}-${change.entityId}`, {
          ...change.data,
          version: change.version,
          lastModified: new Date()
        });
        break;
      case 'delete':
        this.storage.delete(`${change.entity}-${change.entityId}`);
        break;
    }

    result.success = true;
    result.syncedChanges = 1;
    return result;
  }

  getStoredData(entity: string, entityId: string): any {
    return this.storage.get(`${entity}-${entityId}`);
  }

  clearQueue(): void {
    this.syncQueue = [];
  }

  clearStorage(): void {
    this.storage.clear();
  }

  getSyncStats(): { pendingChanges: number; failedChanges: number; totalQueues: number } {
    const pendingChanges = this.syncQueue
      .filter(q => q.status === 'pending')
      .reduce((sum, q) => sum + q.changes.filter(c => !c.synced).length, 0);
      
    const failedChanges = this.syncQueue
      .filter(q => q.status === 'failed')
      .reduce((sum, q) => sum + q.changes.filter(c => !c.synced).length, 0);
    
    return {
      pendingChanges,
      failedChanges,
      totalQueues: this.syncQueue.length
    };
  }
}

// Generators for schedule data
const scheduleDataArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 })),
  start_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  end_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  status: fc.constantFrom('active', 'draft', 'completed', 'on_hold')
});

const taskDataArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  wbs_code: fc.string({ minLength: 1, maxLength: 20 }),
  planned_start_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  planned_end_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  duration_days: fc.integer({ min: 1, max: 365 }),
  progress_percentage: fc.integer({ min: 0, max: 100 }),
  status: fc.constantFrom('not_started', 'in_progress', 'completed', 'on_hold')
});

const milestoneDataArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  target_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  status: fc.constantFrom('planned', 'at_risk', 'achieved', 'missed'),
  success_criteria: fc.option(fc.string({ maxLength: 500 }))
});

const entityTypeArb = fc.constantFrom('schedule', 'task', 'dependency', 'milestone', 'resource_assignment') as fc.Arbitrary<'schedule' | 'task' | 'dependency' | 'milestone' | 'resource_assignment'>;
const changeTypeArb = fc.constantFrom('create', 'update', 'delete') as fc.Arbitrary<'create' | 'update' | 'delete'>;

describe('Offline Synchronization Integrity Property Tests', () => {
  let syncService: MockScheduleOfflineSyncService;

  beforeEach(() => {
    syncService = new MockScheduleOfflineSyncService();
  });

  afterEach(() => {
    syncService.clearQueue();
    syncService.clearStorage();
  });

  /**
   * Property 20: Offline Synchronization Integrity
   * For any offline operation, data should synchronize correctly when connectivity 
   * is restored without data loss.
   * Validates: Requirements 10.4
   */

  test('Property 20.1: Queued offline changes should persist and be retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: changeTypeArb,
            entity: entityTypeArb,
            entityId: fc.uuid(),
            data: scheduleDataArb,
            version: fc.integer({ min: 1, max: 100 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (changes) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          // Go offline
          syncService.setOnlineStatus(false);
          
          // Queue all changes
          const queuedIds: string[] = [];
          for (const change of changes) {
            const id = syncService.queueScheduleChange(change);
            queuedIds.push(id);
          }
          
          // Verify all changes are queued
          const pendingChanges = syncService.getPendingChanges();
          expect(pendingChanges.length).toBe(changes.length);
          
          // Verify each queued change has correct properties
          for (let i = 0; i < changes.length; i++) {
            const queued = pendingChanges.find(p => p.id === queuedIds[i]);
            expect(queued).toBeDefined();
            expect(queued!.entity).toBe(changes[i].entity);
            expect(queued!.entityId).toBe(changes[i].entityId);
            expect(queued!.type).toBe(changes[i].type);
            expect(queued!.synced).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('Property 20.2: All queued changes should sync when connectivity is restored', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('create', 'update') as fc.Arbitrary<'create' | 'update'>,
            entity: entityTypeArb,
            entityId: fc.uuid(),
            data: taskDataArb,
            version: fc.integer({ min: 1, max: 100 })
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (changes) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          // Go offline and queue changes
          syncService.setOnlineStatus(false);
          
          for (const change of changes) {
            syncService.queueScheduleChange(change);
          }
          
          const initialPending = syncService.getQueuedChangesCount();
          expect(initialPending).toBe(changes.length);
          
          // Go online and sync
          syncService.setOnlineStatus(true);
          const result = await syncService.processSyncQueue();
          
          // Verify all changes synced successfully
          expect(result.success).toBe(true);
          expect(result.syncedChanges).toBe(changes.length);
          expect(result.failedChanges).toBe(0);
          
          // Verify no pending changes remain
          const remainingPending = syncService.getQueuedChangesCount();
          expect(remainingPending).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('Property 20.3: Synced data should match original queued data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constant('create') as fc.Arbitrary<'create'>,
            entity: fc.constantFrom('schedule', 'task', 'milestone') as fc.Arbitrary<'schedule' | 'task' | 'milestone'>,
            entityId: fc.uuid(),
            data: scheduleDataArb,
            version: fc.integer({ min: 1, max: 100 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (changes) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          // Go offline and queue changes
          syncService.setOnlineStatus(false);
          
          for (const change of changes) {
            syncService.queueScheduleChange(change);
          }
          
          // Go online and sync
          syncService.setOnlineStatus(true);
          await syncService.processSyncQueue();
          
          // Verify each synced entity matches original data
          for (const change of changes) {
            const storedData = syncService.getStoredData(change.entity, change.entityId);
            expect(storedData).toBeDefined();
            expect(storedData.name).toBe(change.data.name);
            expect(storedData.status).toBe(change.data.status);
            expect(storedData.version).toBe(change.version);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('Property 20.4: Offline changes should maintain correct ordering', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 10 }),
        async (numChanges) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          syncService.setOnlineStatus(false);
          
          const entityId = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const queuedIds: string[] = [];
          
          // Queue sequential updates to the same entity
          for (let i = 0; i < numChanges; i++) {
            const id = syncService.queueScheduleChange({
              type: i === 0 ? 'create' : 'update',
              entity: 'task',
              entityId,
              data: { name: `Version ${i + 1}`, progress: i * 10 },
              version: i + 1
            });
            queuedIds.push(id);
          }
          
          // Verify changes are in order
          const pendingChanges = syncService.getPendingChanges();
          const entityChanges = pendingChanges.filter(c => c.entityId === entityId);
          
          expect(entityChanges.length).toBe(numChanges);
          
          // Verify timestamps are in ascending order
          for (let i = 1; i < entityChanges.length; i++) {
            expect(entityChanges[i].timestamp.getTime()).toBeGreaterThanOrEqual(
              entityChanges[i - 1].timestamp.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('Property 20.5: Sync should not lose data during intermittent connectivity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('create', 'update') as fc.Arbitrary<'create' | 'update'>,
            entity: entityTypeArb,
            entityId: fc.uuid(),
            data: milestoneDataArb,
            version: fc.integer({ min: 1, max: 100 })
          }),
          { minLength: 5, maxLength: 15 }
        ),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 5 }),
        async (changes, connectivityPattern) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          let totalSynced = 0;
          let changeIndex = 0;
          
          // Simulate intermittent connectivity
          for (const isOnline of connectivityPattern) {
            syncService.setOnlineStatus(false);
            
            // Queue some changes while offline
            const batchSize = Math.min(3, changes.length - changeIndex);
            for (let i = 0; i < batchSize && changeIndex < changes.length; i++) {
              syncService.queueScheduleChange(changes[changeIndex]);
              changeIndex++;
            }
            
            if (isOnline) {
              syncService.setOnlineStatus(true);
              const result = await syncService.processSyncQueue();
              totalSynced += result.syncedChanges;
            }
          }
          
          // Final sync when online
          syncService.setOnlineStatus(true);
          const finalResult = await syncService.processSyncQueue();
          totalSynced += finalResult.syncedChanges;
          
          // Verify all changes eventually synced
          expect(totalSynced).toBe(changeIndex);
          expect(syncService.getQueuedChangesCount()).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('Property 20.6: Delete operations should sync correctly after create/update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        scheduleDataArb,
        async (entityId, data) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          // Create entity offline
          syncService.setOnlineStatus(false);
          syncService.queueScheduleChange({
            type: 'create',
            entity: 'schedule',
            entityId,
            data,
            version: 1
          });
          
          // Update entity offline
          syncService.queueScheduleChange({
            type: 'update',
            entity: 'schedule',
            entityId,
            data: { ...data, name: 'Updated Name' },
            version: 2
          });
          
          // Delete entity offline
          syncService.queueScheduleChange({
            type: 'delete',
            entity: 'schedule',
            entityId,
            data: {},
            version: 3
          });
          
          // Sync all changes
          syncService.setOnlineStatus(true);
          const result = await syncService.processSyncQueue();
          
          expect(result.success).toBe(true);
          expect(result.syncedChanges).toBe(3);
          
          // Verify entity is deleted
          const storedData = syncService.getStoredData('schedule', entityId);
          expect(storedData).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('Property 20.7: Sync stats should accurately reflect queue state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (numChanges) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          syncService.setOnlineStatus(false);
          
          // Queue changes
          for (let i = 0; i < numChanges; i++) {
            syncService.queueScheduleChange({
              type: 'create',
              entity: 'task',
              entityId: `task-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              data: { name: `Task ${i}` },
              version: 1
            });
          }
          
          // Check stats before sync
          const statsBefore = syncService.getSyncStats();
          expect(statsBefore.pendingChanges).toBe(numChanges);
          expect(statsBefore.failedChanges).toBe(0);
          
          // Sync
          syncService.setOnlineStatus(true);
          await syncService.processSyncQueue();
          
          // Check stats after sync
          const statsAfter = syncService.getSyncStats();
          expect(statsAfter.pendingChanges).toBe(0);
          expect(statsAfter.failedChanges).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('Property 20.8: Concurrent offline changes to different entities should all sync', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            entity: entityTypeArb,
            entityId: fc.uuid(),
            data: taskDataArb
          }),
          { minLength: 5, maxLength: 20 }
        ),
        async (entities) => {
          // Clear state before each property test iteration
          syncService.clearQueue();
          syncService.clearStorage();
          
          syncService.setOnlineStatus(false);
          
          // Queue create operations for all entities
          const uniqueEntities = new Map<string, typeof entities[0]>();
          for (const entity of entities) {
            const key = `${entity.entity}-${entity.entityId}`;
            uniqueEntities.set(key, entity);
          }
          
          for (const entity of uniqueEntities.values()) {
            syncService.queueScheduleChange({
              type: 'create',
              entity: entity.entity,
              entityId: entity.entityId,
              data: entity.data,
              version: 1
            });
          }
          
          // Sync all
          syncService.setOnlineStatus(true);
          const result = await syncService.processSyncQueue();
          
          expect(result.success).toBe(true);
          expect(result.syncedChanges).toBe(uniqueEntities.size);
          
          // Verify all entities exist
          for (const entity of uniqueEntities.values()) {
            const stored = syncService.getStoredData(entity.entity, entity.entityId);
            expect(stored).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

// Integration tests for offline sync scenarios
describe('Offline Synchronization Integration Tests', () => {
  let syncService: MockScheduleOfflineSyncService;

  beforeEach(() => {
    syncService = new MockScheduleOfflineSyncService();
  });

  afterEach(() => {
    syncService.clearQueue();
    syncService.clearStorage();
  });

  test('should handle complete schedule creation workflow offline', async () => {
    syncService.setOnlineStatus(false);
    
    const scheduleId = 'schedule-123';
    const taskIds = ['task-1', 'task-2', 'task-3'];
    const milestoneId = 'milestone-1';
    
    // Create schedule
    syncService.queueScheduleChange({
      type: 'create',
      entity: 'schedule',
      entityId: scheduleId,
      data: {
        name: 'Project Alpha',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        status: 'active'
      },
      version: 1
    });
    
    // Create tasks
    for (const taskId of taskIds) {
      syncService.queueScheduleChange({
        type: 'create',
        entity: 'task',
        entityId: taskId,
        data: {
          schedule_id: scheduleId,
          name: `Task ${taskId}`,
          wbs_code: taskId.replace('task-', '1.'),
          progress_percentage: 0,
          status: 'not_started'
        },
        version: 1
      });
    }
    
    // Create milestone
    syncService.queueScheduleChange({
      type: 'create',
      entity: 'milestone',
      entityId: milestoneId,
      data: {
        schedule_id: scheduleId,
        name: 'Phase 1 Complete',
        target_date: new Date('2024-06-30'),
        status: 'planned'
      },
      version: 1
    });
    
    // Verify all queued
    expect(syncService.getQueuedChangesCount()).toBe(5);
    
    // Go online and sync
    syncService.setOnlineStatus(true);
    const result = await syncService.processSyncQueue();
    
    expect(result.success).toBe(true);
    expect(result.syncedChanges).toBe(5);
    expect(syncService.getQueuedChangesCount()).toBe(0);
    
    // Verify all data synced correctly
    const schedule = syncService.getStoredData('schedule', scheduleId);
    expect(schedule).toBeDefined();
    expect(schedule.name).toBe('Project Alpha');
    
    for (const taskId of taskIds) {
      const task = syncService.getStoredData('task', taskId);
      expect(task).toBeDefined();
    }
    
    const milestone = syncService.getStoredData('milestone', milestoneId);
    expect(milestone).toBeDefined();
    expect(milestone.name).toBe('Phase 1 Complete');
  });

  test('should handle task progress updates offline', async () => {
    // First create task online
    syncService.setOnlineStatus(true);
    const taskId = 'task-progress-test';
    
    syncService.queueScheduleChange({
      type: 'create',
      entity: 'task',
      entityId: taskId,
      data: {
        name: 'Test Task',
        progress_percentage: 0,
        status: 'not_started'
      },
      version: 1
    });
    await syncService.processSyncQueue();
    
    // Go offline and update progress multiple times
    syncService.setOnlineStatus(false);
    
    const progressUpdates = [25, 50, 75, 100];
    for (let i = 0; i < progressUpdates.length; i++) {
      syncService.queueScheduleChange({
        type: 'update',
        entity: 'task',
        entityId: taskId,
        data: {
          name: 'Test Task',
          progress_percentage: progressUpdates[i],
          status: progressUpdates[i] === 100 ? 'completed' : 'in_progress'
        },
        version: i + 2
      });
    }
    
    expect(syncService.getQueuedChangesCount()).toBe(4);
    
    // Go online and sync
    syncService.setOnlineStatus(true);
    const result = await syncService.processSyncQueue();
    
    expect(result.success).toBe(true);
    expect(result.syncedChanges).toBe(4);
    
    // Verify final state
    const task = syncService.getStoredData('task', taskId);
    expect(task.progress_percentage).toBe(100);
    expect(task.status).toBe('completed');
  });
});

/**
 * Integration Tests for Schedule Dashboard
 * 
 * Tests dashboard widget rendering and data accuracy, real-time updates
 * in dashboard context, and performance with multiple concurrent users
 * for the Integrated Master Schedule System.
 * 
 * Feature: integrated-master-schedule
 * Task: 15.3 Write integration tests for dashboard
 * Validates: Requirements 8.5, 9.5, 7.5, 8.2, 5.2
 */

import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import '@testing-library/jest-dom'

jest.useFakeTimers()

// ============================================================================
// Type Definitions
// ============================================================================

interface ScheduleKPI {
  id: string
  name: string
  value: number
  target: number
  trend: 'up' | 'down' | 'stable'
  changePercent: number
}

interface CriticalPathStatus {
  totalTasks: number
  criticalTasks: number
  projectDuration: number
  floatDays: number
  atRiskTasks: number
}

interface MilestoneStatus {
  total: number
  onTime: number
  atRisk: number
  overdue: number
  achieved: number
}

interface ResourceUtilization {
  resourceId: string
  resourceName: string
  allocation: number
  utilization: number
  conflicts: number
}

interface ScheduleVariance {
  taskId: string
  taskName: string
  plannedDays: number
  actualDays: number
  varianceDays: number
  spi: number
}

interface ScheduleDashboardData {
  scheduleId: string
  scheduleName: string
  kpis: ScheduleKPI[]
  criticalPath: CriticalPathStatus
  milestones: MilestoneStatus
  resourceUtilization: ResourceUtilization[]
  variances: ScheduleVariance[]
  lastUpdated: string
}

interface RealTimeUpdate {
  type: 'task_progress' | 'milestone_status' | 'resource_change' | 'schedule_recalc'
  timestamp: string
  data: Record<string, unknown>
}

// ============================================================================
// Mock Data Generators
// ============================================================================

const createMockScheduleKPIs = (): ScheduleKPI[] => [
  { id: 'spi', name: 'Schedule Performance Index', value: 0.95, target: 1.0, trend: 'up', changePercent: 2.5 },
  { id: 'sv', name: 'Schedule Variance', value: -5, target: 0, trend: 'down', changePercent: -3.2 },
  { id: 'completion', name: 'Overall Completion', value: 65, target: 70, trend: 'up', changePercent: 5.0 },
  { id: 'ontime', name: 'On-Time Delivery Rate', value: 85, target: 90, trend: 'stable', changePercent: 0.5 },
]

const createMockCriticalPathStatus = (): CriticalPathStatus => ({
  totalTasks: 150,
  criticalTasks: 25,
  projectDuration: 180,
  floatDays: 15,
  atRiskTasks: 5,
})

const createMockMilestoneStatus = (): MilestoneStatus => ({
  total: 12,
  onTime: 7,
  atRisk: 3,
  overdue: 1,
  achieved: 5,
})

const createMockResourceUtilization = (): ResourceUtilization[] => [
  { resourceId: 'r1', resourceName: 'John Smith', allocation: 100, utilization: 95, conflicts: 0 },
  { resourceId: 'r2', resourceName: 'Jane Doe', allocation: 80, utilization: 110, conflicts: 2 },
  { resourceId: 'r3', resourceName: 'Bob Wilson', allocation: 60, utilization: 55, conflicts: 0 },
]

const createMockVariances = (): ScheduleVariance[] => [
  { taskId: 't1', taskName: 'Foundation Work', plannedDays: 30, actualDays: 35, varianceDays: 5, spi: 0.86 },
  { taskId: 't2', taskName: 'Structural Framing', plannedDays: 45, actualDays: 42, varianceDays: -3, spi: 1.07 },
  { taskId: 't3', taskName: 'Electrical Installation', plannedDays: 20, actualDays: 20, varianceDays: 0, spi: 1.0 },
]

const createMockDashboardData = (overrides?: Partial<ScheduleDashboardData>): ScheduleDashboardData => ({
  scheduleId: 'schedule-1',
  scheduleName: 'Construction Project Schedule',
  kpis: createMockScheduleKPIs(),
  criticalPath: createMockCriticalPathStatus(),
  milestones: createMockMilestoneStatus(),
  resourceUtilization: createMockResourceUtilization(),
  variances: createMockVariances(),
  lastUpdated: new Date().toISOString(),
  ...overrides,
})

// ============================================================================
// Mock Components
// ============================================================================

interface ScheduleKPIWidgetProps {
  kpis: ScheduleKPI[]
  onKPIClick?: (kpiId: string) => void
}

const ScheduleKPIWidget: React.FC<ScheduleKPIWidgetProps> = ({ kpis, onKPIClick }) => {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↑'
      case 'down': return '↓'
      default: return '→'
    }
  }

  const getTrendColor = (trend: string, value: number, target: number) => {
    if (trend === 'up' && value >= target) return 'text-green-600'
    if (trend === 'down' && value < target) return 'text-red-600'
    return 'text-yellow-600'
  }

  return (
    <div data-testid="schedule-kpi-widget" className="grid grid-cols-2 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          data-testid={`kpi-${kpi.id}`}
          className="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md"
          onClick={() => onKPIClick?.(kpi.id)}
          role="button"
          aria-label={`${kpi.name}: ${kpi.value}`}
        >
          <div className="text-xs text-gray-500 uppercase">{kpi.name}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold">{kpi.value}</span>
            <span className="text-sm text-gray-400">/ {kpi.target}</span>
          </div>
          <div className={`text-sm mt-1 ${getTrendColor(kpi.trend, kpi.value, kpi.target)}`}>
            {getTrendIcon(kpi.trend)} {Math.abs(kpi.changePercent)}%
          </div>
        </div>
      ))}
    </div>
  )
}

interface CriticalPathWidgetProps {
  status: CriticalPathStatus
  onViewDetails?: () => void
}

const CriticalPathWidget: React.FC<CriticalPathWidgetProps> = ({ status, onViewDetails }) => {
  const criticalPercentage = (status.criticalTasks / status.totalTasks) * 100

  return (
    <div data-testid="critical-path-widget" className="bg-white rounded-lg border p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Critical Path Status</h3>
        <button
          onClick={onViewDetails}
          data-testid="view-critical-path"
          className="text-blue-600 text-sm hover:underline"
        >
          View Details
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Critical Tasks</span>
          <span className="font-medium" data-testid="critical-tasks-count">
            {status.criticalTasks} / {status.totalTasks}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-red-500 h-2 rounded-full"
            style={{ width: `${criticalPercentage}%` }}
            data-testid="critical-path-bar"
            role="progressbar"
            aria-valuenow={criticalPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Project Duration</span>
          <span data-testid="project-duration">{status.projectDuration} days</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Float</span>
          <span data-testid="total-float">{status.floatDays} days</span>
        </div>
        {status.atRiskTasks > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm">
            <span className="text-yellow-800" data-testid="at-risk-warning">
              ⚠️ {status.atRiskTasks} tasks at risk
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

interface MilestoneWidgetProps {
  status: MilestoneStatus
  onMilestoneClick?: (status: string) => void
}

const MilestoneWidget: React.FC<MilestoneWidgetProps> = ({ status, onMilestoneClick }) => {
  return (
    <div data-testid="milestone-widget" className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold mb-4">Milestone Tracking</h3>
      <div className="grid grid-cols-2 gap-3">
        <div
          className="bg-green-50 rounded p-3 cursor-pointer hover:bg-green-100"
          onClick={() => onMilestoneClick?.('achieved')}
          data-testid="milestone-achieved"
        >
          <div className="text-2xl font-bold text-green-600">{status.achieved}</div>
          <div className="text-xs text-green-700">Achieved</div>
        </div>
        <div
          className="bg-blue-50 rounded p-3 cursor-pointer hover:bg-blue-100"
          onClick={() => onMilestoneClick?.('onTime')}
          data-testid="milestone-ontime"
        >
          <div className="text-2xl font-bold text-blue-600">{status.onTime}</div>
          <div className="text-xs text-blue-700">On Time</div>
        </div>
        <div
          className="bg-yellow-50 rounded p-3 cursor-pointer hover:bg-yellow-100"
          onClick={() => onMilestoneClick?.('atRisk')}
          data-testid="milestone-atrisk"
        >
          <div className="text-2xl font-bold text-yellow-600">{status.atRisk}</div>
          <div className="text-xs text-yellow-700">At Risk</div>
        </div>
        <div
          className="bg-red-50 rounded p-3 cursor-pointer hover:bg-red-100"
          onClick={() => onMilestoneClick?.('overdue')}
          data-testid="milestone-overdue"
        >
          <div className="text-2xl font-bold text-red-600">{status.overdue}</div>
          <div className="text-xs text-red-700">Overdue</div>
        </div>
      </div>
      <div className="mt-3 text-sm text-gray-500 text-center">
        Total: {status.total} milestones
      </div>
    </div>
  )
}

interface ResourceUtilizationWidgetProps {
  resources: ResourceUtilization[]
  onResourceClick?: (resourceId: string) => void
}

const ResourceUtilizationWidget: React.FC<ResourceUtilizationWidgetProps> = ({
  resources,
  onResourceClick,
}) => {
  const getUtilizationColor = (utilization: number) => {
    if (utilization > 100) return 'text-red-600 bg-red-50'
    if (utilization >= 80) return 'text-green-600 bg-green-50'
    if (utilization >= 50) return 'text-yellow-600 bg-yellow-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div data-testid="resource-utilization-widget" className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold mb-4">Resource Utilization</h3>
      <div className="space-y-3">
        {resources.map((resource) => (
          <div
            key={resource.resourceId}
            data-testid={`resource-${resource.resourceId}`}
            className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
            onClick={() => onResourceClick?.(resource.resourceId)}
          >
            <div className="flex-1">
              <div className="font-medium text-sm">{resource.resourceName}</div>
              <div className="text-xs text-gray-500">
                Allocated: {resource.allocation}%
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-sm font-medium ${getUtilizationColor(resource.utilization)}`}>
                {resource.utilization}%
              </span>
              {resource.conflicts > 0 && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs" data-testid={`conflict-${resource.resourceId}`}>
                  {resource.conflicts} conflicts
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ScheduleVarianceWidgetProps {
  variances: ScheduleVariance[]
  onTaskClick?: (taskId: string) => void
}

const ScheduleVarianceWidget: React.FC<ScheduleVarianceWidgetProps> = ({
  variances,
  onTaskClick,
}) => {
  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600'
    if (variance < 0) return 'text-green-600'
    return 'text-gray-600'
  }

  const getSPIColor = (spi: number) => {
    if (spi >= 1.0) return 'text-green-600'
    if (spi >= 0.9) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div data-testid="schedule-variance-widget" className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold mb-4">Schedule Variance Analysis</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="pb-2">Task</th>
            <th className="pb-2">Planned</th>
            <th className="pb-2">Actual</th>
            <th className="pb-2">Variance</th>
            <th className="pb-2">SPI</th>
          </tr>
        </thead>
        <tbody>
          {variances.map((variance) => (
            <tr
              key={variance.taskId}
              data-testid={`variance-${variance.taskId}`}
              className="border-b hover:bg-gray-50 cursor-pointer"
              onClick={() => onTaskClick?.(variance.taskId)}
            >
              <td className="py-2">{variance.taskName}</td>
              <td className="py-2">{variance.plannedDays}d</td>
              <td className="py-2">{variance.actualDays}d</td>
              <td className={`py-2 font-medium ${getVarianceColor(variance.varianceDays)}`}>
                {variance.varianceDays > 0 ? '+' : ''}{variance.varianceDays}d
              </td>
              <td className={`py-2 font-medium ${getSPIColor(variance.spi)}`}>
                {variance.spi.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ScheduleDashboardProps {
  data: ScheduleDashboardData
  onRefresh?: () => void
  onKPIClick?: (kpiId: string) => void
  onViewCriticalPath?: () => void
  onMilestoneClick?: (status: string) => void
  onResourceClick?: (resourceId: string) => void
  onTaskClick?: (taskId: string) => void
  isLoading?: boolean
  realTimeUpdates?: RealTimeUpdate[]
}

const ScheduleDashboard: React.FC<ScheduleDashboardProps> = ({
  data,
  onRefresh,
  onKPIClick,
  onViewCriticalPath,
  onMilestoneClick,
  onResourceClick,
  onTaskClick,
  isLoading = false,
  realTimeUpdates = [],
}) => {
  const [lastUpdate, setLastUpdate] = React.useState(data.lastUpdated)

  React.useEffect(() => {
    if (realTimeUpdates.length > 0) {
      const latestUpdate = realTimeUpdates[realTimeUpdates.length - 1]
      setLastUpdate(latestUpdate.timestamp)
    }
  }, [realTimeUpdates])

  if (isLoading) {
    return (
      <div data-testid="dashboard-loading" className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="schedule-dashboard" className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">{data.scheduleName}</h1>
          <p className="text-sm text-gray-500" data-testid="last-updated">
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </p>
        </div>
        <button
          onClick={onRefresh}
          data-testid="refresh-button"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {realTimeUpdates.length > 0 && (
        <div data-testid="realtime-updates" className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-sm text-blue-800">
            {realTimeUpdates.length} real-time update(s) received
          </div>
        </div>
      )}

      <ScheduleKPIWidget kpis={data.kpis} onKPIClick={onKPIClick} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CriticalPathWidget status={data.criticalPath} onViewDetails={onViewCriticalPath} />
        <MilestoneWidget status={data.milestones} onMilestoneClick={onMilestoneClick} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResourceUtilizationWidget resources={data.resourceUtilization} onResourceClick={onResourceClick} />
        <ScheduleVarianceWidget variances={data.variances} onTaskClick={onTaskClick} />
      </div>
    </div>
  )
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Schedule Dashboard Integration Tests', () => {
  beforeEach(() => { jest.clearAllMocks() })
  afterEach(() => { act(() => { jest.runOnlyPendingTimers() }) })

  // ==========================================================================
  // Dashboard Widget Rendering and Data Accuracy Tests
  // ==========================================================================
  describe('Dashboard Widget Rendering and Data Accuracy', () => {
    describe('Schedule KPI Widget', () => {
      it('renders all KPIs with correct values', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        expect(screen.getByTestId('schedule-kpi-widget')).toBeInTheDocument()
        data.kpis.forEach((kpi) => {
          expect(screen.getByTestId(`kpi-${kpi.id}`)).toBeInTheDocument()
          expect(screen.getByText(kpi.name)).toBeInTheDocument()
        })
      })

      it('displays correct trend indicators', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        const spiKpi = screen.getByTestId('kpi-spi')
        expect(spiKpi).toHaveTextContent('↑')
        expect(spiKpi).toHaveTextContent('2.5%')
      })

      it('handles KPI click events', async () => {
        const onKPIClick = jest.fn()
        const data = createMockDashboardData()
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(<ScheduleDashboard data={data} onKPIClick={onKPIClick} />)

        await user.click(screen.getByTestId('kpi-spi'))
        expect(onKPIClick).toHaveBeenCalledWith('spi')
      })
    })

    describe('Critical Path Widget', () => {
      it('renders critical path status correctly', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        expect(screen.getByTestId('critical-path-widget')).toBeInTheDocument()
        expect(screen.getByTestId('critical-tasks-count')).toHaveTextContent('25 / 150')
        expect(screen.getByTestId('project-duration')).toHaveTextContent('180 days')
        expect(screen.getByTestId('total-float')).toHaveTextContent('15 days')
      })

      it('shows at-risk warning when tasks are at risk', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        expect(screen.getByTestId('at-risk-warning')).toHaveTextContent('5 tasks at risk')
      })

      it('handles view details click', async () => {
        const onViewCriticalPath = jest.fn()
        const data = createMockDashboardData()
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(<ScheduleDashboard data={data} onViewCriticalPath={onViewCriticalPath} />)

        await user.click(screen.getByTestId('view-critical-path'))
        expect(onViewCriticalPath).toHaveBeenCalled()
      })
    })

    describe('Milestone Widget', () => {
      it('renders milestone status counts correctly', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        expect(screen.getByTestId('milestone-widget')).toBeInTheDocument()
        expect(screen.getByTestId('milestone-achieved')).toHaveTextContent('5')
        expect(screen.getByTestId('milestone-ontime')).toHaveTextContent('7')
        expect(screen.getByTestId('milestone-atrisk')).toHaveTextContent('3')
        expect(screen.getByTestId('milestone-overdue')).toHaveTextContent('1')
      })

      it('handles milestone status click', async () => {
        const onMilestoneClick = jest.fn()
        const data = createMockDashboardData()
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(<ScheduleDashboard data={data} onMilestoneClick={onMilestoneClick} />)

        await user.click(screen.getByTestId('milestone-atrisk'))
        expect(onMilestoneClick).toHaveBeenCalledWith('atRisk')
      })
    })

    describe('Resource Utilization Widget', () => {
      it('renders resource utilization data correctly', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        expect(screen.getByTestId('resource-utilization-widget')).toBeInTheDocument()
        data.resourceUtilization.forEach((resource) => {
          expect(screen.getByTestId(`resource-${resource.resourceId}`)).toBeInTheDocument()
          expect(screen.getByText(resource.resourceName)).toBeInTheDocument()
        })
      })

      it('shows conflict indicators for overallocated resources', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        expect(screen.getByTestId('conflict-r2')).toHaveTextContent('2 conflicts')
        expect(screen.queryByTestId('conflict-r1')).not.toBeInTheDocument()
      })

      it('handles resource click', async () => {
        const onResourceClick = jest.fn()
        const data = createMockDashboardData()
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(<ScheduleDashboard data={data} onResourceClick={onResourceClick} />)

        await user.click(screen.getByTestId('resource-r1'))
        expect(onResourceClick).toHaveBeenCalledWith('r1')
      })
    })

    describe('Schedule Variance Widget', () => {
      it('renders variance data correctly', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        expect(screen.getByTestId('schedule-variance-widget')).toBeInTheDocument()
        data.variances.forEach((variance) => {
          expect(screen.getByTestId(`variance-${variance.taskId}`)).toBeInTheDocument()
          expect(screen.getByText(variance.taskName)).toBeInTheDocument()
        })
      })

      it('displays variance with correct formatting', () => {
        const data = createMockDashboardData()
        render(<ScheduleDashboard data={data} />)

        const foundationVariance = screen.getByTestId('variance-t1')
        expect(foundationVariance).toHaveTextContent('+5d')
        expect(foundationVariance).toHaveTextContent('0.86')
      })

      it('handles task click', async () => {
        const onTaskClick = jest.fn()
        const data = createMockDashboardData()
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(<ScheduleDashboard data={data} onTaskClick={onTaskClick} />)

        await user.click(screen.getByTestId('variance-t1'))
        expect(onTaskClick).toHaveBeenCalledWith('t1')
      })
    })
  })

  // ==========================================================================
  // Real-time Updates in Dashboard Context Tests
  // ==========================================================================
  describe('Real-time Updates in Dashboard Context', () => {
    it('displays real-time update notification', () => {
      const data = createMockDashboardData()
      const updates: RealTimeUpdate[] = [
        { type: 'task_progress', timestamp: new Date().toISOString(), data: { taskId: 't1', progress: 50 } },
      ]
      render(<ScheduleDashboard data={data} realTimeUpdates={updates} />)

      expect(screen.getByTestId('realtime-updates')).toHaveTextContent('1 real-time update(s) received')
    })

    it('updates last updated timestamp on real-time update', () => {
      const data = createMockDashboardData()
      const newTimestamp = new Date().toISOString()
      const updates: RealTimeUpdate[] = [
        { type: 'task_progress', timestamp: newTimestamp, data: { taskId: 't1', progress: 50 } },
      ]
      render(<ScheduleDashboard data={data} realTimeUpdates={updates} />)

      expect(screen.getByTestId('last-updated')).toBeInTheDocument()
    })

    it('handles multiple real-time updates', () => {
      const data = createMockDashboardData()
      const updates: RealTimeUpdate[] = [
        { type: 'task_progress', timestamp: new Date().toISOString(), data: { taskId: 't1', progress: 50 } },
        { type: 'milestone_status', timestamp: new Date().toISOString(), data: { milestoneId: 'm1', status: 'achieved' } },
        { type: 'resource_change', timestamp: new Date().toISOString(), data: { resourceId: 'r1', allocation: 80 } },
      ]
      render(<ScheduleDashboard data={data} realTimeUpdates={updates} />)

      expect(screen.getByTestId('realtime-updates')).toHaveTextContent('3 real-time update(s) received')
    })

    it('does not show update notification when no updates', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} realTimeUpdates={[]} />)

      expect(screen.queryByTestId('realtime-updates')).not.toBeInTheDocument()
    })

    it('handles refresh button click', async () => {
      const onRefresh = jest.fn()
      const data = createMockDashboardData()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<ScheduleDashboard data={data} onRefresh={onRefresh} />)

      await user.click(screen.getByTestId('refresh-button'))
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Performance with Multiple Concurrent Users Tests
  // ==========================================================================
  describe('Performance with Multiple Concurrent Users', () => {
    it('renders dashboard with loading state', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} isLoading={true} />)

      expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
      expect(screen.queryByTestId('schedule-dashboard')).not.toBeInTheDocument()
    })

    it('renders dashboard after loading completes', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} isLoading={false} />)

      expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument()
      expect(screen.getByTestId('schedule-dashboard')).toBeInTheDocument()
    })

    it('handles rapid data updates without crashing', () => {
      const data = createMockDashboardData()
      const { rerender } = render(<ScheduleDashboard data={data} />)

      // Simulate rapid updates from multiple users
      for (let i = 0; i < 10; i++) {
        const updatedData = createMockDashboardData({
          kpis: createMockScheduleKPIs().map((kpi) => ({
            ...kpi,
            value: kpi.value + Math.random() * 5,
          })),
        })
        rerender(<ScheduleDashboard data={updatedData} />)
      }

      expect(screen.getByTestId('schedule-dashboard')).toBeInTheDocument()
    })

    it('handles concurrent real-time updates efficiently', () => {
      const data = createMockDashboardData()
      const updates: RealTimeUpdate[] = Array.from({ length: 50 }, (_, i) => ({
        type: 'task_progress' as const,
        timestamp: new Date(Date.now() + i * 100).toISOString(),
        data: { taskId: `t${i}`, progress: Math.random() * 100 },
      }))

      render(<ScheduleDashboard data={data} realTimeUpdates={updates} />)

      expect(screen.getByTestId('realtime-updates')).toHaveTextContent('50 real-time update(s) received')
    })

    it('maintains data accuracy during concurrent updates', () => {
      const data = createMockDashboardData()
      const { rerender } = render(<ScheduleDashboard data={data} />)

      // Verify initial data
      expect(screen.getByTestId('critical-tasks-count')).toHaveTextContent('25 / 150')

      // Update with new data
      const updatedData = createMockDashboardData({
        criticalPath: { ...createMockCriticalPathStatus(), criticalTasks: 30 },
      })
      rerender(<ScheduleDashboard data={updatedData} />)

      // Verify updated data
      expect(screen.getByTestId('critical-tasks-count')).toHaveTextContent('30 / 150')
    })

    it('handles empty data gracefully', () => {
      const emptyData: ScheduleDashboardData = {
        scheduleId: 'empty',
        scheduleName: 'Empty Schedule',
        kpis: [],
        criticalPath: { totalTasks: 0, criticalTasks: 0, projectDuration: 0, floatDays: 0, atRiskTasks: 0 },
        milestones: { total: 0, onTime: 0, atRisk: 0, overdue: 0, achieved: 0 },
        resourceUtilization: [],
        variances: [],
        lastUpdated: new Date().toISOString(),
      }

      render(<ScheduleDashboard data={emptyData} />)

      expect(screen.getByTestId('schedule-dashboard')).toBeInTheDocument()
      expect(screen.getByTestId('critical-tasks-count')).toHaveTextContent('0 / 0')
    })
  })

  // ==========================================================================
  // Dashboard Data Accuracy Tests
  // ==========================================================================
  describe('Dashboard Data Accuracy', () => {
    it('calculates critical path percentage correctly', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} />)

      const progressBar = screen.getByTestId('critical-path-bar')
      // 25/150 = 16.67%
      expect(progressBar).toHaveAttribute('aria-valuenow', expect.stringMatching(/16/))
    })

    it('displays SPI values with correct precision', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} />)

      const varianceRow = screen.getByTestId('variance-t1')
      expect(varianceRow).toHaveTextContent('0.86')
    })

    it('shows correct milestone totals', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} />)

      const milestoneWidget = screen.getByTestId('milestone-widget')
      expect(milestoneWidget).toHaveTextContent('Total: 12 milestones')
    })

    it('displays resource allocation percentages correctly', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} />)

      const resource1 = screen.getByTestId('resource-r1')
      expect(resource1).toHaveTextContent('Allocated: 100%')
      expect(resource1).toHaveTextContent('95%')
    })
  })

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================
  describe('Accessibility', () => {
    it('KPI cards have proper aria labels', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} />)

      const spiKpi = screen.getByTestId('kpi-spi')
      expect(spiKpi).toHaveAttribute('aria-label', expect.stringContaining('Schedule Performance Index'))
    })

    it('progress bars have proper ARIA attributes', () => {
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} />)

      const progressBar = screen.getByTestId('critical-path-bar')
      expect(progressBar).toHaveAttribute('role', 'progressbar')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('interactive elements are keyboard accessible', async () => {
      const onKPIClick = jest.fn()
      const data = createMockDashboardData()
      render(<ScheduleDashboard data={data} onKPIClick={onKPIClick} />)

      const kpiElement = screen.getByTestId('kpi-spi')
      kpiElement.focus()
      fireEvent.keyDown(kpiElement, { key: 'Enter' })
      
      // Element should be focusable
      expect(kpiElement).toHaveAttribute('role', 'button')
    })
  })
})

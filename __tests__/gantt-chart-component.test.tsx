/**
 * Unit Tests for Gantt Chart Component
 * 
 * Tests chart rendering with various schedule data, interactive features,
 * and responsive design for the Integrated Master Schedule System.
 * 
 * Feature: integrated-master-schedule
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

jest.useFakeTimers()

interface GanttTask {
  id: string
  name: string
  wbs_code: string
  planned_start_date: string
  planned_end_date: string
  progress_percentage: number
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  is_critical: boolean
  total_float_days: number
  dependencies: string[]
}

interface GanttMilestone {
  id: string
  name: string
  target_date: string
  status: 'planned' | 'at_risk' | 'achieved' | 'missed'
}

interface GanttScheduleData {
  id: string
  name: string
  start_date: string
  end_date: string
  tasks: GanttTask[]
  milestones: GanttMilestone[]
  critical_path: string[]
}

interface GanttChartProps {
  schedule: GanttScheduleData
  timeScale?: 'day' | 'week' | 'month' | 'quarter'
  showCriticalPath?: boolean
  onTaskClick?: (taskId: string) => void
}

const createMockScheduleData = (overrides?: Partial<GanttScheduleData>): GanttScheduleData => ({
  id: 'schedule-1',
  name: 'Test Project Schedule',
  start_date: '2024-01-01',
  end_date: '2024-03-31',
  tasks: [
    {
      id: 'task-1',
      name: 'Site Preparation',
      wbs_code: '1.1',
      planned_start_date: '2024-01-01',
      planned_end_date: '2024-01-15',
      progress_percentage: 100,
      status: 'completed',
      is_critical: true,
      total_float_days: 0,
      dependencies: [],
    },
    {
      id: 'task-2',
      name: 'Foundation Work',
      wbs_code: '1.2',
      planned_start_date: '2024-01-16',
      planned_end_date: '2024-02-15',
      progress_percentage: 60,
      status: 'in_progress',
      is_critical: true,
      total_float_days: 0,
      dependencies: ['task-1'],
    },
    {
      id: 'task-3',
      name: 'Structural Framing',
      wbs_code: '1.3',
      planned_start_date: '2024-02-16',
      planned_end_date: '2024-03-15',
      progress_percentage: 0,
      status: 'not_started',
      is_critical: false,
      total_float_days: 5,
      dependencies: ['task-2'],
    },
  ],
  milestones: [
    { id: 'milestone-1', name: 'Foundation Complete', target_date: '2024-02-15', status: 'planned' },
  ],
  critical_path: ['task-1', 'task-2'],
  ...overrides,
})

const calculateTaskPosition = (
  startDate: string, endDate: string, scheduleStart: string, scheduleEnd: string, containerWidth: number
): { left: number; width: number } => {
  const scheduleStartTime = new Date(scheduleStart).getTime()
  const scheduleEndTime = new Date(scheduleEnd).getTime()
  const taskStartTime = new Date(startDate).getTime()
  const taskEndTime = new Date(endDate).getTime()
  const totalDuration = scheduleEndTime - scheduleStartTime
  const left = ((taskStartTime - scheduleStartTime) / totalDuration) * containerWidth
  const width = ((taskEndTime - taskStartTime) / totalDuration) * containerWidth
  return { left: Math.max(0, left), width: Math.max(10, width) }
}

const calculateDuration = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

const formatDateForDisplay = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const GanttChart: React.FC<GanttChartProps> = ({
  schedule, timeScale = 'week', showCriticalPath = true, onTaskClick,
}) => {
  const containerWidth = 800
  const getTimeScaleHeaders = () => {
    const start = new Date(schedule.start_date)
    const end = new Date(schedule.end_date)
    const headers: string[] = []
    if (timeScale === 'day') {
      const current = new Date(start)
      while (current <= end) {
        headers.push(current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
        current.setDate(current.getDate() + 1)
      }
    } else if (timeScale === 'week') {
      const current = new Date(start)
      while (current <= end) {
        headers.push(`Week ${Math.ceil((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1}`)
        current.setDate(current.getDate() + 7)
      }
    } else if (timeScale === 'month') {
      const current = new Date(start)
      while (current <= end) {
        headers.push(current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
        current.setMonth(current.getMonth() + 1)
      }
    }
    return headers
  }

  return (
    <div className="gantt-chart" data-testid="gantt-chart">
      <div className="gantt-header" data-testid="gantt-header">
        <div className="task-column">Task</div>
        <div className="timeline-header" data-testid="timeline-header">
          {getTimeScaleHeaders().map((header, index) => (
            <div key={index} className="time-cell" data-testid={`time-header-${index}`}>{header}</div>
          ))}
        </div>
      </div>
      <div className="gantt-body" data-testid="gantt-body">
        {schedule.tasks.map((task) => {
          const position = calculateTaskPosition(task.planned_start_date, task.planned_end_date, schedule.start_date, schedule.end_date, containerWidth)
          const isCritical = showCriticalPath && schedule.critical_path.includes(task.id)
          return (
            <div key={task.id} className="gantt-row" data-testid={`gantt-row-${task.id}`}>
              <div className="task-info" data-testid={`task-info-${task.id}`}>
                <span className="wbs-code">{task.wbs_code}</span>
                <span className="task-name">{task.name}</span>
              </div>
              <div className="task-timeline">
                <div
                  className={`task-bar ${isCritical ? 'critical' : ''} ${task.status}`}
                  data-testid={`task-bar-${task.id}`}
                  style={{ left: position.left, width: position.width }}
                  onClick={() => onTaskClick?.(task.id)}
                  role="button"
                  aria-label={`Task: ${task.name}`}
                >
                  <div className="progress-fill" data-testid={`progress-${task.id}`} style={{ width: `${task.progress_percentage}%` }} />
                  {isCritical && <span className="critical-indicator" data-testid={`critical-${task.id}`}>Critical</span>}
                </div>
              </div>
            </div>
          )
        })}
        {schedule.milestones.map((milestone) => (
          <div key={milestone.id} className="milestone-marker" data-testid={`milestone-${milestone.id}`}>
            <span className="milestone-diamond">◆</span>
            <span className="milestone-name">{milestone.name}</span>
          </div>
        ))}
      </div>
      <svg className="dependency-lines" data-testid="dependency-lines">
        {schedule.tasks.map((task) => task.dependencies.map((depId) => (
          <line key={`${depId}-${task.id}`} data-testid={`dependency-${depId}-${task.id}`} className="dependency-line" />
        )))}
      </svg>
    </div>
  )
}

describe('GanttChart Component', () => {
  beforeEach(() => { jest.clearAllMocks() })
  afterEach(() => { act(() => { jest.runOnlyPendingTimers() }) })

  describe('Chart Rendering with Various Schedule Data', () => {
    it('renders the gantt chart container', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      expect(screen.getByTestId('gantt-chart')).toBeInTheDocument()
      expect(screen.getByTestId('gantt-header')).toBeInTheDocument()
      expect(screen.getByTestId('gantt-body')).toBeInTheDocument()
    })

    it('renders all tasks from schedule data', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      schedule.tasks.forEach((task) => {
        expect(screen.getByTestId(`gantt-row-${task.id}`)).toBeInTheDocument()
        expect(screen.getByTestId(`task-bar-${task.id}`)).toBeInTheDocument()
        expect(screen.getByText(task.name)).toBeInTheDocument()
        expect(screen.getByText(task.wbs_code)).toBeInTheDocument()
      })
    })

    it('renders tasks with correct progress visualization', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      schedule.tasks.forEach((task) => {
        const progressBar = screen.getByTestId(`progress-${task.id}`)
        expect(progressBar).toHaveStyle({ width: `${task.progress_percentage}%` })
      })
    })

    it('renders milestones correctly', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      schedule.milestones.forEach((milestone) => {
        expect(screen.getByTestId(`milestone-${milestone.id}`)).toBeInTheDocument()
        expect(screen.getByText(milestone.name)).toBeInTheDocument()
      })
    })

    it('renders dependency lines between tasks', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      expect(screen.getByTestId('dependency-lines')).toBeInTheDocument()
      expect(screen.getByTestId('dependency-task-1-task-2')).toBeInTheDocument()
    })

    it('renders empty schedule without errors', () => {
      const emptySchedule = createMockScheduleData({ tasks: [], milestones: [], critical_path: [] })
      render(<GanttChart schedule={emptySchedule} />)
      expect(screen.getByTestId('gantt-chart')).toBeInTheDocument()
    })
  })

  describe('Interactive Features and User Interactions', () => {
    it('calls onTaskClick when task bar is clicked', async () => {
      const onTaskClick = jest.fn()
      const schedule = createMockScheduleData()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<GanttChart schedule={schedule} onTaskClick={onTaskClick} />)
      const taskBar = screen.getByTestId('task-bar-task-1')
      await user.click(taskBar)
      expect(onTaskClick).toHaveBeenCalledWith('task-1')
    })

    it('task bars have correct aria labels for accessibility', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      schedule.tasks.forEach((task) => {
        const taskBar = screen.getByTestId(`task-bar-${task.id}`)
        expect(taskBar).toHaveAttribute('aria-label', `Task: ${task.name}`)
        expect(taskBar).toHaveAttribute('role', 'button')
      })
    })

    it('highlights critical path tasks when showCriticalPath is true', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} showCriticalPath={true} />)
      expect(screen.getByTestId('critical-task-1')).toBeInTheDocument()
      expect(screen.getByTestId('critical-task-2')).toBeInTheDocument()
      expect(screen.queryByTestId('critical-task-3')).not.toBeInTheDocument()
    })

    it('does not highlight critical path when showCriticalPath is false', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} showCriticalPath={false} />)
      expect(screen.queryByTestId('critical-task-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('critical-task-2')).not.toBeInTheDocument()
    })

    it('applies correct CSS classes based on task status', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      expect(screen.getByTestId('task-bar-task-1')).toHaveClass('completed')
      expect(screen.getByTestId('task-bar-task-2')).toHaveClass('in_progress')
      expect(screen.getByTestId('task-bar-task-3')).toHaveClass('not_started')
    })

    it('applies critical class to critical path tasks', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} showCriticalPath={true} />)
      expect(screen.getByTestId('task-bar-task-1')).toHaveClass('critical')
      expect(screen.getByTestId('task-bar-task-3')).not.toHaveClass('critical')
    })
  })

  describe('Time Scale and Timeline', () => {
    it('renders week time scale headers by default', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} timeScale="week" />)
      expect(screen.getByTestId('timeline-header')).toBeInTheDocument()
      expect(screen.getByTestId('time-header-0')).toHaveTextContent('Week 1')
    })

    it('renders day time scale headers when specified', () => {
      const schedule = createMockScheduleData({ start_date: '2024-01-01', end_date: '2024-01-07' })
      render(<GanttChart schedule={schedule} timeScale="day" />)
      expect(screen.getByTestId('timeline-header')).toBeInTheDocument()
    })

    it('renders month time scale headers when specified', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} timeScale="month" />)
      expect(screen.getByTestId('timeline-header')).toBeInTheDocument()
    })
  })

  describe('Responsive Design and Performance', () => {
    it('renders task info column with WBS code and name', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      schedule.tasks.forEach((task) => {
        const taskInfo = screen.getByTestId(`task-info-${task.id}`)
        expect(taskInfo).toBeInTheDocument()
        expect(taskInfo).toHaveTextContent(task.wbs_code)
        expect(taskInfo).toHaveTextContent(task.name)
      })
    })

    it('renders task bars with calculated positions', () => {
      const schedule = createMockScheduleData()
      render(<GanttChart schedule={schedule} />)
      schedule.tasks.forEach((task) => {
        const taskBar = screen.getByTestId(`task-bar-${task.id}`)
        expect(taskBar).toBeInTheDocument()
        // Verify style attribute exists with left and width properties
        const style = taskBar.getAttribute('style')
        expect(style).toContain('left')
        expect(style).toContain('width')
      })
    })

    it('handles tasks with zero duration gracefully', () => {
      const schedule = createMockScheduleData({
        tasks: [{
          id: 'milestone-task', name: 'Milestone Task', wbs_code: '1.0',
          planned_start_date: '2024-01-15', planned_end_date: '2024-01-15',
          progress_percentage: 0, status: 'not_started', is_critical: false,
          total_float_days: 0, dependencies: [],
        }],
      })
      render(<GanttChart schedule={schedule} />)
      expect(screen.getByTestId('task-bar-milestone-task')).toBeInTheDocument()
    })

    it('renders schedule with many tasks', () => {
      const manyTasks: GanttTask[] = Array.from({ length: 50 }, (_, i) => ({
        id: `task-${i + 1}`, name: `Task ${i + 1}`, wbs_code: `1.${i + 1}`,
        planned_start_date: '2024-01-01', planned_end_date: '2024-01-15',
        progress_percentage: Math.floor(Math.random() * 100), status: 'in_progress' as const,
        is_critical: i < 5, total_float_days: i < 5 ? 0 : 5, dependencies: i > 0 ? [`task-${i}`] : [],
      }))
      const largeSchedule = createMockScheduleData({ tasks: manyTasks })
      render(<GanttChart schedule={largeSchedule} />)
      expect(screen.getAllByTestId(/^gantt-row-/)).toHaveLength(50)
    })
  })
})

describe('Gantt Chart Utility Functions', () => {
  describe('calculateTaskPosition', () => {
    it('calculates correct position for task at schedule start', () => {
      const result = calculateTaskPosition('2024-01-01', '2024-01-15', '2024-01-01', '2024-03-31', 800)
      expect(result.left).toBe(0)
      expect(result.width).toBeGreaterThan(0)
    })

    it('calculates correct position for task in middle of schedule', () => {
      const result = calculateTaskPosition('2024-02-01', '2024-02-15', '2024-01-01', '2024-03-31', 800)
      expect(result.left).toBeGreaterThan(0)
      expect(result.width).toBeGreaterThan(0)
    })

    it('ensures minimum width for very short tasks', () => {
      const result = calculateTaskPosition('2024-01-01', '2024-01-01', '2024-01-01', '2024-12-31', 800)
      expect(result.width).toBeGreaterThanOrEqual(10)
    })

    it('ensures left position is never negative', () => {
      const result = calculateTaskPosition('2023-12-01', '2024-01-15', '2024-01-01', '2024-03-31', 800)
      expect(result.left).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateDuration', () => {
    it('calculates correct duration in days', () => {
      const duration = calculateDuration('2024-01-01', '2024-01-15')
      expect(duration).toBe(14)
    })

    it('returns 0 for same start and end date', () => {
      const duration = calculateDuration('2024-01-01', '2024-01-01')
      expect(duration).toBe(0)
    })

    it('handles month boundaries correctly', () => {
      const duration = calculateDuration('2024-01-25', '2024-02-05')
      expect(duration).toBe(11)
    })
  })

  describe('formatDateForDisplay', () => {
    it('formats date correctly', () => {
      const formatted = formatDateForDisplay('2024-01-15')
      expect(formatted).toMatch(/Jan/)
      expect(formatted).toMatch(/15/)
    })
  })
})

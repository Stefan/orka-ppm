/**
 * Register Nested Grids - TypeScript interfaces
 * Requirements: 1.1, 2.1, 3.1-3.4, 4.1-4.6
 */

export type ItemType = 'tasks' | 'registers' | 'cost_registers'

export interface ColumnConfig {
  id: string
  field: string
  headerName: string
  width?: number
  editable?: boolean
  order: number
}

export interface Section {
  id: string
  itemType: ItemType
  columns: ColumnConfig[]
  displayOrder: number
  permissions?: PermissionConfig
}

export interface NestedGridConfig {
  sections: Section[]
  enableLinkedItems: boolean
}

export interface NestedGridConfigModel {
  id: string
  registerId: string
  enableLinkedItems: boolean
  sections: SectionModel[]
  createdAt: Date
  updatedAt: Date
}

export interface SectionModel {
  id: string
  configId: string
  itemType: ItemType
  displayOrder: number
  columns: ColumnModel[]
  createdAt: Date
  updatedAt: Date
}

export interface ColumnModel {
  id: string
  sectionId: string
  field: string
  headerName: string
  width?: number
  editable: boolean
  displayOrder: number
  createdAt: Date
}

export interface PermissionConfig {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canReorder: boolean
  restrictedFields?: string[]
}

export interface ScrollPosition {
  top: number
  left: number
  expandedRows: string[]
}

export interface FilterState {
  filters: Filter[]
  activeFilters: string[]
}

export interface Filter {
  id: string
  field: string
  operator: FilterOperator
  value: unknown
  label: string
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'in'
  | 'notIn'

export interface UserStateModel {
  id: string
  userId: string
  registerId: string
  expandedRows: string[]
  scrollPosition: ScrollPosition | null
  filterState: FilterState | null
  lastViewedAt: Date
}

export interface ChangeModel {
  id: string
  parentRowId: string
  itemType: ItemType
  rowId: string
  field?: string
  changeType: 'added' | 'modified' | 'deleted'
  previousValue?: unknown
  currentValue?: unknown
  changedAt: Date
}

export interface AISuggestion {
  type: 'column_combination' | 'filter_preset' | 'display_order'
  confidence: number
  suggestion: {
    columns?: string[]
    reason: string
    popularity?: number
  }
}

export interface ChangeHighlight {
  rowId: string
  field: string
  changeType: 'added' | 'modified' | 'deleted'
  previousValue?: unknown
  currentValue?: unknown
  timestamp: Date
}

export interface AvailableColumn {
  field: string
  headerName: string
  type: 'text' | 'number' | 'currency' | 'date' | 'select' | 'user' | 'tags'
}

/**
 * Column definitions per item type
 * Requirements: 3.1, 3.2, 3.3 - Minimum 10 columns per type
 */

import type { AvailableColumn } from './types'
import type { ItemType } from './types'

export const COLUMN_DEFINITIONS: Record<ItemType, AvailableColumn[]> = {
  tasks: [
    { field: 'status', headerName: 'Status', type: 'select' },
    { field: 'dueDate', headerName: 'Due Date', type: 'date' },
    { field: 'assignee', headerName: 'Assignee', type: 'user' },
    { field: 'priority', headerName: 'Priority', type: 'select' },
    { field: 'progress', headerName: 'Progress', type: 'number' },
    { field: 'description', headerName: 'Description', type: 'text' },
    { field: 'tags', headerName: 'Tags', type: 'tags' },
    { field: 'createdAt', headerName: 'Created', type: 'date' },
    { field: 'updatedAt', headerName: 'Updated', type: 'date' },
    { field: 'estimatedHours', headerName: 'Est. Hours', type: 'number' },
    { field: 'actualHours', headerName: 'Actual Hours', type: 'number' },
  ],
  registers: [
    { field: 'name', headerName: 'Name', type: 'text' },
    { field: 'budget', headerName: 'Budget', type: 'currency' },
    { field: 'eac', headerName: 'EAC', type: 'currency' },
    { field: 'variance', headerName: 'Variance', type: 'currency' },
    { field: 'status', headerName: 'Status', type: 'select' },
    { field: 'owner', headerName: 'Owner', type: 'user' },
    { field: 'startDate', headerName: 'Start Date', type: 'date' },
    { field: 'endDate', headerName: 'End Date', type: 'date' },
    { field: 'progress', headerName: 'Progress', type: 'number' },
    { field: 'category', headerName: 'Category', type: 'select' },
    { field: 'description', headerName: 'Description', type: 'text' },
  ],
  cost_registers: [
    { field: 'eac', headerName: 'EAC', type: 'currency' },
    { field: 'variance', headerName: 'Variance', type: 'currency' },
    { field: 'commitments', headerName: 'Commitments', type: 'currency' },
    { field: 'actuals', headerName: 'Actuals', type: 'currency' },
    { field: 'budget', headerName: 'Budget', type: 'currency' },
    { field: 'forecast', headerName: 'Forecast', type: 'currency' },
    { field: 'costCode', headerName: 'Cost Code', type: 'text' },
    { field: 'category', headerName: 'Category', type: 'select' },
    { field: 'vendor', headerName: 'Vendor', type: 'text' },
    { field: 'invoiceDate', headerName: 'Invoice Date', type: 'date' },
    { field: 'paymentStatus', headerName: 'Payment Status', type: 'select' },
  ],
}

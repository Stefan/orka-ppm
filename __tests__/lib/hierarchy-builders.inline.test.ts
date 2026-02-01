/**
 * Unit tests for HierarchyTreeView inline calculations (Task 53.2)
 * Test calculation updates and adjustment propagation.
 */

import { buildCESHierarchy, buildWBSHierarchy } from '@/lib/costbook/hierarchy-builders'
import { Commitment, Currency, POStatus } from '@/types/costbook'

const mockCommitments: Commitment[] = [
  { id: 'c1', project_id: 'p1', vendor_id: 'v1', vendor_name: 'Vendor A', description: 'Design', amount: 10000, currency: Currency.USD, status: POStatus.APPROVED, issue_date: '2024-01-01', delivery_date: '2024-06-01', po_number: 'PO-001', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'c2', project_id: 'p1', vendor_id: 'v1', vendor_name: 'Vendor A', description: 'Design', amount: 5000, currency: Currency.USD, status: POStatus.APPROVED, issue_date: '2024-01-01', delivery_date: '2024-06-01', po_number: 'PO-001', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'c3', project_id: 'p1', vendor_id: 'v2', vendor_name: 'Vendor B', description: 'Build', amount: 20000, currency: Currency.USD, status: POStatus.APPROVED, issue_date: '2024-01-01', delivery_date: '2024-06-01', po_number: 'PO-002', created_at: '2024-01-01', updated_at: '2024-01-01' }
]

describe('Hierarchy Builders - Inline calculations (Task 53.2)', () => {
  it('CES hierarchy subtotals propagate to children', () => {
    const nodes = buildCESHierarchy(mockCommitments, Currency.USD)
    for (const root of nodes) {
      const childrenSum = root.children.reduce((s, c) => s + c.total_spend, 0)
      expect(root.total_spend).toBeGreaterThanOrEqual(0)
      expect(childrenSum).toBeGreaterThanOrEqual(0)
      expect(root.total_spend).toBeGreaterThanOrEqual(childrenSum)
    }
  })

  it('WBS hierarchy subtotals propagate', () => {
    const nodes = buildWBSHierarchy(mockCommitments, Currency.USD)
    expect(nodes.length).toBeGreaterThanOrEqual(0)
    for (const node of nodes) {
      if (node.children.length > 0) {
        const childrenSum = node.children.reduce((s, c) => s + c.total_spend, 0)
        expect(node.total_spend).toBe(childrenSum)
      }
    }
  })

  it('calculation updates when commitments change', () => {
    const nodes1 = buildCESHierarchy(mockCommitments, Currency.USD)
    const extra = [...mockCommitments, { ...mockCommitments[0], id: 'c4', amount: 3000 } as Commitment]
    const nodes2 = buildCESHierarchy(extra, Currency.USD)
    const sum1 = nodes1.reduce((s, n) => s + n.total_spend, 0)
    const sum2 = nodes2.reduce((s, n) => s + n.total_spend, 0)
    expect(sum2).toBe(sum1 + 3000)
  })
})

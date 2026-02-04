'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  FileText,
  DollarSign,
  CheckCircle,
  XCircle,
  BarChart3,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { changeOrdersApi, type ChangeOrder, type ChangeOrderCreate } from '@/lib/change-orders-api'
import ChangeOrderWizard from './ChangeOrderWizard'
import CostImpactCalculator from './CostImpactCalculator'
import ApprovalWorkflowTracker from './ApprovalWorkflowTracker'
import ChangeOrderAnalytics from './ChangeOrderAnalytics'
import AppLayout from '@/components/shared/AppLayout'
import { ResponsiveContainer } from '@/components/ui/molecules/ResponsiveContainer'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  implemented: 'bg-emerald-100 text-emerald-800',
}

interface ChangeOrdersDashboardProps {
  projectId: string
  projectName?: string
}

export default function ChangeOrdersDashboard({
  projectId,
  projectName = 'Project',
}: ChangeOrdersDashboardProps) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<ChangeOrder | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list')
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<{
    summary: Record<string, unknown>
    cost_impact_summary: Record<string, unknown>
  } | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [orders, dash] = await Promise.all([
        changeOrdersApi.list(projectId, filterStatus ? { status: filterStatus } : undefined),
        changeOrdersApi.getDashboard(projectId).catch(() => null),
      ])
      setChangeOrders(orders)
      if (dash) setDashboard(dash)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load change orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId, filterStatus])

  const handleCreateComplete = (order: ChangeOrder) => {
    setChangeOrders((prev) => [order, ...prev])
    setShowWizard(false)
    loadData()
  }

  const filteredOrders = searchTerm
    ? changeOrders.filter(
        (o) =>
          o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.change_order_number.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : changeOrders

  const summary = dashboard?.summary as Record<string, number> | undefined

  return (
    <AppLayout>
      <ResponsiveContainer padding="md">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Change Orders</h1>
              <p className="text-gray-600 mt-1">
                Formal change order management for {projectName}
              </p>
            </div>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              New Change Order
            </button>
          </div>

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Total</span>
                </div>
                <p className="text-2xl font-bold mt-1">{summary.total_change_orders ?? 0}</p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Approved</span>
                </div>
                <p className="text-2xl font-bold mt-1">{summary.approved_change_orders ?? 0}</p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium">Rejected</span>
                </div>
                <p className="text-2xl font-bold mt-1">{summary.rejected_change_orders ?? 0}</p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Total Cost Impact</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  ${(summary.total_cost_impact ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 -mb-px ${activeTab === 'list' ? 'border-b-2 border-indigo-600 font-medium' : 'text-gray-600'}`}
            >
              Change Orders
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1 px-4 py-2 -mb-px ${activeTab === 'analytics' ? 'border-b-2 border-indigo-600 font-medium' : 'text-gray-600'}`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
          </div>

          {activeTab === 'analytics' ? (
            <ChangeOrderAnalytics projectId={projectId} />
          ) : (
          <>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title or number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="implemented">Implemented</option>
            </select>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  No change orders found. Create one to get started.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Number
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Cost Impact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Created
                      </th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      >
                        <td className="px-4 py-3 text-sm font-mono">{order.change_order_number}</td>
                        <td className="px-4 py-3 text-sm font-medium">{order.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {order.change_category.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          ${order.proposed_cost_impact.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className={`w-4 h-4 text-gray-400 ${selectedOrder?.id === order.id ? 'rotate-90' : ''}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {selectedOrder && (
            <div className="mt-6 p-4 border rounded-lg bg-gray-50 space-y-4">
              <div className="flex justify-between">
                <h3 className="font-semibold">{selectedOrder.change_order_number}: {selectedOrder.title}</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Cost Impact</h4>
                  <CostImpactCalculator changeOrderId={selectedOrder.id} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Approval Workflow</h4>
                  <ApprovalWorkflowTracker
                    changeOrderId={selectedOrder.id}
                    currentUserId={user?.id ?? ''}
                    onStatusChange={loadData}
                  />
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {showWizard && (
          <ChangeOrderWizard
            projectId={projectId}
            onComplete={handleCreateComplete}
            onCancel={() => setShowWizard(false)}
          />
        )}
      </ResponsiveContainer>
    </AppLayout>
  )
}

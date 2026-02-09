/**
 * React Query hooks for work packages.
 * Cache invalidation on create/update/delete and when switching project.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectControlsApi } from '@/lib/project-controls-api'
import type { WorkPackage, WorkPackageCreate, WorkPackageSummary } from '@/types/project-controls'

export const workPackageKeys = {
  all: ['work-packages'] as const,
  list: (projectId: string, activeOnly?: boolean) =>
    [...workPackageKeys.all, 'list', projectId, activeOnly ?? true] as const,
  summary: (projectId: string) => [...workPackageKeys.all, 'summary', projectId] as const,
}

export function useWorkPackages(projectId: string, activeOnly: boolean = false) {
  return useQuery({
    queryKey: workPackageKeys.list(projectId, activeOnly),
    queryFn: () => projectControlsApi.listWorkPackages(projectId, activeOnly) as Promise<WorkPackage[]>,
    enabled: !!projectId,
  })
}

export function useWorkPackageSummary(projectId: string) {
  return useQuery({
    queryKey: workPackageKeys.summary(projectId),
    queryFn: () => projectControlsApi.getWorkPackageSummary(projectId) as Promise<WorkPackageSummary>,
    enabled: !!projectId,
  })
}

export function useCreateWorkPackage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<WorkPackageCreate, 'project_id'> & { project_id?: string }) =>
      projectControlsApi.createWorkPackage(projectId, { ...body, project_id: projectId }) as Promise<WorkPackage>,
    onMutate: async (newWp) => {
      await queryClient.cancelQueries({ queryKey: workPackageKeys.list(projectId) })
      const previous = queryClient.getQueryData<WorkPackage[]>(workPackageKeys.list(projectId, false))
      const temp: WorkPackage = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        name: newWp.name,
        description: newWp.description ?? null,
        budget: newWp.budget,
        start_date: newWp.start_date,
        end_date: newWp.end_date,
        percent_complete: 0,
        actual_cost: 0,
        earned_value: 0,
        responsible_manager: newWp.responsible_manager,
        parent_package_id: newWp.parent_package_id ?? null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      queryClient.setQueryData<WorkPackage[]>(workPackageKeys.list(projectId, false), (old) =>
        old ? [...old, temp] : [temp]
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workPackageKeys.list(projectId, false), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workPackageKeys.list(projectId) })
      queryClient.invalidateQueries({ queryKey: workPackageKeys.summary(projectId) })
    },
  })
}

export function useUpdateWorkPackage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ wpId, body }: { wpId: string; body: Record<string, unknown> }) =>
      projectControlsApi.updateWorkPackage(projectId, wpId, body) as Promise<WorkPackage>,
    onMutate: async ({ wpId, body }) => {
      await queryClient.cancelQueries({ queryKey: workPackageKeys.list(projectId) })
      const previous = queryClient.getQueryData<WorkPackage[]>(workPackageKeys.list(projectId, false))
      queryClient.setQueryData<WorkPackage[]>(workPackageKeys.list(projectId, false), (old) => {
        if (!old) return old
        return old.map((wp) =>
          wp.id === wpId ? { ...wp, ...body, updated_at: new Date().toISOString() } as WorkPackage : wp
        )
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workPackageKeys.list(projectId, false), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workPackageKeys.list(projectId) })
      queryClient.invalidateQueries({ queryKey: workPackageKeys.summary(projectId) })
    },
  })
}

export function useDeleteWorkPackage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (wpId: string) => projectControlsApi.deleteWorkPackage(projectId, wpId),
    onMutate: async (wpId) => {
      await queryClient.cancelQueries({ queryKey: workPackageKeys.list(projectId) })
      const previous = queryClient.getQueryData<WorkPackage[]>(workPackageKeys.list(projectId, false))
      queryClient.setQueryData<WorkPackage[]>(workPackageKeys.list(projectId, false), (old) => {
        if (!old) return old
        return old
          .filter((wp) => wp.id !== wpId)
          .map((wp) =>
            wp.parent_package_id === wpId ? { ...wp, parent_package_id: null } : wp
          ) as WorkPackage[]
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workPackageKeys.list(projectId, false), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workPackageKeys.list(projectId) })
      queryClient.invalidateQueries({ queryKey: workPackageKeys.summary(projectId) })
    },
  })
}

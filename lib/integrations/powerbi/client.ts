import { baseFetch, getProviderToken } from '../base'
const POWERBI_BASE = 'https://api.powerbi.com/v1.0/myorg'

/**
 * Generic Power BI fetch — hits the /myorg (user-scoped) base.
 * Used for non-workspace-scoped calls (legacy compat).
 */
export async function powerbiFetch<T = unknown>(
  connectionId: string,
  orgId: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; admin?: boolean } = {}
): Promise<T> {
  const token = await getProviderToken(connectionId, 'powerbi', orgId)
  const baseUrl = options.admin ? 'https://api.powerbi.com/v1.0/myorg/admin' : POWERBI_BASE
  
  return baseFetch<T>(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}` },
    ...(options.body != null ? { body: options.body } : {}),
  })
}

/**
 * Workspace-scoped Power BI fetch — hits /groups/{groupId}/...
 * All selective sync calls should use this so resources are
 * correctly scoped to their workspace.
 */
export async function powerbiFetchScoped<T = unknown>(
  connectionId: string,
  orgId: string,
  groupId: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const token = await getProviderToken(connectionId, 'powerbi', orgId)
  return baseFetch<T>(`${POWERBI_BASE}/groups/${groupId}${path}`, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}` },
    ...(options.body != null ? { body: options.body } : {}),
  })
}

// ---- Types for Power BI API responses -------------------------

export interface PowerBIWorkspace {
  id: string
  name: string
  type: string
  isReadOnly: boolean
  isOnDedicatedCapacity: boolean
}

export interface PowerBIReport {
  id: string
  name: string
  description: string | null
  webUrl: string
  datasetId: string
}

export interface PowerBIDataset {
  id: string
  name: string
  isRefreshable: boolean
  tables: { name: string; columns: { name: string; dataType: string }[] }[]
}

export interface PowerBIDashboard {
  id: string
  displayName: string
  isReadOnly: boolean
  webUrl: string
}

export interface PowerBIMeasure {
  name: string
  expression: string
  description?: string
}

/**
 * Lists all workspaces the user has access to.
 * Tries admin endpoint first (/admin/groups) for tenant-wide visibility,
 * falls back to user endpoint (/groups) on 403.
 */
export async function listWorkspaces(
  connectionId: string,
  orgId: string
): Promise<PowerBIWorkspace[]> {
  // Try admin endpoint first for full tenant visibility
  try {
    const adminRes = await powerbiFetch<{ value: PowerBIWorkspace[] }>(
      connectionId, orgId, '/admin/groups?$top=5000', { admin: true }
    )
    if (adminRes?.value?.length) return adminRes.value
  } catch {
    // Admin scope not available — fall back to user scope
  }

  // User-scoped fallback
  const res = await powerbiFetch<{ value: PowerBIWorkspace[] }>(
    connectionId, orgId, '/groups'
  )
  return res?.value ?? []
}

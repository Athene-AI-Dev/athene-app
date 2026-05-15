// ============================================================
// integrations/powerbi/browser.ts — Power BI resource browser
//
// Implements the ProviderBrowser interface for Power BI.
// Root level lists Workspaces, child level lists Reports,
// Datasets, and Dashboards within a workspace.
//
// Auth strategy:
//   - Admin endpoint first (/admin/groups) for tenant-wide view
//   - Falls back to user endpoint (/groups) if admin scope is missing
// ============================================================

import {
  powerbiFetchScoped,
  listWorkspaces,
  type PowerBIReport,
  type PowerBIDashboard,
  type PowerBIDataset,
} from './client'
import type { BrowsableResource, BrowseResult, ProviderBrowser } from '../browsing'

/**
 * Power BI resource browser.
 *
 * - parentId === null  → list all workspaces
 * - parentId === groupId → list reports, datasets, dashboards in that workspace
 */
export const browsePowerBI: ProviderBrowser = async (
  connectionId: string,
  orgId: string,
  parentId?: string | null,
  _options?: { pageToken?: string; limit?: number }
): Promise<BrowseResult> => {
  // ── Root: list workspaces ─────────────────────────────────────
  if (!parentId) {
    const workspaces = await listWorkspaces(connectionId, orgId)

    const resources: BrowsableResource[] = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      type: 'space' as const,
      hasChildren: true,
      path: `/${ws.name}`,
      metadata: {
        workspaceType: ws.type,
        isReadOnly: ws.isReadOnly,
        isOnDedicatedCapacity: ws.isOnDedicatedCapacity,
      },
    }))

    return { resources }
  }

  // ── Workspace children: reports, datasets, dashboards ─────────
  const groupId = parentId
  const resources: BrowsableResource[] = []

  // Reports
  try {
    const reportsRes = await powerbiFetchScoped<{ value: PowerBIReport[] }>(
      connectionId, orgId, groupId, '/reports'
    )
    for (const r of reportsRes?.value ?? []) {
      resources.push({
        id: r.id,
        name: r.name,
        type: 'file' as const,
        hasChildren: false,
        path: `/${groupId}/${r.name}`,
        metadata: {
          resourceKind: 'report',
          datasetId: r.datasetId,
          webUrl: r.webUrl,
          description: r.description,
        },
      })
    }
  } catch (err) {
    console.error(`[powerbi-browse] Failed to list reports for workspace ${groupId}:`, err)
  }

  // Datasets
  try {
    const datasetsRes = await powerbiFetchScoped<{ value: PowerBIDataset[] }>(
      connectionId, orgId, groupId, '/datasets'
    )
    for (const ds of datasetsRes?.value ?? []) {
      resources.push({
        id: ds.id,
        name: ds.name,
        type: 'database' as const,
        hasChildren: false,
        path: `/${groupId}/${ds.name}`,
        metadata: {
          resourceKind: 'dataset',
          isRefreshable: ds.isRefreshable,
        },
      })
    }
  } catch (err) {
    console.error(`[powerbi-browse] Failed to list datasets for workspace ${groupId}:`, err)
  }

  // Dashboards
  try {
    const dashRes = await powerbiFetchScoped<{ value: PowerBIDashboard[] }>(
      connectionId, orgId, groupId, '/dashboards'
    )
    for (const d of dashRes?.value ?? []) {
      resources.push({
        id: d.id,
        name: d.displayName,
        type: 'page' as const,
        hasChildren: false,
        path: `/${groupId}/${d.displayName}`,
        metadata: {
          resourceKind: 'dashboard',
          isReadOnly: d.isReadOnly,
          webUrl: d.webUrl,
        },
      })
    }
  } catch (err) {
    console.error(`[powerbi-browse] Failed to list dashboards for workspace ${groupId}:`, err)
  }

  return { resources }
}

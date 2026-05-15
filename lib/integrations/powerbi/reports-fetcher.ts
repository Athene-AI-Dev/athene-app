import { powerbiFetch } from './client'
import { FetchedChunk } from '../base'
import { supabaseAdmin } from '@/lib/supabase/server'

interface PowerBIReport {
  id: string
  name: string
  description: string | null
  webUrl: string
  datasetId: string
}

interface PowerBIDataset {
  id: string
  name: string
  isRefreshable: boolean
  tables: { name: string; columns: { name: string; dataType: string }[] }[]
}

interface PowerBIDashboard {
  id: string
  displayName: string
  isReadOnly: boolean
  webUrl: string
}

export async function fetchPowerBIContent(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []

  // 0. Load sync_config to check for selected workspaces
  const { data: conn } = await supabaseAdmin
    .from('connections')
    .select('sync_config')
    .eq('nango_connection_id', connectionId)
    .single()
  
  const syncConfig = conn?.sync_config as any
  const selectedResourceIds = syncConfig?.selected_resources?.map((r: any) => r.id) || []
  const resourceDeptMap = (syncConfig?.selected_resources || []).reduce((acc: any, r: any) => {
    if (r.departmentId) acc[r.id] = r.departmentId
    return acc
  }, {})

  // 1. Dynamic Workspace Strategy: try /admin/groups first, fallback to /groups
  let workspaces: { id: string; name: string }[] = []
  try {
    const wsRes = await powerbiFetch<any>(connectionId, orgId, '/groups', { admin: true })
    workspaces = wsRes?.value ?? []
  } catch (err) {
    console.warn('[powerbi] Admin workspaces fetch failed, falling back to user-scoped groups.')
    try {
      const wsRes = await powerbiFetch<any>(connectionId, orgId, '/groups')
      workspaces = wsRes?.value ?? []
    } catch (err2) {
      console.error('[powerbi] Failed to fetch any workspaces:', err2)
    }
  }

  // Include "My Workspace" (personal)
  workspaces.push({ id: 'me', name: 'My Workspace' })

  // 1.5 Filter workspaces if selections exist
  if (selectedResourceIds.length > 0) {
    workspaces = workspaces.filter(w => selectedResourceIds.includes(w.id))
  }

  for (const workspace of workspaces) {
    const wsPrefix = workspace.id === 'me' ? '' : `/groups/${workspace.id}`
    const wsName = workspace.name
    const workspaceDeptId = resourceDeptMap[workspace.id]

    // Fetch Reports
    try {
      const reportsRes = await powerbiFetch<any>(connectionId, orgId, `${wsPrefix}/reports`)
      const reports: PowerBIReport[] = reportsRes?.value ?? []
      for (const report of reports) {
        // Fetch pages for each report
        let pageNames = ''
        try {
          const pagesRes = await powerbiFetch<any>(connectionId, orgId, `${wsPrefix}/reports/${report.id}/pages`)
          const pages: { name: string; displayName: string }[] = pagesRes?.value ?? []
          pageNames = pages.map((p) => p.displayName).join(', ')
        } catch { /* Non-fatal */ }

        chunks.push({
          chunk_id: `powerbi_report_${report.id}`,
          title: `Power BI Report: ${report.name} (${wsName})`,
          content: [
            report.description,
            pageNames ? `Pages: ${pageNames}` : null,
          ].filter(Boolean).join('\n') || report.name,
          source_url: report.webUrl,
          metadata: {
            provider: 'powerbi',
            resource_type: 'report',
            workspace_id: workspace.id,
            workspace_name: wsName,
            report_id: report.id,
            dataset_id: report.datasetId,
            department_id: workspaceDeptId, // ✅ Inject department tag
          },
        })
      }
    } catch (err) {
      console.error(`[powerbi] Failed to fetch reports for workspace ${wsName}:`, err)
    }

    // Fetch Datasets with schema & measures
    try {
      const datasetsRes = await powerbiFetch<any>(connectionId, orgId, `${wsPrefix}/datasets`)
      const datasets: PowerBIDataset[] = datasetsRes?.value ?? []
      for (const ds of datasets) {
        // Fetch table schemas
        let schemaContent = ''
        try {
          const tablesRes = await powerbiFetch<any>(connectionId, orgId, `${wsPrefix}/datasets/${ds.id}/tables`)
          const tables: { name: string; columns: { name: string; dataType: string }[] }[] = tablesRes?.value ?? []
          schemaContent = tables.map((t) => {
            const cols = (t.columns ?? []).map((c) => `${c.name} (${c.dataType})`).join(', ')
            return `Table ${t.name}: ${cols}`
          }).join('\n')
        } catch { /* Non-fatal */ }

        // ✅ DAX Measure Extraction (metadata only)
        let measureContent = ''
        try {
          const measuresRes = await powerbiFetch<any>(connectionId, orgId, `${wsPrefix}/datasets/${ds.id}/measures`)
          const measures: { name: string; description?: string }[] = measuresRes?.value ?? []
          if (measures.length > 0) {
            measureContent = '\nMeasures:\n' + measures.map(m => `- ${m.name}${m.description ? `: ${m.description}` : ''}`).join('\n')
          }
        } catch { /* Non-fatal */ }

        chunks.push({
          chunk_id: `powerbi_dataset_${ds.id}`,
          title: `Power BI Dataset: ${ds.name} (${wsName})`,
          content: (schemaContent || `Dataset: ${ds.name}`) + measureContent,
          source_url: `https://app.powerbi.com/datasets/${ds.id}`,
          metadata: {
            provider: 'powerbi',
            resource_type: 'dataset',
            workspace_id: workspace.id,
            workspace_name: wsName,
            dataset_id: ds.id,
            is_refreshable: String(ds.isRefreshable),
            department_id: workspaceDeptId, // ✅ Inject department tag
          },
        })
      }
    } catch (err) {
      console.error(`[powerbi] Failed to fetch datasets for workspace ${wsName}:`, err)
    }

    // Fetch Dashboards
    try {
      const dashRes = await powerbiFetch<any>(connectionId, orgId, `${wsPrefix}/dashboards`)
      const dashboards: PowerBIDashboard[] = dashRes?.value ?? []
      for (const dash of dashboards) {
        chunks.push({
          chunk_id: `powerbi_dashboard_${dash.id}`,
          title: `Power BI Dashboard: ${dash.displayName} (${wsName})`,
          content: `Dashboard: ${dash.displayName}`,
          source_url: dash.webUrl,
          metadata: {
            provider: 'powerbi',
            resource_type: 'dashboard',
            workspace_id: workspace.id,
            workspace_name: wsName,
            dashboard_id: dash.id,
            department_id: workspaceDeptId, // ✅ Inject department tag
          },
        })
      }
    } catch (err) {
      console.error(`[powerbi] Failed to fetch dashboards for workspace ${wsName}:`, err)
    }
  }

  return chunks
}

import { powerbiFetch } from './client'
import { FetchedChunk } from '../base'
import { logger } from '@/lib/logger'

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

  // Fetch Reports
  try {
    const reportsRes = await powerbiFetch<any>(connectionId, orgId, '/reports')
    const reports: PowerBIReport[] = reportsRes?.value ?? []
    for (const report of reports) {
      // Fetch pages for each report
      let pageNames = ''
      try {
        const pagesRes = await powerbiFetch<any>(connectionId, orgId, `/reports/${report.id}/pages`)
        const pages: { name: string; displayName: string }[] = pagesRes?.value ?? []
        pageNames = pages.map((p) => p.displayName).join(', ')
      } catch {
        // Non-fatal
      }

      chunks.push({
        chunk_id: `powerbi_report_${report.id}`,
        title: `Power BI Report: ${report.name}`,
        content: [
          report.description,
          pageNames ? `Pages: ${pageNames}` : null,
        ].filter(Boolean).join('\n') || report.name,
        source_url: report.webUrl,
        metadata: {
          provider: 'powerbi',
          resource_type: 'report',
          report_id: report.id,
          dataset_id: report.datasetId,
        },
      })
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, '[powerbi] Failed to fetch reports')
  }

  // Fetch Datasets with schema
  try {
    const datasetsRes = await powerbiFetch<any>(connectionId, orgId, '/datasets')
    const datasets: PowerBIDataset[] = datasetsRes?.value ?? []
    for (const ds of datasets) {
      // Fetch table schemas
      let schemaContent = ''
      try {
        const tablesRes = await powerbiFetch<any>(connectionId, orgId, `/datasets/${ds.id}/tables`)
        const tables: { name: string; columns: { name: string; dataType: string }[] }[] = tablesRes?.value ?? []
        schemaContent = tables.map((t) => {
          const cols = (t.columns ?? []).map((c) => `${c.name} (${c.dataType})`).join(', ')
          return `Table ${t.name}: ${cols}`
        }).join('\n')
      } catch {
        // Non-fatal
      }

      chunks.push({
        chunk_id: `powerbi_dataset_${ds.id}`,
        title: `Power BI Dataset: ${ds.name}`,
        content: schemaContent || `Dataset: ${ds.name}`,
        source_url: `https://app.powerbi.com/datasets/${ds.id}`,
        metadata: {
          provider: 'powerbi',
          resource_type: 'dataset',
          dataset_id: ds.id,
          is_refreshable: String(ds.isRefreshable),
        },
      })
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, '[powerbi] Failed to fetch datasets')
  }

  // Fetch Dashboards
  try {
    const dashRes = await powerbiFetch<any>(connectionId, orgId, '/dashboards')
    const dashboards: PowerBIDashboard[] = dashRes?.value ?? []
    for (const dash of dashboards) {
      chunks.push({
        chunk_id: `powerbi_dashboard_${dash.id}`,
        title: `Power BI Dashboard: ${dash.displayName}`,
        content: `Dashboard: ${dash.displayName}`,
        source_url: dash.webUrl,
        metadata: {
          provider: 'powerbi',
          resource_type: 'dashboard',
          dashboard_id: dash.id,
        },
      })
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, '[powerbi] Failed to fetch dashboards')
  }

  return chunks
}

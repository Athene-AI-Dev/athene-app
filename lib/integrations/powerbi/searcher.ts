import { powerbiFetch } from './client'
import { FetchedChunk } from '../base'

export async function powerbiSearch(connectionId: string, orgId: string, query: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []
  const q = query.toLowerCase()

  try {
    const reportsRes = await powerbiFetch<any>(connectionId, orgId, '/reports')
    const reports: any[] = reportsRes?.value ?? []
    for (const report of reports) {
      if (
        report.name?.toLowerCase().includes(q) ||
        report.description?.toLowerCase().includes(q)
      ) {
        chunks.push({
          chunk_id: `powerbi_report_${report.id}`,
          title: `Power BI Report: ${report.name}`,
          content: report.description ?? report.name,
          source_url: report.webUrl,
          metadata: { provider: 'powerbi', resource_type: 'report', report_id: report.id },
        })
      }
    }
  } catch (err) {
    console.error('[powerbi] Report search failed:', err)
  }

  try {
    const datasetsRes = await powerbiFetch<any>(connectionId, orgId, '/datasets')
    const datasets: any[] = datasetsRes?.value ?? []
    for (const ds of datasets) {
      if (ds.name?.toLowerCase().includes(q)) {
        chunks.push({
          chunk_id: `powerbi_dataset_${ds.id}`,
          title: `Power BI Dataset: ${ds.name}`,
          content: `Dataset: ${ds.name}`,
          source_url: `https://app.powerbi.com/datasets/${ds.id}`,
          metadata: { provider: 'powerbi', resource_type: 'dataset', dataset_id: ds.id },
        })
      }
    }
  } catch (err) {
    console.error('[powerbi] Dataset search failed:', err)
  }

  return chunks
}

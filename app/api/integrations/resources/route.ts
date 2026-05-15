import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { listDriveFiles, listSharedDrives } from '@/lib/integrations/google/drive-fetcher'
import { powerbiFetch } from '@/lib/integrations/powerbi/client'

export async function GET(req: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth()
    if (!userId || !orgId) return new NextResponse('Unauthorized', { status: 401 })
    
    // Admin check optional depending on security model, but let's keep it for now
    if (mapRole(orgRole ?? undefined) !== 'admin') return new NextResponse('Forbidden', { status: 403 })

    const { searchParams } = new URL(req.url)
    const connectionId = searchParams.get('connectionId')
    const provider = searchParams.get('provider')

    if (!connectionId || !provider) {
      return NextResponse.json({ error: 'connectionId and provider are required' }, { status: 400 })
    }

    let resources: any[] = []

    if (provider === 'google_drive' || provider === 'google') {
      // List root folders
      const folders = await listDriveFiles(connectionId, orgId, undefined, undefined, 100)
      const folderItems = (folders.files || [])
        .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
        .map(f => ({ id: f.id, name: f.name, type: 'folder' }))
      
      // List Shared Drives
      try {
        const sharedDrives = await listSharedDrives(connectionId, orgId)
        const driveItems = (sharedDrives.drives || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          type: 'shared_drive'
        }))
        resources = [...driveItems, ...folderItems]
      } catch (err) {
        console.warn('[resources-api] Failed to fetch shared drives:', err)
        resources = folderItems
      }
    } else if (provider === 'powerbi') {
      // Try admin groups first
      try {
        const wsRes = await powerbiFetch<any>(connectionId, orgId, '/groups', { admin: true })
        resources = (wsRes?.value || []).map((w: any) => ({ id: w.id, name: w.name, type: 'workspace' }))
      } catch (err) {
        const wsRes = await powerbiFetch<any>(connectionId, orgId, '/groups')
        resources = (wsRes?.value || []).map((w: any) => ({ id: w.id, name: w.name, type: 'workspace' }))
      }
      resources.push({ id: 'me', name: 'My Workspace', type: 'workspace' })
    }

    return NextResponse.json({ resources })
  } catch (err: any) {
    console.error('[resources-api] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

'use client'

import React, { useState, useEffect } from 'react'

export default function BIGrantsPage() {
  const [grants, setGrants] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [resourceId, setResourceId] = useState('')
  const [resourceType, setResourceType] = useState('document')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchGrants()
    fetchAuditLogs()
  }, [])

  const fetchGrants = async () => {
    try {
      const res = await fetch('/api/admin/bi-grants')
      if (res.ok) setGrants(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/bi-audit')
      if (res.ok) setAuditLogs(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bi-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: resourceId, resource_type: resourceType })
      })
      if (res.ok) {
        setResourceId('')
        fetchGrants()
      } else {
        alert('Failed to grant access')
      }
    } catch (err) {
      alert('Error granting access')
    }
    setLoading(false)
  }

  const revokeGrant = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/bi-grants/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchGrants()
      } else {
        alert('Failed to revoke grant')
      }
    } catch (err) {
      alert('Error revoking grant')
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">BI Access Administration</h1>

      <section className="p-6 border rounded-lg bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">Grant BI Access</h2>
        <form onSubmit={handleGrant} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Resource Type</label>
            <select
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            >
              <option value="document">Document</option>
              <option value="folder">Folder</option>
            </select>
          </div>
          <div className="flex-[3]">
            <label className="block text-sm font-medium mb-1">Resource ID</label>
            <input
              type="text"
              required
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              placeholder="Enter UUID of document or folder"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Granting...' : 'Grant Access'}
          </button>
        </form>
      </section>

      <section className="p-6 border rounded-lg bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">Active BI Grants</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="p-2">Type</th>
                <th className="p-2">Resource ID</th>
                <th className="p-2">Granted At</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">No active grants</td>
                </tr>
              ) : (
                grants.map((g) => (
                  <tr key={g.grant_id} className="border-b dark:border-gray-700">
                    <td className="p-2 capitalize">{g.resource_type}</td>
                    <td className="p-2 font-mono text-sm">{g.resource_id}</td>
                    <td className="p-2 text-sm">{new Date(g.granted_at).toLocaleString()}</td>
                    <td className="p-2">
                      <button
                        onClick={() => revokeGrant(g.grant_id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-6 border rounded-lg bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">BI Access Audit Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="p-2">Timestamp</th>
                <th className="p-2">User ID</th>
                <th className="p-2">Query</th>
                <th className="p-2">Doc ID</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">No audit logs found</td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="border-b dark:border-gray-700">
                    <td className="p-2 text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-2 font-mono text-sm">{log.user_id}</td>
                    <td className="p-2 truncate max-w-xs" title={log.query}>{log.query}</td>
                    <td className="p-2 font-mono text-sm">{log.doc_id || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

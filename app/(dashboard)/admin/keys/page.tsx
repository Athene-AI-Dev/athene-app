'use client'

import { useState, useEffect } from 'react'
import { useOrganization, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { 
  Key, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert,
  Search,
  ExternalLink,
  Activity
} from 'lucide-react'
import { toast } from 'sonner'

interface LLMKey {
  id: string
  provider: 'anthropic' | 'openai' | 'google'
  key_hint: string
  label: string
  is_active: boolean
  last_used_at: string | null
  updated_at: string
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', icon: 'https://cdn.brandfetch.io/id_2W7X4W0/theme/dark/logo.svg' },
  { id: 'openai', name: 'OpenAI', icon: 'https://cdn.brandfetch.io/id_X8Z_R-U/theme/dark/logo.svg' },
  { id: 'google', name: 'Google Vertex', icon: 'https://cdn.brandfetch.io/id_6mN-v_p/theme/dark/logo.svg' }
]

export default function KeysPage() {
  const { isLoaded, organization, membership } = useOrganization()
  const { user } = useUser()
  const router = useRouter()
  
  const [keys, setKeys] = useState<LLMKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isRotating, setIsRotating] = useState<string | null>(null)
  
  const [newKey, setNewKey] = useState({ provider: 'anthropic', key: '', label: '' })

  // 🛡️ Client-side Admin Gate (Issue #10)
  const isAdmin = membership?.role === 'org:admin'

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      toast.error('Admin access required')
      router.push('/dashboard')
    }
  }, [isLoaded, isAdmin, router])

  useEffect(() => {
    if (isAdmin) fetchKeys()
  }, [isAdmin])

  async function fetchKeys() {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/keys')
      if (!res.ok) throw new Error('Failed to fetch keys')
      const data = await res.json()
      setKeys(data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddKey() {
    if (!newKey.key) return toast.error('Key content is required')
    
    try {
      setIsAdding(true)
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKey)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add key')
      }
      
      toast.success(`${newKey.provider} key added successfully`)
      setNewKey({ provider: 'anthropic', key: '', label: '' })
      setIsAdding(false)
      fetchKeys()
    } catch (err: any) {
      toast.error(err.message)
      setIsAdding(false)
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus })
      })
      if (!res.ok) throw new Error('Failed to update status')
      toast.success(currentStatus ? 'Key deactivated' : 'Key activated')
      fetchKeys()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Are you sure you want to permanently delete this key?')) return
    
    try {
      const res = await fetch(`/api/admin/keys?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete key')
      toast.success('Key deleted successfully')
      fetchKeys()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!isLoaded || isLoading) {
    return <div className="flex items-center justify-center min-h-[400px] animate-pulse text-[var(--sidebar-text-secondary)]">Loading configuration...</div>
  }

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--sidebar-text-secondary)] mb-2">
            <Key className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Infrastructure</span>
          </div>
          <h1 className="text-4xl font-semibold text-[var(--foreground)] tracking-tight">
            LLM Key Management
          </h1>
          <p className="text-base text-[var(--sidebar-text-secondary)] mt-2 max-w-xl">
            Configure your own API keys for the Athene core agents. Keys are encrypted at rest using your organization's unique KMS secret.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Key Form */}
        <section className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-background)] shadow-sm">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" />
              Add Provider Key
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--sidebar-text-secondary)]">Provider</label>
                <select 
                  className="w-full p-2.5 rounded-lg border border-[var(--sidebar-border)] bg-[var(--nav-hover)] text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={newKey.provider}
                  onChange={(e) => setNewKey({ ...newKey, provider: e.target.value })}
                >
                  {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--sidebar-text-secondary)]">Label (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. Production Anthropic Key"
                  className="w-full p-2.5 rounded-lg border border-[var(--sidebar-border)] bg-[var(--nav-hover)] text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={newKey.label}
                  onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--sidebar-text-secondary)]">API Key</label>
                <textarea 
                  className="w-full p-2.5 rounded-lg border border-[var(--sidebar-border)] bg-[var(--nav-hover)] text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 h-24"
                  placeholder="Paste your key here..."
                  value={newKey.key}
                  onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                />
                <p className="text-[10px] text-[var(--sidebar-text-secondary)] italic">
                  Key will be encrypted before storage. Only the last 4 chars will remain visible.
                </p>
              </div>

              <button 
                onClick={handleAddKey}
                disabled={isAdding}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {isAdding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Register Key
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-600 dark:text-yellow-500 leading-relaxed">
              <strong>Security Note:</strong> Active BYOK keys override system defaults. Ensure your keys have sufficient quota to prevent agent service interruptions.
            </p>
          </div>
        </section>

        {/* Keys Table (Issue #9) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-background)] overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--nav-hover)] border-b border-[var(--sidebar-border)]">
                  <th className="p-4 text-xs font-semibold text-[var(--sidebar-text-secondary)] uppercase tracking-wider">Provider</th>
                  <th className="p-4 text-xs font-semibold text-[var(--sidebar-text-secondary)] uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-semibold text-[var(--sidebar-text-secondary)] uppercase tracking-wider">Usage</th>
                  <th className="p-4 text-xs font-semibold text-[var(--sidebar-text-secondary)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sidebar-border)]">
                {keys.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-[var(--sidebar-text-secondary)] italic">
                      No BYOK keys configured. Athene is using system defaults.
                    </td>
                  </tr>
                ) : (
                  keys.map((k) => (
                    <tr key={k.id} className="hover:bg-[var(--nav-hover)]/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--nav-hover)] flex items-center justify-center p-1.5 border border-[var(--sidebar-border)]">
                             {/* Placeholder icons since we don't have images ready */}
                             <Activity className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-[var(--foreground)] capitalize">{k.provider}</div>
                            <div className="text-xs text-[var(--sidebar-text-secondary)] font-mono">{k.key_hint}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => toggleStatus(k.id, k.is_active)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all ${
                            k.is_active 
                              ? 'bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20' 
                              : 'bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20'
                          }`}
                        >
                          {k.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {k.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="text-[10px] text-[var(--sidebar-text-secondary)] uppercase font-medium">Last Used</div>
                          <div className="text-xs text-[var(--foreground)]">
                            {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => deleteKey(k.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--sidebar-text-secondary)] hover:text-red-500 transition-all"
                            title="Delete Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 rounded-lg hover:bg-blue-500/10 text-[var(--sidebar-text-secondary)] hover:text-blue-500 transition-all"
                            title="Rotate Key"
                            onClick={() => {
                                setNewKey({ provider: k.provider, key: '', label: k.label })
                                toast.info(`Enter new key for ${k.provider} to rotate.`)
                            }}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-2">
            <p className="text-[10px] text-[var(--sidebar-text-secondary)]">
              Total Managed Keys: {keys.length}
            </p>
            <a href="https://docs.athene.ai/byok" target="_blank" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
              Configuration Guide <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}

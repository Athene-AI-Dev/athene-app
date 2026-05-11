"use client";

import { useAuth } from "@clerk/nextjs";
import { ShieldCheck, Plus, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

export default function GrantsPage() {
  const { getToken } = useAuth();
  const [userId, setUserId] = useState("");
  const [deptIds, setDeptIds] = useState("");
  const [result, setResult] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function grant() {
    if (!userId || !deptIds) return;
    setIsLoading(true);
    const token = await getToken();
    const res = await fetch("/api/admin/bi-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId, granted_dept_ids: deptIds.split(",").map(v => v.trim()).filter(Boolean) })
    });
    setIsSuccess(res.ok);
    setResult(res.ok ? "Grant created successfully." : await res.text());
    setIsLoading(false);
    if (res.ok) { setUserId(""); setDeptIds(""); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">BI Access Grants</h1>
          <p className="text-sm text-slate-500">BI analysts only see bi_accessible documents from granted departments.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-medium text-slate-700">Create New Grant</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Clerk User ID</label>
            <input
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="user_xxxxxxxxxxxxxxx"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Department UUIDs</label>
            <input
              value={deptIds}
              onChange={e => setDeptIds(e.target.value)}
              placeholder="uuid1, uuid2, uuid3"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Separate multiple department UUIDs with commas.</p>
          </div>
        </div>
        <button
          onClick={grant}
          disabled={isLoading || !userId || !deptIds}
          className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {isLoading ? "Creating..." : "Create Grant"}
        </button>
      </div>

      {result && (
        <div className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium ${isSuccess ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {result}
        </div>
      )}
    </div>
  );
}
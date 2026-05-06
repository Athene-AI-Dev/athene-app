"use client";

import { useState, useCallback } from "react";
import { Check, X, Edit2, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingWriteAction } from "@/lib/langgraph/state";

interface ApprovalCardProps {
  threadId: string;
  action: PendingWriteAction;
  onComplete?: (content: string, citedSources: any[]) => void;
  onError?: (error: string) => void;
}

export function ApprovalCard({ threadId, action, onComplete, onError }: ApprovalCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editPayload, setEditPayload] = useState(
    JSON.stringify(action.payload, null, 2)
  );

  const toolIcon = action.tool.toLowerCase().includes("email") ? (
    <Mail className="w-5 h-5 text-[#D96FAB]" />
  ) : (
    <Calendar className="w-5 h-5 text-[#5290B8]" />
  );

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          action: "approve",
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`Approve failed: ${errText}`);
      }

      // Read the SSE stream from the resumed agent
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalContent = "";
        let finalSources: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) finalContent = data.content;
              if (data.cited_sources) finalSources = data.cited_sources;
              if (data.run_status === "completed" || data.final_answer) break;
            } catch {
              // Ignore parse errors
            }
          }
        }

        onComplete?.(finalContent, finalSources);
      } else {
        onComplete?.("", []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          action: "reject",
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`Reject failed: ${errText}`);
      }

      // Read the SSE stream from the resumed agent
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalContent = "";
        let finalSources: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) finalContent = data.content;
              if (data.cited_sources) finalSources = data.cited_sources;
              if (data.run_status === "completed" || data.final_answer) break;
            } catch {
              // Ignore parse errors
            }
          }
        }

        onComplete?.(finalContent, finalSources);
      } else {
        onComplete?.("", []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit() {
    setShowEdit(!showEdit);
  }

  function handleEditSave() {
    try {
      const parsed = JSON.parse(editPayload);
      // In a real implementation, this would send the edited payload
      // For now, show that edit was attempted
      setShowEdit(false);
      // TODO: Wire up to API with edited payload
    } catch {
      setError("Invalid JSON payload");
    }
  }

  return (
    <Card className="mx-6 mb-4 p-6 border-yellow-500/20 bg-yellow-500/5 rounded-[2rem]">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {toolIcon}
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Action Requires Approval
            </h4>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {action.tool.replace(/-/g, " ")}
            </p>
          </div>
        </div>

        {showEdit ? (
          <div className="space-y-3">
            <div className="bg-background/50 rounded-xl p-4 border border-white/5">
              <textarea
                value={editPayload}
                onChange={(e) => setEditPayload(e.target.value)}
                className="w-full h-32 bg-transparent text-xs text-foreground font-mono resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleEditSave}
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Save & Approve
              </Button>
              <Button
                onClick={() => setShowEdit(false)}
                variant="outline"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-background/50 rounded-xl p-4 border border-white/5">
              <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(action.payload, null, 2)}
              </pre>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {loading ? (
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>

              <Button
                onClick={handleEdit}
                disabled={loading}
                variant="outline"
                className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>

              <Button
                onClick={handleReject}
                disabled={loading}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          </>
        )}

        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Requested at: {new Date(action.requested_at).toLocaleString()}
        </p>
      </div>
    </Card>
  );
}

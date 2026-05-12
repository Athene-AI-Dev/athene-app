"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, Users, Building2 } from "lucide-react";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteModal({ isOpen, onClose, onSuccess }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDepts, setFetchingDepts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    setFetchingDepts(true);
    try {
      const res = await fetch("/api/admin/departments");
      const data = await res.json();
      if (res.ok) {
        setDepartments(data.departments);
        if (data.departments.length > 0 && !departmentId) {
          setDepartmentId(data.departments[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch departments", err);
    } finally {
      setFetchingDepts(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setRole("member");
    setDepartmentId(departments[0]?.id || "");
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, departmentId }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Invitation sent successfully!");
        resetForm();
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-card/95 backdrop-blur-2xl border-border text-foreground rounded-[2.5rem] shadow-2xl p-0 overflow-hidden font-['Space_Grotesk']">
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="text-3xl font-black tracking-tighter uppercase">Invite <span className="text-primary">Teammate</span></DialogTitle>
          <DialogDescription className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">
            Provision access to the AtheneAI neural grid.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleInvite} className="space-y-8 p-8">
          <div className="space-y-3">
            <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 flex items-center gap-3 px-2">
              <Mail className="w-3.5 h-3.5" />
              Intelligence Node Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@athene.ai"
              required
              className="h-14 bg-muted/20 border-border rounded-2xl focus:ring-primary/20 focus:border-primary/40 text-sm font-bold transition-all px-6"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 flex items-center gap-3 px-2">
                <Users className="w-3.5 h-3.5" />
                Access Tier
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-14 bg-muted/20 border-border rounded-2xl font-bold text-xs px-6 hover:bg-muted/30 transition-all">
                  <SelectValue placeholder="Select Tier" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground rounded-xl">
                  <SelectItem value="member">Network Member</SelectItem>
                  <SelectItem value="super_user">BI Analyst</SelectItem>
                  <SelectItem value="admin">System Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 flex items-center gap-3 px-2">
                <Building2 className="w-3.5 h-3.5" />
                Sector Node
              </Label>
              <Select value={departmentId} onValueChange={setDepartmentId} disabled={fetchingDepts || departments.length === 0}>
                <SelectTrigger className="h-14 bg-muted/20 border-border rounded-2xl font-bold text-xs px-6 hover:bg-muted/30 transition-all">
                  <SelectValue placeholder={fetchingDepts ? "Syncing..." : departments.length === 0 ? "No Nodes" : "Select Sector"} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground rounded-xl">
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length === 0 && !fetchingDepts && (
                <p className="text-[9px] text-destructive font-black uppercase tracking-widest mt-2 px-2">Initialize sectors first.</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 gap-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-all px-8"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || fetchingDepts || !departmentId || !email}
              className="h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl px-12 shadow-2xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Dispatch Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

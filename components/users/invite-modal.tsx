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
      <DialogContent className="sm:max-w-[425px] bg-[#06080c] border-white/10 text-white rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Invite Teammate</DialogTitle>
          <DialogDescription className="text-slate-400 font-medium">
            Send an invitation to join your organization.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleInvite} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Mail className="w-3 h-3" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-[#66ADE4] focus:border-[#66ADE4] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Users className="w-3 h-3" />
                Role
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-[#0c1015] border-white/10 text-white">
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="super_user">BI Analyst</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Building2 className="w-3 h-3" />
                Department
              </Label>
              <Select value={departmentId} onValueChange={setDepartmentId} disabled={fetchingDepts || departments.length === 0}>
                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl">
                  <SelectValue placeholder={fetchingDepts ? "Loading..." : departments.length === 0 ? "No depts" : "Select dept"} />
                </SelectTrigger>
                <SelectContent className="bg-[#0c1015] border-white/10 text-white">
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length === 0 && !fetchingDepts && (
                <p className="text-[9px] text-rose-400 font-bold mt-1">Setup departments first.</p>
              )}

            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="rounded-xl font-bold text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || fetchingDepts || !departmentId || !email}
              className="bg-[#66ADE4] hover:bg-[#599bc9] text-black font-black uppercase tracking-widest text-[10px] rounded-xl px-8 shadow-lg shadow-blue-500/20"
            >

              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invite"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

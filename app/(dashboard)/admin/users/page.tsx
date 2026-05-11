"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Users, 
  UserPlus, 
  Shield,
  ShieldAlert,
  ShieldCheck, 
  Building2, 
  Circle,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  UserCheck,
  MoreVertical
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteModal } from "@/components/users/invite-modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
}

interface UserMember {
  id: string;
  clerk_user_id: string | null;
  email: string;
  display_name: string;
  role: "admin" | "super_user" | "member";
  department_id: string;
  active: boolean;
  last_active_at: string | null;
  departments?: Department;
}

interface UserUpdates {
  role?: "admin" | "super_user" | "member";
  departmentId?: string;
  active?: boolean;
}


export default function UsersPage() {
  const [users, setUsers] = useState<UserMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotal(data.total);
      }
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);


  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/departments");
      const data = await res.json();
      if (res.ok) setDepartments(data.departments);
    } catch (err) {
      console.error("Failed to fetch departments");
    }
  }, []);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchUsers();
    fetchDepartments();
  }, [fetchUsers, fetchDepartments]);


  const handleUpdateUser = async (userId: string, updates: UserUpdates) => {
    if (updates.active === false) {
      const confirm = window.confirm("Are you sure you want to deactivate this account? This will immediately revoke their access.");
      if (!confirm) return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        toast.success("User updated successfully");
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update user");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };


  // Server-side search implemented in fetchUsers
  const filteredUsers = users;


  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-[#DA88B6]/20 text-[#DA88B6] border-[#DA88B6]/30 px-3 py-1 rounded-lg gap-1.5"><ShieldAlert className="w-3 h-3" /> Admin</Badge>;
      case "super_user":
        return <Badge className="bg-[#66ADE4]/20 text-[#66ADE4] border-[#66ADE4]/30 px-3 py-1 rounded-lg gap-1.5"><ShieldCheck className="w-3 h-3" /> BI Analyst</Badge>;
      default:
        return <Badge className="bg-white/5 text-slate-400 border-white/10 px-3 py-1 rounded-lg gap-1.5"><Shield className="w-3 h-3" /> Member</Badge>;
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-['Space_Grotesk']">
      
      <InviteModal 
        isOpen={isInviteOpen} 
        onClose={() => setIsInviteOpen(false)} 
        onSuccess={fetchUsers} 
      />

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#66ADE4]/10 to-[#DA88B6]/10 border border-white/5">
              <Users className="w-7 h-7 text-[#66ADE4]" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white">
              Identity <span className="text-[#DA88B6]">Governance</span>
            </h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
            Manage organization membership, roles, and departmental access. 
            Audit all administrative actions in real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4 hidden sm:flex">
              <span className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1">Population</span>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                <div className="h-2 w-2 rounded-full bg-[#66ADE4] animate-pulse" />
                <span className="text-xs font-bold text-white">{total} Members</span>
              </div>
           </div>
           <Button 
            onClick={() => setIsInviteOpen(true)}
            className="h-14 px-8 rounded-2xl bg-[#66ADE4] hover:bg-[#599bc9] text-black font-black uppercase tracking-widest text-[11px] gap-3 shadow-xl shadow-blue-500/10 group"
           >
             <UserPlus className="w-4 h-4" />
             Invite User
           </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center p-2 rounded-2xl bg-white/5 border border-white/5">
         <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition-colors group-focus-within:text-[#66ADE4]" />
            <input 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // Reset to page 1 on search
              }}
              placeholder="Search by name or email..." 
              className="w-full h-12 pl-12 pr-4 bg-transparent outline-none text-sm font-medium text-white placeholder:text-slate-600"
            />
         </div>
      </div>


      {/* Users Table */}
      <div className="rounded-[2.5rem] bg-white/5 border border-white/5 overflow-hidden backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-white/5 border-b border-white/5">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Member</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Role</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Department</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Active</TableHead>
              <TableHead className="text-right py-6 px-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-white/5">
                  <TableCell colSpan={6} className="py-8 px-8"><Loader2 className="w-6 h-6 animate-spin text-slate-700 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow className="border-white/5">
                <TableCell colSpan={6} className="py-20 text-center">
                  <p className="text-slate-500 font-bold">No members found matching your search.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-white/[0.02] border-white/5 group transition-colors">
                  <TableCell className="py-6 px-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#66ADE4]/20 to-[#DA88B6]/20 flex items-center justify-center text-xs font-black text-white border border-white/5">
                        {user.display_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-white tracking-tight">{user.display_name}</span>
                        <span className="text-xs text-slate-500 font-medium">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      <Building2 className="w-3.5 h-3.5 opacity-50" />
                      {user.departments?.name || "Unassigned"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#7AADCF]">
                        <Circle className="w-2 h-2 fill-current animate-pulse" />
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <Circle className="w-2 h-2 fill-current" />
                        Deactivated
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-500">
                    {user.last_active_at && mounted ? new Date(user.last_active_at).toLocaleDateString() : "Never"}
                  </TableCell>

                  <TableCell className="text-right py-6 px-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/10">
                          <MoreVertical className="w-4 h-4 text-slate-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-[#0c1015] border-white/10 text-white rounded-xl">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Management Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/5" />
                        
                        <DropdownMenuLabel className="text-[9px] font-bold text-slate-600 mt-2">Modify Role</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleUpdateUser(user.id, { role: "admin" })} className="gap-2 cursor-pointer">
                          <ShieldAlert className="w-4 h-4 text-[#DA88B6]" /> Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateUser(user.id, { role: "super_user" })} className="gap-2 cursor-pointer">
                          <ShieldCheck className="w-4 h-4 text-[#66ADE4]" /> BI Analyst
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateUser(user.id, { role: "member" })} className="gap-2 cursor-pointer">
                          <Shield className="w-4 h-4 text-slate-400" /> Member
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator className="bg-white/5" />
                        <DropdownMenuLabel className="text-[9px] font-bold text-slate-600 mt-2">Department</DropdownMenuLabel>
                        {departments.map(dept => (
                          <DropdownMenuItem 
                            key={dept.id} 
                            onClick={() => handleUpdateUser(user.id, { departmentId: dept.id })}
                            className={cn("gap-2 cursor-pointer", user.department_id === dept.id && "bg-[#66ADE4]/10 text-[#66ADE4]")}
                          >
                            <Building2 className="w-4 h-4" /> {dept.name}
                          </DropdownMenuItem>
                        ))}
                        
                        <DropdownMenuSeparator className="bg-white/5" />
                        {user.active ? (
                          <DropdownMenuItem 
                            onClick={() => handleUpdateUser(user.id, { active: false })}
                            className="gap-2 text-red-400 focus:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" /> Deactivate Account
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleUpdateUser(user.id, { active: true })}
                            className="gap-2 text-[#7AADCF] focus:text-[#7AADCF] cursor-pointer"
                          >
                            <UserCheck className="w-4 h-4" /> Reactivate Account
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {/* Pagination */}
        <div className="bg-white/[0.03] border-t border-white/5 px-8 py-4 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">
            {search ? `Found ${total} matches` : `Showing ${users.length} of ${total} members`}
          </span>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="h-8 w-8 p-0 rounded-lg border-white/10 hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
              className="h-8 w-8 p-0 rounded-lg border-white/10 hover:bg-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

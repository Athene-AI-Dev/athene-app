import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Bot, User, Menu } from "lucide-react";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";

export default function ChatPage() {
  return (
    <div className="flex h-screen w-full flex-col bg-[#FAFAFA] dark:bg-[#0A0A0A] overflow-hidden font-sans relative">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none opacity-60 dark:opacity-20 transition-all duration-700" />
      
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200/50 bg-white/50 px-6 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/50 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden">
             <Menu className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </Button>
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-inner">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-锌-50">
            Athene Agent
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Secure Network</span>
          </div>
          <OrganizationSwitcher hidePersonal={false} />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 custom-scrollbar relative z-10 h-full">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-32">
          
          {/* AI Greeting Message */}
          <div className="flex flex-col gap-2 relative group opacity-0 animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards duration-700 ease-out">
            <div className="flex items-center gap-2 pb-1">
               <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shadow-sm border border-indigo-500/20">
                 <Bot className="h-4 w-4" />
               </div>
               <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Athene</span>
            </div>
            <Card className="max-w-[85%] sm:max-w-xl rounded-2xl rounded-tl-sm px-5 py-4 bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800/60 shadow-sm leading-relaxed text-[15px] text-zinc-700 dark:text-zinc-300">
              Welcome to the Athene secure workspace. I am connected to the Supabase vector engine and actively enforcing strict Row-Level Security for your organization. How can I assist you with your department's data today?
            </Card>
          </div>

        </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A] px-4 pb-6 pt-16 md:px-8">
        <div className="mx-auto max-w-3xl">
          <Card className="flex items-end gap-2 rounded-3xl bg-white dark:bg-zinc-900 p-2 shadow-lg shadow-black/5 dark:shadow-black/20 border-zinc-200/80 dark:border-zinc-800 transition-all focus-within:shadow-indigo-500/10 focus-within:border-indigo-500/30">
            <div className="flex-1 pl-4 pt-1 pb-1">
              <Input
                placeholder="Ask Athene to search securely..."
                className="w-full resize-none bg-transparent border-0 px-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base shadow-none min-h-[44px]"
              />
            </div>
            <Button
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 hover:opacity-90 hover:scale-105 transition-all duration-200 shadow-md"
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </Card>
          <div className="mt-3 flex justify-center">
            <span className="text-xs text-zinc-500 dark:text-zinc-500 font-medium tracking-wide">
              Protected by Unified Vector RLS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

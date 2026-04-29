import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();
  
  // Redirect to /chat if already authenticated
  if (userId) {
    redirect("/chat");
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white shadow-xl shadow-slate-200/50 border border-slate-200 rounded-2xl p-8 sm:p-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="mb-8 flex flex-col items-center">
            <Image
                src="/athene-logo.png"
                alt="Athene AI"
                width={180}
                height={54}
                className="object-contain"
                priority
            />
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight mb-3">
            Welcome to Athene
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mb-10 leading-relaxed">
            The intelligent assistant for orchestrating your organization's data, agents, and workflows.
        </p>
        
        <div className="flex flex-col gap-3">
          <Link 
              href="/sign-in"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 h-11 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors shadow-sm"
          >
              Sign In to Continue
              <ArrowRight className="w-4 h-4" />
          </Link>
          
          <div className="mt-4">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <Link href="/sign-up" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

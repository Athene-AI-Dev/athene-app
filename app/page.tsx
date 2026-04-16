import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/chat"); // Automatically send logged-in users to the Athene Dashboard
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4 min-h-screen">
      <main className="flex flex-col items-center justify-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Athene AI Framework
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Secure, multi-tenant intelligence.
        </p>
        <a 
          href="/sign-in" 
          className="rounded-full bg-zinc-900 px-8 py-3 font-semibold text-white hover:bg-zinc-800 transition-colors dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Sign In to Dashboard
        </a>
      </main>
    </div>
  );
}

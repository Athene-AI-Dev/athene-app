import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/briefing");
  return <LandingPage />;
}

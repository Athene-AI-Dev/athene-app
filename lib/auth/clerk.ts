import { auth } from "@clerk/nextjs/server";

export async function getAuth() {
  return await auth();
}

export async function getOrgId() {
  const { orgId } = await auth();
  if (!orgId) {
    throw new Error("No organization selected");
  }
  return orgId;
}

export async function getUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

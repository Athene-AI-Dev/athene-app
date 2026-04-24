// TODO: This is a scaffold route. Before shipping, replace the simulated work below
// with real logic. Also ensure verifyQStashSignature in lib/qstash/verify.ts
// validates the `Upstash-Signature` header using @upstash/qstash's Receiver.
import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/qstash/verify';
import { releaseSlot } from '@/lib/qstash/client';

export async function POST(req: Request) {
  // 1. Verify QStash Signature (MUST be done before any processing)
  const isValid = await verifyQStashSignature(req);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
  }

  let body: any;
  try {
    // We can safely parse JSON because we cloned the request in verifyQStashSignature
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { orgId, sourceType } = body;

  if (!orgId || !sourceType) {
    return NextResponse.json({ error: 'Missing req parameters: orgId or sourceType' }, { status: 400 });
  }

  // 2. Process payload and simulate a long-running background task
  console.log(`[Worker - Example] Processing job for org: ${orgId}, source: ${sourceType}`);
  
  // Simulated asynchronous work
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  console.log(`[Worker - Example] Background job finished for org: ${orgId}`);

  // 3. Release Concurrency Slot to allow pending jobs out of the table and into QStash
  await releaseSlot(orgId, sourceType);

  // Return success response to acknowledge QStash execution
  return NextResponse.json({ success: true });
}

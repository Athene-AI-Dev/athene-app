import { NextResponse } from 'next/server';
import { dispatchThrottled } from '@/lib/qstash/client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ngrokUrl = searchParams.get('ngrok');

    if (!ngrokUrl) {
      return NextResponse.json({ error: "Missing ?ngrok=https://your-url.ngrok-free.app parameter" }, { status: 400 });
    }

    const targetUrl = `${ngrokUrl}/api/worker/example`;

    const res = await dispatchThrottled({
      orgId: "demo-org",
      sourceType: "live-test",
      url: targetUrl,
      body: { orgId: "demo-org", sourceType: "live-test", hello: "world" }
    });

    return NextResponse.json({
      success: true,
      message: "QStash message dispatched!",
      targetUrl,
      qStashResponse: res
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

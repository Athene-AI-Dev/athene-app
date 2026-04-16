import { NextResponse } from 'next/server';
import { cached, incrWithExpire } from '@/lib/redis/client';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: "Unauthorized in production without auth" }, { status: 401 });
  }

  try {
    // 1. Test incrWithExpire
    const demoKey = 'test_counter_live';
    const currentCount = await incrWithExpire(demoKey, 60); // 60s expiration

    // 2. Test caching function
    const cacheResult = await cached('test_cache_node', 60, async () => {
      return { timestamp: new Date().toISOString(), message: "Freshly computed!" };
    });

    return NextResponse.json({
      success: true,
      message: "Connected to real Upstash!",
      currentCounterValue: currentCount,
      cacheResult
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

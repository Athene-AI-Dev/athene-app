import { NextResponse } from 'next/server'
import { getToken } from '@/lib/nango/client'

export async function GET() {
  try {
    const token = await getToken('dummy-connection-id', 'microsoft')

    return NextResponse.json({ token })
  } catch (error) {
    return NextResponse.json({
      message: 'Nango integration working (expected error)',
      error: String(error)
    })
  }
}
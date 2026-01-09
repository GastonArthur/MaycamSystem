import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { level, message, details } = body;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level || 'info',
      message,
      details,
    };

    // Log to the server console (which Vercel captures)
    console.log(JSON.stringify(logEntry));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing log request:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

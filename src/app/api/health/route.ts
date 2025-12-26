import { NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';

export async function GET() {
  try {
    // Add any health checks here (e.g., database connection, Redis connection)
    return NextResponse.json(
      { status: 'healthy', timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Health check failed', error);
    return NextResponse.json(
      { status: 'unhealthy', error: 'Service check failed' },
      { status: 503 }
    );
  }
} 
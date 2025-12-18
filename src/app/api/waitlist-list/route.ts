import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@/shared/lib/logger';

const WAITLIST_PASSWORD = process.env.WAITLIST_PASSWORD;

export async function POST(req: NextRequest) {
  // Validate environment variable
  if (!WAITLIST_PASSWORD) {
    logger.error('WAITLIST_PASSWORD environment variable is not set');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const { password } = await req.json();
  if (!password || password !== WAITLIST_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const filePath = path.resolve(process.cwd(), 'data/waitlist.txt');
    const content = await fs.readFile(filePath, 'utf8');
    const emails = content.split('\n').filter(Boolean);
    return NextResponse.json({ emails });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read waitlist' }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import { checkReminders } from '@/shared/utils/reminderJob';
const { logger } = require('@/shared/lib/logger');

export async function POST() {
  try {
    logger.debug('Manual reminder check triggered');
    await checkReminders();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Reminder check completed successfully' 
    });
  } catch (error) {
    logger.error('Error in reminder check', error);
    return NextResponse.json(
      { error: 'Failed to check reminders' },
      { status: 500 }
    );
  }
} 
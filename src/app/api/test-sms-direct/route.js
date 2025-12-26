import { NextResponse } from 'next/server';
import { sendSMS } from '@/shared/utils/sendSMS';
const { logger } = require('@/shared/lib/logger');

export async function POST(req) {
  try {
    logger.debug('Direct SMS test starting');

    // Test sending SMS directly to the client phone number
    const testMessage = `🎉 Booking Confirmed!\n\nService: Quick cut\nDate: Thursday, July 24, 2025\nTime: 2:24 PM\nBarber: Yassy Cuts\n\nSee you there!`;

    logger.debug('Attempting to send direct SMS', { phoneNumber: '9083407527', carrier: 'verizon' });
    
    await sendSMS({ 
      phoneNumber: '9083407527', 
      carrier: 'verizon', 
      message: testMessage 
    });

    logger.debug('Direct SMS sent successfully');

    return NextResponse.json({
      success: true,
      message: 'Direct SMS test completed successfully',
      details: {
        phoneNumber: '9083407527',
        carrier: 'verizon',
        messageLength: testMessage.length
      }
    });

  } catch (error) {
    logger.error('Direct SMS test error', error);
    return NextResponse.json({ 
      error: 'Direct SMS test failed',
      details: error.message 
    }, { status: 500 });
  }
} 
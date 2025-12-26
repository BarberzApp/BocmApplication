import { NextResponse } from 'next/server';
import { sendSMS } from '@/shared/utils/sendSMS';
const { logger } = require('@/shared/lib/logger');

export async function POST(req) {
  try {
    const { phoneNumber, carrier } = await req.json();
    
    if (!phoneNumber || !carrier) {
      return NextResponse.json({ 
        error: 'Phone number and carrier are required' 
      }, { status: 400 });
    }

    logger.debug('Testing client SMS', { phoneNumber, carrier });

    // Send a test booking confirmation message
    const testMessage = `🎉 Booking Confirmed!\n\nService: Test Service\nDate: Thursday, July 24, 2025\nTime: 2:24 PM\nBarber: Test Barber\n\nSee you there!`;

    await sendSMS({ 
      phoneNumber, 
      carrier, 
      message: testMessage 
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test SMS sent successfully',
      details: {
        phoneNumber,
        carrier,
        messageLength: testMessage.length
      }
    });

  } catch (error) {
    logger.error('Test client SMS error', error);
    return NextResponse.json({ 
      error: 'Failed to send test SMS',
      details: error.message 
    }, { status: 500 });
  }
} 
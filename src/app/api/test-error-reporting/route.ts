import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/shared/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json()
    
    switch (type) {
      case 'javascript':
        // Simulate a JavaScript error
        throw new Error('Test JavaScript error from API endpoint')
        
      case 'network':
        // Simulate a network error
        throw new Error('Network timeout - failed to connect to external service')
        
      case 'database':
        // Simulate a database error
        throw new Error('Database connection failed - unable to execute query')
        
      case 'validation':
        // Simulate a validation error
        throw new Error('Invalid input data - missing required fields')
        
      default:
        throw new Error('Unknown test error type')
    }
  } catch (error) {
    logger.error('Test error triggered', error)
    
    // Re-throw to trigger error reporting
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: error.message,
          message: 'Test error triggered successfully - check SMS notifications'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Error testing endpoint',
    usage: 'POST with { "type": "javascript|network|database|validation" }',
    note: 'This will trigger SMS notifications to the developer'
  })
}
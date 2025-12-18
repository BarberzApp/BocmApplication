import { NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export async function POST(request: Request) {
  try {
    // Verify super admin access
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user || user.email !== 'primbocm@gmail.com') {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      )
    }

    const { userId, isDisabled } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Update the user's disabled status
    const { error } = await supabase
      .from('profiles')
      .update({ is_disabled: isDisabled })
      .eq('id', userId)

    if (error) {
      logger.error('Error updating account status', error)
      return NextResponse.json(
        { error: 'Failed to update account status' },
        { status: 500 }
      )
    }

    const statusText = isDisabled ? 'disabled' : 'enabled'
    
    return NextResponse.json({
      success: true,
      message: `Account ${statusText} successfully`
    })
  } catch (error) {
    logger.error('Super admin account status error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
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

    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['client', 'barber'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "client" or "barber"' },
        { status: 400 }
      )
    }

    // Update the user's role
    const { error } = await supabase
      .from('profiles')
      .update({ role: role })
      .eq('id', userId)

    if (error) {
      logger.error('Error updating user role', error)
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      )
    }

    // If changing to barber role, ensure they have a barber record
    if (role === 'barber') {
      const { data: existingBarber } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!existingBarber) {
        // Create barber record if it doesn't exist
        await supabase
          .from('barbers')
          .insert({
            user_id: userId,
            business_name: 'New Business',
            is_developer: false
          })
      }
    }

    return NextResponse.json({
      success: true,
      message: `User role updated to ${role}`
    })
  } catch (error) {
    logger.error('Super admin update role error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
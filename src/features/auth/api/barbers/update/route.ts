import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logger } from '@/shared/lib/logger'

export async function PUT(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ...updates } = await request.json()

    // Verify the user is authorized to update this profile
    if (session.user.id !== id) {
      logger.warn('Unauthorized access attempt', {
        userId: session.user.id,
        targetId: id,
      })
      return NextResponse.json(
        { error: 'Unauthorized to update this profile' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('barbers')
      .update(updates)
      .eq('user_id', id)
      .select()
      .single()

    if (error) {
      logger.error('Error updating barber profile', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error('Error in barber update route', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
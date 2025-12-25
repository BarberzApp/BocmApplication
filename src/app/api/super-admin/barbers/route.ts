import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export async function GET(request: Request) {
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

    // Fetch barbers with comprehensive data using admin client
    const { data: barbers, error } = await supabaseAdmin
      .from('barbers')
      .select(`
        id,
        user_id,
        business_name,
        is_developer,
        created_at,
        profiles (
          id,
          name,
          email,
          role,
          phone,
          location,
          bio,
          is_disabled,
          is_public,
          join_date,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching barbers', error)
      return NextResponse.json(
        { error: 'Failed to fetch barbers' },
        { status: 500 }
      )
    }

    // Normalize profiles data (handle both array and object formats)
    const normalizedBarbers = (barbers || []).map(barber => ({
      ...barber,
      profiles: Array.isArray(barber.profiles) ? barber.profiles[0] : barber.profiles
    }))

    return NextResponse.json({
      success: true,
      barbers: normalizedBarbers
    })
  } catch (error) {
    logger.error('Super admin barbers error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
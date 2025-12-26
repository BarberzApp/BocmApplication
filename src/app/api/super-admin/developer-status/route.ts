import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

const SUPER_ADMIN_EMAIL = 'primbocm@gmail.com'

export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user || user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { barberId, isDeveloper } = body

    if (!barberId || typeof isDeveloper !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // Verify barber exists first
    const { data: existingBarber, error: checkError } = await supabaseAdmin
      .from('barbers')
      .select('id, business_name, is_developer')
      .eq('id', barberId)
      .single()

    if (checkError || !existingBarber) {
      logger.error('Barber not found', { barberId, error: checkError })
      return NextResponse.json(
        { error: 'Barber not found' },
        { status: 404 }
      )
    }

    // Update the barber's developer status using admin client
    const { error } = await supabaseAdmin
      .from('barbers')
      .update({ is_developer: isDeveloper })
      .eq('id', barberId)

    if (error) {
      logger.error('Error updating developer status', error)
      return NextResponse.json(
        { error: 'Failed to update developer status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Developer status ${isDeveloper ? 'enabled' : 'disabled'} successfully`
    })
  } catch (error) {
    logger.error('Developer status update error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user || user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    // Get all barbers with their developer status using admin client
    const { data, error } = await supabaseAdmin
      .from('barbers')
      .select(`
        id,
        user_id,
        business_name,
        is_developer,
        created_at,
        profiles!inner (
          name,
          email
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

    // Transform the data to match our interface
    const transformedData = (data || []).map(barber => ({
      ...barber,
      profiles: Array.isArray(barber.profiles) ? barber.profiles[0] : barber.profiles
    }))

    return NextResponse.json({
      success: true,
      barbers: transformedData
    })
  } catch (error) {
    logger.error('Get barbers error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
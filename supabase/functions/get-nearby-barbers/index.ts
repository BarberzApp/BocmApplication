import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse query parameters
    const url = new URL(req.url)
    const lat = parseFloat(url.searchParams.get('lat') || '')
    const lon = parseFloat(url.searchParams.get('lon') || '')
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT) : DEFAULT_LIMIT

    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid lat/lon parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (lat < -90 || lat > 90) {
      return new Response(
        JSON.stringify({ error: 'Latitude must be between -90 and 90' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (lon < -180 || lon > 180) {
      return new Response(
        JSON.stringify({ error: 'Longitude must be between -180 and 180' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Haversine formula SQL query
    // Distance in meters: 6371000 * acos(...)
    const query = `
      SELECT
        b.id,
        b.user_id,
        b.bio,
        b.specialties,
        b.price_range,
        b.business_name,
        b.instagram,
        b.twitter,
        b.tiktok,
        b.facebook,
        b.latitude,
        b.longitude,
        b.city,
        b.state,
        b.created_at,
        b.updated_at,
        p.name,
        p.username,
        p.location as profile_location,
        p.bio as profile_bio,
        p.avatar_url,
        p.coverphoto,
        p.is_public,
        (
          6371000 * acos(
            cos(radians($1)) * cos(radians(b.latitude)) *
            cos(radians(b.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(b.latitude))
          )
        ) AS distance_m
      FROM barbers b
      INNER JOIN profiles p ON b.user_id = p.id
      WHERE b.latitude IS NOT NULL
        AND b.longitude IS NOT NULL
        AND p.is_public = true
      ORDER BY distance_m
      LIMIT $3
    `

    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: query,
      params: [lat, lon, limit]
    })

    // If RPC doesn't work, use direct query with parameterized values
    if (error || !data) {
      // Fallback: Use Supabase query builder with raw SQL for distance calculation
      const { data: barbersData, error: barbersError } = await supabase
        .from('barbers')
        .select(`
          id,
          user_id,
          bio,
          specialties,
          price_range,
          business_name,
          instagram,
          twitter,
          tiktok,
          facebook,
          latitude,
          longitude,
          city,
          state,
          created_at,
          updated_at,
          profiles:user_id(
            name,
            username,
            location,
            bio,
            avatar_url,
            coverphoto,
            is_public
          )
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .eq('profiles.is_public', true)
        .limit(limit)

      if (barbersError) {
        throw barbersError
      }

      // Calculate distance and sort in application layer
      const barbersWithDistance = (barbersData || [])
        .map((barber: any) => {
          const profile = barber.profiles
          if (!profile || !profile.is_public) return null

          // Haversine formula
          const R = 6371000 // Earth's radius in meters
          const dLat = ((barber.latitude - lat) * Math.PI) / 180
          const dLon = ((barber.longitude - lon) * Math.PI) / 180
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat * Math.PI) / 180) *
              Math.cos((barber.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const distance_m = R * c

          return {
            id: barber.id,
            user_id: barber.user_id,
            name: profile.name,
            username: profile.username,
            business_name: barber.business_name || profile.name,
            location: profile.location || barber.city || 'Location',
            bio: barber.bio || profile.bio,
            specialties: barber.specialties || [],
            price_range: barber.price_range,
            avatar_url: profile.avatar_url,
            coverphoto: profile.coverphoto,
            latitude: barber.latitude,
            longitude: barber.longitude,
            city: barber.city,
            state: barber.state,
            instagram: barber.instagram,
            twitter: barber.twitter,
            tiktok: barber.tiktok,
            facebook: barber.facebook,
            distance_m: Math.round(distance_m), // Round to nearest meter
          }
        })
        .filter((b: any) => b !== null)
        .sort((a: any, b: any) => a.distance_m - b.distance_m)
        .slice(0, limit)

      return new Response(
        JSON.stringify({ barbers: barbersWithDistance }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ barbers: data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error fetching nearby barbers:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch nearby barbers' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})


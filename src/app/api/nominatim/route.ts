import { NextRequest, NextResponse } from 'next/server';
import { handleCorsPreflight, withCors } from '@/shared/lib/cors';
import { logger } from '@/shared/lib/logger';

export async function GET(request: NextRequest) {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) return preflightResponse;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  
  let query = q;
  if (city && state) {
    query = `${city}, ${state}`;
  } else if (city) {
    query = city;
  } else if (state) {
    query = state;
  }
  if (!query) {
    const response = NextResponse.json({ error: 'Missing query' }, { status: 400 });
    return withCors(request, response);
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'BarberApp/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    const jsonResponse = NextResponse.json(data);
    return withCors(request, jsonResponse);
  } catch (error) {
    logger.error('Error fetching from Nominatim', error);
    const errorResponse = NextResponse.json({ error: 'Failed to fetch from Nominatim' }, { status: 500 });
    return withCors(request, errorResponse);
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request) || new NextResponse(null, { status: 200 });
} 
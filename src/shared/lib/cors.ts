/**
 * CORS utility for Next.js API routes
 * Provides secure CORS configuration based on environment
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const allowedOrigins: string[] = []

  // Add production URL
  if (appUrl) {
    allowedOrigins.push(appUrl)
    // Also add without www if it has www
    if (appUrl.includes('www.')) {
      allowedOrigins.push(appUrl.replace('www.', ''))
    }
  }

  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000')
    allowedOrigins.push('http://localhost:3002')
    // Allow ngrok URLs in development
    if (process.env.NGROK_URL) {
      allowedOrigins.push(process.env.NGROK_URL)
    }
  }

  return allowedOrigins
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  
  const allowedOrigins = getAllowedOrigins()
  return allowedOrigins.some(allowed => {
    try {
      const allowedUrl = new URL(allowed)
      const originUrl = new URL(origin)
      return allowedUrl.origin === originUrl.origin
    } catch {
      return allowed === origin
    }
  })
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin')
  const allowedOrigin = isOriginAllowed(origin) ? origin : getAllowedOrigins()[0] || '*'

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflight(request: NextRequest): NextResponse | null {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: getCorsHeaders(request),
    })
  }
  return null
}

/**
 * Add CORS headers to a response
 */
export function withCors(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const corsHeaders = getCorsHeaders(request)
  
  // Add CORS headers to existing headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}


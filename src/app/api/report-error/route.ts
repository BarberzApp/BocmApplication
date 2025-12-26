import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/shared/lib/logger'

// Developer contact info for error reporting
const DEVELOPER_EMAIL = 'bocmtexter@gmail.com'

// Email sending function using the existing utility pattern
async function sendErrorEmail(to: string, subject: string, htmlContent: string, textContent: string) {
  try {
    // Use absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/send-error-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        html: htmlContent,
        text: textContent
      })
    })
    
    if (!response.ok) {
      throw new Error(`Email API failed: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    logger.error('Failed to send error email', error)
    throw error
  }
}

interface ErrorReport {
  message: string
  stack?: string
  url?: string
  userAgent?: string
  userId?: string
  timestamp: string
  errorType: 'javascript' | 'react' | 'api' | 'network' | 'unhandled'
  componentStack?: string
  retryCount?: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export async function POST(request: NextRequest) {
  try {
    const errorData: ErrorReport = await request.json()
    
    // Log the error
    logger.error('Error Report Received', undefined, {
      ...errorData,
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Only send email for medium+ severity errors to avoid spam
    if (errorData.severity !== 'low') {
      await sendErrorNotification(errorData, request)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Error reported successfully' 
    })
  } catch (error) {
    logger.error('Failed to report error', error)
    return NextResponse.json(
      { error: 'Failed to report error' },
      { status: 500 }
    )
  }
}

async function sendErrorNotification(errorData: ErrorReport, request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = errorData.userAgent || 'unknown'
    const url = errorData.url || 'unknown'
    
    // Determine severity emoji and color
    const severityInfo = {
      low: { emoji: '⚠️', color: '#FFA500' },
      medium: { emoji: '🔥', color: '#FF6B35' },
      high: { emoji: '🚨', color: '#FF0000' },
      critical: { emoji: '💥', color: '#8B0000' }
    }[errorData.severity]

    // Create detailed HTML email
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #000000, #333333); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .severity { display: inline-block; padding: 4px 12px; border-radius: 16px; color: white; font-weight: bold; background-color: ${severityInfo.color}; }
        .error-details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .stack-trace { background-color: #1a1a1a; color: #00ff00; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto; }
        .metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
        .metadata-item { background-color: #f8f9fa; padding: 10px; border-radius: 4px; }
        .metadata-label { font-weight: bold; color: #666; font-size: 12px; }
        .metadata-value { color: #333; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${severityInfo.emoji} BOCM Error Alert</h1>
          <p>An error has occurred in the BOCM application</p>
        </div>
        <div class="content">
          <div style="margin-bottom: 20px;">
            <span class="severity">${errorData.severity.toUpperCase()}</span>
            <span style="margin-left: 10px; color: #666;">Type: ${errorData.errorType}</span>
          </div>
          
          <div class="error-details">
            <h3>Error Message</h3>
            <p><strong>${errorData.message}</strong></p>
          </div>

          <div class="metadata">
            <div class="metadata-item">
              <div class="metadata-label">URL</div>
              <div class="metadata-value">${url}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">User</div>
              <div class="metadata-value">${errorData.userId || 'Guest'}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Timestamp</div>
              <div class="metadata-value">${new Date(errorData.timestamp).toLocaleString()}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">IP Address</div>
              <div class="metadata-value">${ip}</div>
            </div>
            ${errorData.retryCount ? `
            <div class="metadata-item">
              <div class="metadata-label">Retry Count</div>
              <div class="metadata-value">${errorData.retryCount}</div>
            </div>
            ` : ''}
          </div>

          ${errorData.stack ? `
          <h3>Stack Trace</h3>
          <div class="stack-trace">${errorData.stack}</div>
          ` : ''}

          ${errorData.componentStack ? `
          <h3>Component Stack</h3>
          <div class="stack-trace">${errorData.componentStack}</div>
          ` : ''}

          <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
            <h4>User Agent</h4>
            <p style="font-size: 12px; color: #666;">${userAgent}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    // Create plain text version
    const textContent = `${severityInfo.emoji} BOCM Error Alert

Type: ${errorData.errorType}
Severity: ${errorData.severity.toUpperCase()}
URL: ${url}
User: ${errorData.userId || 'Guest'}
Time: ${new Date(errorData.timestamp).toLocaleString()}
IP: ${ip}
${errorData.retryCount ? `Retries: ${errorData.retryCount}\n` : ''}

Error Message:
${errorData.message}

${errorData.stack ? `Stack Trace:\n${errorData.stack}\n\n` : ''}
${errorData.componentStack ? `Component Stack:\n${errorData.componentStack}\n\n` : ''}

User Agent: ${userAgent}
`

    const subject = `${severityInfo.emoji} BOCM ${errorData.severity.toUpperCase()} Error - ${errorData.errorType}`
    
    await sendErrorEmail(DEVELOPER_EMAIL, subject, htmlContent, textContent)
    logger.info(`Error email sent successfully to ${DEVELOPER_EMAIL}`)
  } catch (emailError) {
    logger.error('Failed to send error email', emailError)
    // Don't throw - we don't want error reporting to fail the app
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/shared/lib/logger'

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 1000) // Limit length
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 5 // Max 5 requests per 15 minutes

  const key = ip
  const current = rateLimitStore.get(key)

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    
    // Check rate limit
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, category, subject, message } = body

    // Validate required fields
    if (!name || !email || !category || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Sanitize inputs
    const sanitizedData = {
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      category: sanitizeInput(category),
      subject: sanitizeInput(subject),
      message: sanitizeInput(message)
    }

    // Validate category
    const validCategories = ['booking', 'payment', 'account', 'technical', 'general', 'feedback']
    if (!validCategories.includes(sanitizedData.category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Send to Slack
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
    
    if (!slackWebhookUrl) {
      logger.error('SLACK_WEBHOOK_URL environment variable is not set')
      return NextResponse.json(
        { error: 'Slack integration not configured' },
        { status: 500 }
      )
    }

    // Create Slack message
    const slackMessage = {
      text: `🚨 New Support Request - ${sanitizedData.category.toUpperCase()}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🚨 New Support Request - ${sanitizedData.category.toUpperCase()}`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${sanitizedData.name}`
            },
            {
              type: "mrkdwn",
              text: `*Email:*\n${sanitizedData.email}`
            },
            {
              type: "mrkdwn",
              text: `*Category:*\n${sanitizedData.category}`
            },
            {
              type: "mrkdwn",
              text: `*Subject:*\n${sanitizedData.subject}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Message:*\n${sanitizedData.message}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `📅 Received: ${new Date().toLocaleString()} | 💬 Reply to: ${sanitizedData.email}`
            }
          ]
        }
      ]
    }

    // Send to Slack
    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    })

    if (!slackResponse.ok) {
      throw new Error('Failed to send message to Slack')
    }

    return NextResponse.json(
      { message: 'Support request sent successfully' },
      { status: 200 }
    )

  } catch (error) {
    logger.error('Error sending support email', error)
    return NextResponse.json(
      { error: 'Failed to send support request' },
      { status: 500 }
    )
  }
}

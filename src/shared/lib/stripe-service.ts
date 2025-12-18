import { loadStripe } from "@stripe/stripe-js"
import type { Stripe as StripeType } from "@stripe/stripe-js"
import { logger } from './logger'

// Types
export type PaymentMethod = {
  id: string
  type: "card" | "paypal" | "applepay" | "googlepay"
  last4?: string
  brand?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
}

export type PaymentIntent = {
  id: string
  amount: number
  currency: string
  status: "requires_payment_method" | "requires_confirmation" | "processing" | "succeeded" | "canceled"
  clientSecret: string
  metadata?: Record<string, string>
}

export type StripeAccount = {
  id: string
  businessType: "individual" | "company"
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirements: {
    currentlyDue: string[]
    eventuallyDue: string[]
  }
}

export type StripeTransaction = {
  id: string
  amount: number
  fee: number
  net: number
  currency: string
  status: "pending" | "available" | "paid"
  created: Date
  description: string
  type: "payment" | "payout" | "refund" | "adjustment"
}

export type StripePayout = {
  id: string
  amount: number
  currency: string
  status: "pending" | "in_transit" | "paid" | "failed" | "canceled"
  arrivalDate: Date
  method: "standard" | "instant"
  destination: string
}

// Types for earnings data
export type MonthlyEarnings = {
  current: number
  previous: number
  trend: "up" | "down"
  percentage: number
}

// Singleton to ensure we only load Stripe once
let stripePromise: Promise<StripeType | null>

// Initialize Stripe
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}

// Customer management
export const createCustomer = async (email: string, name: string): Promise<string> => {
  // In a real app, this would be a server-side API call to Stripe
  logger.debug(`Creating Stripe customer for ${name}`, { email })
  return `cus_${Math.random().toString(36).substring(2, 15)}`
}

export const updateCustomer = async (customerId: string, data: { name?: string; email?: string }) => {
  logger.debug(`Updating Stripe customer ${customerId}`, { data })
  return true
}

// Payment methods
export const getPaymentMethods = async (customerId: string): Promise<PaymentMethod[]> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Mock data
  return [
    {
      id: "pm_1234567890",
      type: "card",
      last4: "4242",
      brand: "visa",
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true,
    },
    {
      id: "pm_0987654321",
      type: "card",
      last4: "1234",
      brand: "mastercard",
      expiryMonth: 10,
      expiryYear: 2024,
      isDefault: false,
    },
  ]
}

export const addPaymentMethod = async (customerId: string, paymentMethodId: string): Promise<PaymentMethod> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 800))

  return {
    id: paymentMethodId,
    type: "card",
    last4: "4242",
    brand: "visa",
    expiryMonth: 12,
    expiryYear: 2025,
    isDefault: false,
  }
}

export const setDefaultPaymentMethod = async (customerId: string, paymentMethodId: string): Promise<boolean> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500))
  return true
}

export const removePaymentMethod = async (customerId: string, paymentMethodId: string): Promise<boolean> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500))
  return true
}

// Payment intents
export const createPaymentIntent = async (
  amount: number,
  currency = "usd",
  customerId: string,
  metadata: Record<string, string> = {},
): Promise<PaymentIntent> => {
  const response = await fetch('/api/payments/create-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      metadata,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to create payment intent')
  }

  const data = await response.json()
  return {
    id: data.id,
    amount,
    currency,
    status: "requires_payment_method",
    clientSecret: data.client_secret,
    metadata,
  }
}

export const confirmPaymentIntent = async (
  paymentIntentId: string,
  paymentMethodId: string,
): Promise<PaymentIntent> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1200))

  // 95% success rate for demo purposes
  const success = Math.random() > 0.05

  return {
    id: paymentIntentId,
    amount: 3000, // $30.00
    currency: "usd",
    status: success ? "succeeded" : "canceled",
    clientSecret: `pi_secret_${Math.random().toString(36).substring(2, 15)}`,
  }
}

// Connect accounts for barbers
export const createConnectAccount = async (
  email: string,
  country = "US",
  businessType: "individual" | "company" = "individual",
): Promise<StripeAccount> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1500))

  return {
    id: `acct_${Math.random().toString(36).substring(2, 15)}`,
    businessType,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    requirements: {
      currentlyDue: ["external_account", "individual.verification.document"],
      eventuallyDue: [],
    },
  }
}

export const getAccountLink = async (accountId: string, refreshUrl: string, returnUrl: string): Promise<string> => {
  // In a real app, this would generate a Stripe account link for onboarding
  return `https://example.com/stripe-connect-onboarding?account=${accountId}`
}

export const getConnectAccountStatus = async (accountId: string): Promise<StripeAccount> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500))

  return {
    id: accountId,
    businessType: "individual",
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    requirements: {
      currentlyDue: [],
      eventuallyDue: [],
    },
  }
}

// Transactions and balance
export const getAccountBalance = async (accountId: string): Promise<{ available: number; pending: number }> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500))

  return {
    available: Math.floor(Math.random() * 10000) / 100,
    pending: Math.floor(Math.random() * 5000) / 100,
  }
}

export const getTransactions = async (accountId: string, limit = 10): Promise<StripeTransaction[]> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 700))

  const transactions: StripeTransaction[] = []

  for (let i = 0; i < limit; i++) {
    const amount = Math.floor(Math.random() * 10000) / 100
    const fee = amount * 0.029 + 0.3 // Simulate Stripe fee

    transactions.push({
      id: `txn_${Math.random().toString(36).substring(2, 15)}`,
      amount,
      fee,
      net: amount - fee,
      currency: "usd",
      status: Math.random() > 0.2 ? "available" : "pending",
      created: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      description: "Haircut service",
      type: "payment",
    })
  }

  return transactions.sort((a, b) => b.created.getTime() - a.created.getTime())
}

// Payouts
export const createPayout = async (
  accountId: string,
  amount: number,
  currency = "usd",
  method: "standard" | "instant" = "standard",
): Promise<StripePayout> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const arrivalDate = new Date()
  arrivalDate.setDate(arrivalDate.getDate() + (method === "instant" ? 0 : 2))

  return {
    id: `po_${Math.random().toString(36).substring(2, 15)}`,
    amount,
    currency,
    status: "pending",
    arrivalDate,
    method,
    destination: "card_ending_in_4242",
  }
}

export const getPayouts = async (accountId: string, limit = 10): Promise<StripePayout[]> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 700))

  const payouts: StripePayout[] = []

  for (let i = 0; i < limit; i++) {
    const amount = Math.floor(Math.random() * 20000) / 100
    const arrivalDate = new Date()
    arrivalDate.setDate(arrivalDate.getDate() - Math.floor(Math.random() * 30))

    const statuses: StripePayout["status"][] = ["pending", "in_transit", "paid", "failed", "canceled"]
    const status = statuses[Math.floor(Math.random() * (i === 0 ? 2 : 5))] // Make first one pending or in_transit

    payouts.push({
      id: `po_${Math.random().toString(36).substring(2, 15)}`,
      amount,
      currency: "usd",
      status,
      arrivalDate,
      method: Math.random() > 0.8 ? "instant" : "standard",
      destination: "card_ending_in_4242",
    })
  }

  return payouts.sort((a, b) => b.arrivalDate.getTime() - a.arrivalDate.getTime())
}

// Platform fees and commission calculation
export const calculatePlatformFee = (amount: number, commissionRate = 0.15): number => {
  // Fixed $1 platform fee plus percentage
  const fixedFee = 100 // $1.00 in cents
  const percentageFee = Math.round(amount * commissionRate)
  return fixedFee + percentageFee
}

export const createTransferToBarber = async (
  paymentIntentId: string,
  barberAccountId: string,
  amount: number,
  description: string,
): Promise<{ id: string; amount: number }> => {
  // Calculate platform fee
  const platformFee = calculatePlatformFee(amount)
  const barberAmount = amount - platformFee

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 800))

  return {
    id: `tr_${Math.random().toString(36).substring(2, 15)}`,
    amount: barberAmount,
  }
}

// Refunds
export const createRefund = async (
  paymentIntentId: string,
  amount?: number,
  reason?: "requested_by_customer" | "duplicate" | "fraudulent",
): Promise<{ id: string; status: "pending" | "succeeded" | "failed" }> => {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return {
    id: `re_${Math.random().toString(36).substring(2, 15)}`,
    status: "succeeded",
  }
}

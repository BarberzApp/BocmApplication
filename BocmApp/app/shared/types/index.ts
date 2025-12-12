// Navigation Types
export type RootStackParamList = {
  MainTabs: {
    screen?: string;
    params?: any;
  };
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  Browse: undefined;
  Settings: undefined;
  ForgotPassword: undefined;
  FindBarber: undefined;
  BarberOnboarding: undefined;
  BarberDashboard: undefined;
  BookingSuccess: undefined;
  BookingPage: {
    barberId: string;
    barberName: string;
  };
  BookingCalendar: {
    barberId: string;
    barberName: string;
    preSelectedService?: Service;
  };
  BookingConfirmation: {
    bookingId: string;
    barberId: string;
    barberName: string;
    service: Service;
    date: string;
  };
  EmailConfirmation: {
    email: string;
    userType: 'client' | 'barber';
  };
  Terms: undefined;
  BookingWebView: {
    barberId: string;
    barberName: string;
  };
  ProfilePortfolio: {
    barberId?: string;
  };
  ProfilePreview: {
    barberId: string;
  };
  Cuts: {
    cutId?: string;
    barberId?: string;
  };
}

// User Types
export type UserRole = 'client' | 'barber' | 'admin';

export const USER_ROLES = {
  CLIENT: "client" as const,
  BARBER: "barber" as const,
  ADMIN: "admin" as const,
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  username?: string;
  phone?: string;
  location?: string;
  description?: string;
  bio?: string;
  favorites: string[];
  join_date: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  is_public?: boolean;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  marketing_emails?: boolean;
  instagram_url?: string;
  twitter_url?: string;
  tiktok_url?: string;
  facebook_url?: string;
  is_disabled?: boolean;
  coverphoto?: string;
  carrier?: string;
  user_metadata?: {
    role?: UserRole;
    name?: string;
  };
}

// Review Types
export interface Review {
  id: string;
  booking_id: string;
  barber_id: string;
  client_id: string;
  rating: number;
  comment?: string;
  is_verified: boolean;
  is_public: boolean;
  is_moderated: boolean;
  moderator_notes?: string;
  created_at: string;
  updated_at: string;
  // Relations
  client?: User;
  barber?: Barber;
  booking?: Booking;
}

export interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  rating_distribution: { [key: number]: number };
  recent_reviews: Review[];
}

// Barber Types - Updated to match database schema
export interface Barber {
  id: string;
  user_id: string;
  bio?: string;
  specialties: string[];
  price_range?: string;
  next_available?: string;
  created_at: string;
  updated_at: string;
  stripe_account_id?: string;
  stripe_account_status?: 'pending' | 'active' | 'deauthorized';
  business_name?: string;
  status?: string;
  onboarding_complete?: boolean;
  stripe_account_ready?: boolean;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  facebook?: string;
  portfolio?: string[];
  is_developer?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  // Relations
  user?: User;
  services?: Service[];
  availability?: Availability[];
  special_hours?: SpecialHours[];
  time_off?: TimeOff[];
  booking_restrictions?: BookingRestrictions;
  ondemand_settings?: OnDemandSettings;
}

// Service Types
export interface Service {
  id: string;
  barber_id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  created_at: string;
  updated_at: string;
  barber?: Barber;
  addons?: ServiceAddon[];
}

// Service Addons
export interface ServiceAddon {
  id: string;
  barber_id: string;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Booking Types - Updated to match database schema
export type BookingStatus = 
  | 'pending'         // Initial state
  | 'payment_pending' // Awaiting payment
  | 'confirmed'       // Payment successful
  | 'completed'       // Service completed
  | 'cancelled'       // Cancelled before service
  | 'refunded'        // Payment refunded
  | 'partially_refunded' // Partial refund
  | 'failed'          // Payment failed
  | 'expired'         // Payment expired

export type PaymentStatus = 
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export interface Booking {
  id: string;
  barber_id: string;
  client_id?: string;
  service_id: string;
  date: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  price: number;
  notes?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  created_at: string;
  updated_at: string;
  platform_fee?: number;
  barber_payout?: number;
  payment_intent_id?: string;
  addon_total?: number;
  // Relations
  barber?: Barber;
  service?: Service;
  client?: User;
  addons?: BookingAddon[];
}

// Booking Addons
export interface BookingAddon {
  id: string;
  booking_id: string;
  addon_id: string;
  price: number;
  created_at: string;
}

// Booking Restrictions
export interface BookingRestrictions {
  id: string;
  barber_id: string;
  min_interval_minutes: number;
  max_bookings_per_day: number;
  advance_booking_days: number;
  same_day_booking_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Booking Texts (SMS notifications)
export interface BookingTexts {
  id: string;
  client_name: string;
  client_phone: string;
  client_carrier: string;
  barber_phone: string;
  barber_carrier: string;
  booking_time: string;
  confirmation_sent: boolean;
  reminder_sent: boolean;
  barber_sms_notifications: boolean;
  client_sms_notifications: boolean;
}

// Availability Types
export interface Availability {
  id: string;
  barber_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  barber?: Barber;
}

export interface SpecialHours {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_closed: boolean;
  reason?: string;
  created_at: string;
  updated_at: string;
  barber?: Barber;
}

// Time Off
export interface TimeOff {
  id: string;
  barber_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
  updated_at: string;
}

// Scheduling Slots
export interface SchedulingSlots {
  id: string;
  barber_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes_before: number;
  buffer_minutes_after: number;
  max_bookings_per_slot: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// OnDemand Types
export interface OnDemandRequest {
  id: string;
  client_id: string;
  barber_id: string;
  service_id: string;
  requested_time: string;
  location_lat: number;
  location_lng: number;
  location_address: string;
  status: string;
  price: number;
  surge_multiplier: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OnDemandSettings {
  id: string;
  barber_id: string;
  is_enabled: boolean;
  availability_radius_miles: number;
  min_notice_minutes: number;
  max_notice_hours: number;
  surge_pricing_enabled: boolean;
  surge_multiplier: number;
  created_at: string;
  updated_at: string;
}

// Cuts (formerly Reels)
export interface Cut {
  id: string;
  barber_id: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  category?: string;
  duration: number;
  views: number;
  likes: number;
  shares: number;
  tags: string[];
  is_featured: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
  comments_count: number;
  barber?: Barber;
}

// Cut Comments
export interface CutComment {
  id: string;
  cut_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user?: User;
  cut?: Cut;
}

// Cut Analytics
export interface CutAnalytics {
  id: string;
  cut_id: string;
  user_id: string;
  action_type: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  cut?: Cut;
  user?: User;
}

// Payments
export interface Payment {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  barber_stripe_account_id: string;
  platform_fee: number;
  created_at: string;
  booking_id: string;
  booking?: Booking;
}

// Calendar Sync
export interface UserCalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string;
  sync_enabled: boolean;
  last_sync_at?: string;
  sync_direction: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface SyncedEvent {
  id: string;
  user_id: string;
  external_event_id: string;
  external_calendar_id: string;
  booking_id?: string;
  event_data: any;
  sync_direction: string;
  sync_status: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
  user?: User;
  booking?: Booking;
}

export interface CalendarSyncLog {
  id: string;
  user_id: string;
  connection_id: string;
  operation: string;
  status: string;
  details: any;
  error_message?: string;
  created_at: string;
  user?: User;
  connection?: UserCalendarConnection;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  booking_id?: string;
  read: boolean;
  created_at: string;
  user?: User;
  booking?: Booking;
}

// Helper Types
export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface DateTimeSelection {
  date: Date | null;
  timeSlot: TimeSlot | null;
}

// Job Types
export interface JobPost {
  id: string;
  businessId: string;
  businessName: string;
  businessImage: string;
  title: string;
  description: string;
  requirements: string[];
  location: string;
  salary: string;
  postedDate: string;
  status: "open" | "closed";
}

export interface JobApplication {
  id: string;
  jobId: string;
  barberId: string;
  barber: {
    id: string;
    name: string;
    image: string;
    experience: string;
    location: string;
  };
  status: "pending" | "reviewing" | "accepted" | "rejected";
  appliedDate: string;
  coverLetter: string;
}

// Calendar Types
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
  status?: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CalendarDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  dateString: string;
}

// Message Types
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  updatedAt: string;
}

// Conversation Types
export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: {
    text: string;
    timestamp: Date;
    senderId: string;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface SignUpForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'client' | 'barber';
  agreeToTerms: boolean;
}

export interface BookingForm {
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
}

// Database types for Supabase queries
export type BarberFromDB = {
  id: string;
  user_id: string;
  business_name?: string;
  specialties: string[];
  price_range?: string;
  stripe_account_status?: string;
  status?: string;
  onboarding_complete?: boolean;
  stripe_account_ready?: boolean;
  is_developer?: boolean;
}

export type ProfileFromDB = {
  id: string;
  name: string;
  location?: string;
  bio?: string;
  avatar_url?: string;
  is_public?: boolean;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  marketing_emails?: boolean;
  is_disabled?: boolean;
  coverphoto?: string;
  carrier?: string;
} 
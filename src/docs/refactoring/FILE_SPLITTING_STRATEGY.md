# File Size Standards & Splitting Strategy

## 📏 Industry-Standard File Size Recommendations

### **General Guidelines:**

| File Type | Ideal | Max Acceptable | Too Large |
|-----------|-------|----------------|-----------|
| **React Components** | 200-400 lines | 500 lines | >600 lines |
| **Services/Utilities** | 150-300 lines | 400 lines | >500 lines |
| **Hooks** | 100-200 lines | 300 lines | >400 lines |
| **Types/Interfaces** | 50-150 lines | 200 lines | >300 lines |

### **Your Current Files:**

| File | Lines | Status | Target |
|------|-------|--------|--------|
| **CalendarPage.tsx** | 1,897 | 🔴 Way too large | 300-400 |
| **BrowsePage.tsx** | 1,499 | 🔴 Too large | 300-400 |
| **BookingForm.tsx** | ~800 | 🟠 Large | 300-400 |

---

## 🎯 Recommended Maximum: **300-400 Lines Per File**

**Why?**
- ✅ Easier to understand at a glance
- ✅ Faster to navigate and debug
- ✅ Easier to test in isolation
- ✅ Better for code reviews
- ✅ Encourages single responsibility principle
- ✅ Reduces merge conflicts
- ✅ Improves IDE performance

---

## 🔪 CalendarPage.tsx Splitting Strategy (1,897 → ~400 lines)

### **Current Structure Analysis:**

**CalendarPage.tsx breakdown:**
```
Lines 1-41:    Imports (41 lines)
Lines 42-122:  Types & Constants (80 lines)
Lines 123-350: State & Hooks (227 lines)
Lines 351-600: Booking Management Functions (250 lines)
Lines 601-900: Calendar Functions (300 lines)
Lines 901-1200: Event Handlers (300 lines)
Lines 1201-1897: JSX Render (696 lines!)
```

---

## 📋 Splitting Plan for CalendarPage

### **Phase 1: Extract Services (Backend Logic)**

#### **1. Calendar Data Service** → `app/shared/lib/calendarDataService.ts`

**Extract:**
```typescript
// Fetch bookings
async fetchBookings(userId: string, role: string, startDate: Date, endDate: Date)

// Fetch services
async fetchBarberServices(barberId: string)

// Fetch available time slots
async getAvailableTimeSlots(barberId: string, date: string, serviceDuration: number)

// Create manual appointment
async createManualAppointment(appointmentData: any)

// Update booking status
async updateBookingStatus(bookingId: string, status: string)

// Cancel booking
async cancelBooking(bookingId: string)
```

**Lines to Extract:** ~250 lines  
**Reusable in:** BookingForm, HomePage, NotificationsPage

---

#### **2. Calendar Utilities** → `app/shared/lib/calendarUtils.ts`

**Extract:**
```typescript
// Transform bookings to calendar events
function transformBookingsToEvents(bookings: any[]): CalendarEvent[]

// Get calendar status colors
function getStatusColor(status: string): { bg: string, border: string, text: string }

// Calculate event time ranges
function calculateEventTimeRange(event: CalendarEvent): string

// Filter events by status
function filterEventsByStatus(events: CalendarEvent[], status: string): CalendarEvent[]

// Get events for specific date
function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[]

// Group events by date
function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]>
```

**Lines to Extract:** ~150 lines  
**Reusable in:** CalendarWidget, EventsList, BookingTimeline

---

### **Phase 2: Extract UI Components (JSX)**

#### **3. CalendarGrid Component** → `app/shared/components/calendar/CalendarGrid.tsx`

**Extract:**
```tsx
// The month grid view (days, dates, event indicators)
<CalendarGrid
  currentDate={currentDate}
  selectedDate={selectedDate}
  events={events}
  onDateSelect={handleDateSelect}
  onPrevMonth={prevMonth}
  onNextMonth={nextMonth}
/>
```

**Lines to Extract:** ~300 lines  
**Complexity:** Month header, day grid, event dots

---

#### **4. EventList Component** → `app/shared/components/calendar/EventList.tsx`

**Extract:**
```tsx
// List of events for selected date
<EventList
  events={dayEvents}
  onEventPress={handleEventPress}
  onEventAction={handleEventAction}
  userRole={userRole}
/>
```

**Lines to Extract:** ~200 lines  
**Complexity:** Event cards, status badges, action buttons

---

#### **5. EventDetailsModal** → `app/shared/components/calendar/EventDetailsModal.tsx`

**Extract:**
```tsx
// Modal showing event details with actions
<EventDetailsModal
  event={selectedEvent}
  visible={showEventDialog}
  onClose={() => setShowEventDialog(false)}
  onMarkCompleted={handleMarkCompleted}
  onMarkMissed={handleMarkMissed}
  onCancel={handleCancelBooking}
  userRole={userRole}
/>
```

**Lines to Extract:** ~250 lines  
**Complexity:** Event details, action buttons, confirmations

---

#### **6. ManualAppointmentForm** → `app/shared/components/calendar/ManualAppointmentForm.tsx`

**Extract:**
```tsx
// Form for creating manual appointments
<ManualAppointmentForm
  visible={showManualAppointmentForm}
  onClose={() => setShowManualAppointmentForm(false)}
  selectedDate={selectedDate}
  barberId={barberId}
  onSuccess={handleAppointmentCreated}
/>
```

**Lines to Extract:** ~200 lines  
**Complexity:** Multi-step form, service selection, time slots

---

#### **7. CalendarHeader** → `app/shared/components/calendar/CalendarHeader.tsx`

**Extract:**
```tsx
// Header with month navigation, filters, view modes
<CalendarHeader
  currentDate={currentDate}
  onPrevMonth={prevMonth}
  onNextMonth={nextMonth}
  filterStatus={filterStatus}
  onFilterChange={setFilterStatus}
  viewMode={barberViewMode}
  onViewModeChange={setBarberViewMode}
  userRole={userRole}
/>
```

**Lines to Extract:** ~150 lines  
**Complexity:** Navigation buttons, filters, badges

---

#### **8. CalendarStatsBar** → `app/shared/components/calendar/CalendarStatsBar.tsx`

**Extract:**
```tsx
// Stats showing appointments, revenue, etc.
<CalendarStatsBar
  events={filteredEvents}
  currentMonth={currentDate}
  userRole={userRole}
/>
```

**Lines to Extract:** ~100 lines  
**Complexity:** Calculations, stat cards

---

### **Phase 3: Extract Hooks**

#### **9. useCalendarState Hook** → `app/shared/hooks/useCalendarState.ts`

**Extract:**
```typescript
// Centralize calendar state management
export function useCalendarState() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'month'>('month');
  
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  
  return { currentDate, selectedDate, events, filterStatus, viewMode, ... };
}
```

**Lines to Extract:** ~100 lines  
**Benefit:** Clean state management

---

#### **10. useCalendarData Hook** → `app/shared/hooks/useCalendarData.ts`

**Extract:**
```typescript
// Handle data fetching for calendar
export function useCalendarData(userId: string, role: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchBookings = useCallback(async () => { ... });
  const refreshBookings = useCallback(async () => { ... });
  
  return { events, loading, fetchBookings, refreshBookings };
}
```

**Lines to Extract:** ~150 lines  
**Benefit:** Separates data fetching from UI

---

## 📊 Complete Splitting Plan

### **CalendarPage.tsx: 1,897 → 300 lines**

**After Extraction:**

| What | Where | Lines |
|------|-------|-------|
| **Main Page** (orchestration) | `CalendarPage.tsx` | ~300 |
| Data fetching service | `calendarDataService.ts` | ~250 |
| Calendar utilities | `calendarUtils.ts` | ~150 |
| CalendarGrid component | `CalendarGrid.tsx` | ~300 |
| EventList component | `EventList.tsx` | ~200 |
| EventDetailsModal component | `EventDetailsModal.tsx` | ~250 |
| ManualAppointmentForm | `ManualAppointmentForm.tsx` | ~200 |
| CalendarHeader component | `CalendarHeader.tsx` | ~150 |
| CalendarStatsBar component | `CalendarStatsBar.tsx` | ~100 |
| useCalendarState hook | `useCalendarState.ts` | ~100 |
| useCalendarData hook | `useCalendarData.ts` | ~150 |

**Result:**
- 11 focused files (avg ~200 lines each)
- Each file has single responsibility
- Easy to test, maintain, reuse
- CalendarPage becomes coordinator (300 lines)

---

## 🚀 BrowsePage.tsx: 1,499 → 350 lines

### **Already Extracted:**
✅ Location management → `useLocationManager.ts` (200 lines)

### **Still to Extract:**

| What | Where | Lines |
|------|-------|-------|
| **Main Page** (orchestration) | `BrowsePage.tsx` | ~350 |
| Geocoding service | `geocoding.ts` | ~80 |
| Barber data service | `barberDataService.ts` | ~250 |
| Filter utilities | `filterUtils.ts` | ~100 |
| BarberGrid component | `BarberGrid.tsx` | ~300 |
| PostsGrid component | `PostsGrid.tsx` | ~250 |
| FilterPanel component | `FilterPanel.tsx` | ~150 |
| SearchBar component | `SearchBar.tsx` | ~50 |

**Result:**
- 9 focused files (avg ~170 lines each)
- BrowsePage becomes lightweight coordinator

---

## 📐 Component Splitting Rules

### **When to Split a Component:**

**Split if:**
- ✅ File > 400 lines
- ✅ More than 10 state variables
- ✅ More than 5 useEffect hooks
- ✅ JSX > 200 lines
- ✅ Multiple concerns (data + UI + business logic)
- ✅ Hard to find specific functionality
- ✅ Takes >10 seconds to understand what it does

**Keep together if:**
- ❌ File < 300 lines
- ❌ Single clear responsibility
- ❌ Splitting would add complexity
- ❌ Components are tightly coupled

---

## 🎯 Recommended Action Plan

### **Option 1: Aggressive Splitting (Recommended for Maintainability)**

**Target:** 200-300 lines per file  
**Benefits:** Maximum maintainability, testability, reusability  
**Time:** 6-8 hours  
**Files Created:** ~20 new files

### **Option 2: Moderate Splitting (Balanced)**

**Target:** 300-500 lines per file  
**Benefits:** Good balance of organization and simplicity  
**Time:** 3-4 hours  
**Files Created:** ~12 new files

### **Option 3: Minimal Splitting (Quick Wins)**

**Target:** 500-700 lines per file  
**Benefits:** Some improvement, less work  
**Time:** 1-2 hours  
**Files Created:** ~6 new files

---

## 💡 My Recommendation

### **Start with CalendarPage (Worst Offender):**

**Priority 1: Extract Services (1-2 hours)**
1. `calendarDataService.ts` - All data fetching
2. `calendarUtils.ts` - Pure utility functions

**Priority 2: Extract Large Components (2-3 hours)**
3. `EventDetailsModal.tsx` - Event dialog
4. `ManualAppointmentForm.tsx` - Appointment form
5. `CalendarGrid.tsx` - Month view grid

**Priority 3: Extract Smaller Components (1 hour)**
6. `CalendarHeader.tsx` - Header with navigation
7. `EventList.tsx` - List of events

**Result:** CalendarPage goes from 1,897 → ~300 lines (84% reduction)

---

## 🎬 Shall I Proceed?

I can extract these helpers for you. Which would you prefer?

### **Option A: Full CalendarPage Split** ⭐ (Recommended)
- Extract all 7 components + 2 services
- CalendarPage: 1,897 → ~300 lines
- Time: 3-4 hours
- Best long-term solution

### **Option B: Just Services First** 🚀 (Quick Win)
- Extract data service + utilities
- CalendarPage: 1,897 → ~1,400 lines
- Time: 1 hour
- Gets backend logic out

### **Option C: Full Refactor (Both Files)** 💪 (Complete Solution)
- Split both CalendarPage AND BrowsePage
- Create ~18 new focused files
- Time: 6-8 hours
- Production-grade architecture

Let me know which you'd prefer and I'll start extracting!


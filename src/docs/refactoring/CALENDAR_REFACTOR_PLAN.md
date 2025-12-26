# Calendar Page Refactoring - Implementation Plan

## ✅ **Completed So Far (1,350 lines extracted)**

### **Services Layer:**
1. **calendarDataService.ts** - 556 lines ✅
   - 13 API functions
   - 21 tests passing ✅

2. **calendarUtils.ts** - 386 lines ✅
   - 20 utility functions  
   - 37 tests passing ✅

### **Hooks Layer:**
3. **useCalendarState.ts** - 204 lines ✅
   - State management
   - Navigation helpers
   - Modal/dialog state

4. **useCalendarData.ts** - 204 lines ✅
   - Data fetching
   - CRUD operations
   - Uses calendarDataService

**Total Tests:** 58 passing ✅

---

## 🎯 **Next Step: Update CalendarPage**

### **Current CalendarPage Structure:**
```typescript
// Lines 1-41: Imports
// Lines 42-64: CalendarEvent interface (move to types)
// Lines 68-110: State (26 useState calls) → Replace with useCalendarState
// Lines 111-114: Animation refs (keep)
// Lines 116-121: Constants (keep)
// Lines 123-187: useEffects (refactor with new hooks)
// Lines 188-277: Helper functions (keep/simplify)
// Lines 278-600: Data fetching functions → Replace with useCalendarData
// Lines 601-1897: JSX and event handlers (keep for now, extract components later)
```

### **Refactored Structure:**
```typescript
// Imports
import { useCalendarState } from '../shared/hooks/useCalendarState';
import { useCalendarData } from '../shared/hooks/useCalendarData';
import { formatTimeSlot, filterEventsByStatus, getEventsForDate } from '../shared/lib/calendar';

export default function CalendarPage() {
  const { user } = useAuth();
  
  // State management - ONE hook instead of 26 useState calls
  const state = useCalendarState();
  
  // Data operations - ONE hook for all data
  const data = useCalendarData(state, user?.id);
  
  // Animation refs (keep)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Constants (keep)
  const months = [...];
  const weekdays = [...];
  
  // Initialization
  useEffect(() => {
    if (!user) return;
    data.initialize();
    // animations...
  }, [user]);
  
  // Simplified effects
  useEffect(() => {
    if (state.showManualAppointmentForm && state.barberId) {
      data.loadServices(state.barberId);
    }
  }, [state.showManualAppointmentForm, state.barberId]);
  
  useEffect(() => {
    if (state.manualFormData.serviceId && state.barberId) {
      const service = state.services.find(s => s.id === state.manualFormData.serviceId);
      if (service) {
        data.loadTimeSlots(state.barberId, state.manualFormData.date, service.duration);
      }
    }
  }, [state.manualFormData.serviceId, state.manualFormData.date]);
  
  // Event handlers (simplified)
  const handleMarkCompleted = async (eventId: string) => {
    state.setIsMarkingCompleted(true);
    const success = await data.markCompleted(eventId);
    state.setIsMarkingCompleted(false);
    if (success) {
      state.clearSelectedEvent();
    }
  };
  
  const handleMarkMissed = async (eventId: string) => {
    state.setIsMarkingMissed(true);
    const success = await data.markMissed(eventId);
    state.setIsMarkingMissed(false);
    if (success) {
      state.clearSelectedEvent();
    }
  };
  
  const handleCancelBooking = async (eventId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            const success = await data.cancelBooking(eventId);
            if (success) {
              state.clearSelectedEvent();
            }
          }
        }
      ]
    );
  };
  
  const handleCreateManualAppointment = async () => {
    if (!state.barberId) return;
    
    state.setIsSubmitting(true);
    const success = await data.createAppointment(state.barberId, {
      clientName: state.manualFormData.clientName,
      serviceId: state.manualFormData.serviceId,
      date: state.manualFormData.date,
      time: state.manualFormData.time,
      price: parseFloat(state.manualFormData.price),
    });
    state.setIsSubmitting(false);
    
    if (success) {
      state.closeManualAppointmentForm();
    }
  };
  
  // Filtered events (using utils)
  const filteredEvents = filterEventsByStatus(state.events, state.filterStatus);
  const dayEvents = state.selectedDate 
    ? getEventsForDate(filteredEvents, state.selectedDate)
    : [];
  
  // JSX (keep for now, will extract components next)
  return (...);
}
```

---

## 📊 **Benefits of Refactored Version**

### **Before:**
- 1,897 lines in one file
- 26 separate useState calls
- Duplicate data fetching logic
- Hard to test
- Hard to maintain

### **After (with hooks):**
- ~1,200 lines in CalendarPage (600 line reduction!)
- 2 hook calls (state + data)
- No duplicate logic (DRY)
- Testable hooks
- Clear separation of concerns

### **Further reduction (with components):**
- Will reduce to ~300 lines
- Extract: CalendarGrid, EventList, EventDetailsModal, etc.

---

## 🚀 **Implementation Steps**

### **Step 1: Create Refactored CalendarPage** ✅ (Next)
- Replace useState with useCalendarState
- Replace data functions with useCalendarData
- Simplify event handlers
- Keep JSX as-is

### **Step 2: Test Refactored Version**
- Run existing CalendarPage test
- Verify app still works
- Fix any issues

### **Step 3: Extract Components** (Future)
- CalendarGrid
- EventList
- EventDetailsModal
- ManualAppointmentForm
- CalendarHeader

---

## 🎯 **Current Focus**

**I'll now create the refactored CalendarPage that uses our extracted hooks.**

This will:
1. ✅ Reduce file from 1,897 to ~1,200 lines immediately
2. ✅ Use our tested hooks (58 tests passing)
3. ✅ Follow SOLID & DRY principles
4. ✅ Make future component extraction easier

**Proceeding with refactor...**


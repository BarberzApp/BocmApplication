# BocmApp Refactoring Recommendations
## Project Management Analysis & Action Plan

**Date:** $(date)  
**Project:** BocmApp Mobile Application  
**Total Codebase Size:** ~30,854 lines of TypeScript/TSX  
**Analysis Scope:** React Native Expo application

---

## 📊 Executive Summary

The BocmApp codebase has grown significantly and shows signs of technical debt. While the application is functional, several critical files exceed recommended size limits (1000+ lines), contain mixed concerns, and exhibit code duplication patterns. This document outlines a prioritized refactoring plan to improve maintainability, testability, and developer velocity.

---

## 🔍 Critical Issues Identified

### 1. **Oversized Component Files** (HIGH PRIORITY)

**Problem:** Several page components exceed 1000 lines, making them difficult to maintain, test, and debug.

| File | Lines | Issues |
|------|-------|--------|
| `CalendarPage.tsx` | **1,859** | Calendar logic, booking management, event handling, form state all in one file |
| `BrowsePage.tsx` | **1,537** | Search, filtering, barber listing, reviews, booking form integration |
| `BarberOnboardingPage.tsx` | **1,477** | Multi-step form, validation, Stripe integration, data fetching |
| `BookingForm.tsx` | **1,331** | Multi-step wizard, payment processing, time slot management |
| `ProfilePortfolio.tsx` | **952** | Profile management, media uploads, settings integration |
| `data-context.tsx` | **785** | Massive context provider with multiple concerns |

**Impact:**
- Difficult to locate specific functionality
- High cognitive load for developers
- Increased risk of merge conflicts
- Hard to write unit tests
- Poor code reusability

---

### 2. **Code Duplication Patterns** (MEDIUM PRIORITY)

**Identified Patterns:**

#### A. **Supabase Query Patterns**
Repeated across multiple files:
- Profile fetching (`profiles` table)
- Barber data fetching (`barbers` table)
- Services fetching (`services` table)
- Booking queries (`bookings` table)

**Example duplication:**
```typescript
// Found in: BrowsePage.tsx, ProfilePortfolio.tsx, SettingsPage.tsx, etc.
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

const { data: barber, error: barberError } = await supabase
  .from('barbers')
  .select('*')
  .eq('user_id', user.id)
  .single();
```

#### B. **Form Validation Patterns**
Similar validation logic repeated in:
- `BarberOnboardingPage.tsx`
- `BookingForm.tsx`
- `SignUpPage.tsx`
- `LoginPage.tsx`

#### C. **Loading State Management**
Repeated loading state patterns:
```typescript
const [loading, setLoading] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [refreshing, setRefreshing] = useState(false);
```

#### D. **Error Handling**
Similar try-catch-error patterns without centralized error handling.

---

### 3. **Mixed Concerns** (HIGH PRIORITY)

**Problem:** Components combine UI rendering, business logic, data fetching, and state management.

**Examples:**

**CalendarPage.tsx combines:**
- Calendar UI rendering
- Event fetching and transformation
- Booking status management
- Review form handling
- Manual appointment creation
- Time slot management
- Payment processing

**BrowsePage.tsx combines:**
- Search/filter UI
- Barber listing logic
- Location services
- Review system
- Booking form integration
- Pagination logic

---

### 4. **State Management Complexity** (MEDIUM PRIORITY)

**Issues:**
- Heavy use of `useState` with 10+ state variables per component
- Complex state interdependencies
- No clear state management strategy (mixing Context, Zustand, local state)
- `data-context.tsx` is 785 lines with multiple responsibilities

**Example from CalendarPage.tsx:**
```typescript
const [currentDate, setCurrentDate] = useState(new Date());
const [selectedDate, setSelectedDate] = useState<Date | null>(null);
const [events, setEvents] = useState<CalendarEvent[]>([]);
const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
const [showEventDialog, setShowEventDialog] = useState(false);
const [showManualAppointmentForm, setShowManualAppointmentForm] = useState(false);
const [isMarkingMissed, setIsMarkingMissed] = useState(false);
const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
// ... 10+ more state variables
```

---

### 5. **Type Definition Scattering** (LOW PRIORITY)

**Problem:** Type definitions are scattered across files rather than centralized.

**Examples:**
- `Barber` type defined in multiple files with slight variations
- `ProfileFromDB` vs `Profile` type inconsistencies
- Inline interfaces in component files

---

## 🎯 Refactoring Recommendations

### **Phase 1: Critical Refactoring (Weeks 1-4)**

#### **1.1 Break Down Large Components**

**Priority:** CRITICAL  
**Estimated Effort:** 3-4 weeks

**Action Items:**

##### **A. CalendarPage.tsx (1,859 lines → Target: <300 lines per file)**

**Break into:**
```
app/
├── features/
│   └── calendar/
│       ├── CalendarPage.tsx (main orchestrator, ~150 lines)
│       ├── components/
│       │   ├── CalendarView.tsx (~200 lines)
│       │   ├── EventList.tsx (~150 lines)
│       │   ├── EventDialog.tsx (~200 lines)
│       │   ├── ManualAppointmentForm.tsx (~250 lines)
│       │   └── CalendarFilters.tsx (~150 lines)
│       ├── hooks/
│       │   ├── useCalendarEvents.ts (~200 lines)
│       │   ├── useBookingStatus.ts (~150 lines)
│       │   └── useTimeSlots.ts (~150 lines)
│       └── services/
│           └── calendarService.ts (~200 lines)
```

**Benefits:**
- Each file has single responsibility
- Easier to test individual pieces
- Better code reusability
- Reduced merge conflicts

##### **B. BrowsePage.tsx (1,537 lines → Target: <300 lines per file)**

**Break into:**
```
app/
├── features/
│   └── browse/
│       ├── BrowsePage.tsx (orchestrator, ~150 lines)
│       ├── components/
│       │   ├── SearchBar.tsx (~100 lines)
│       │   ├── FilterPanel.tsx (~200 lines)
│       │   ├── BarberList.tsx (~200 lines)
│       │   ├── BarberCard.tsx (~150 lines)
│       │   └── ReviewsSection.tsx (~200 lines)
│       ├── hooks/
│       │   ├── useBarberSearch.ts (~200 lines)
│       │   ├── useBarberFilters.ts (~150 lines)
│       │   └── useLocation.ts (~150 lines)
│       └── services/
│           └── barberService.ts (~200 lines)
```

##### **C. BarberOnboardingPage.tsx (1,477 lines → Target: <300 lines per file)**

**Break into:**
```
app/
├── features/
│   └── onboarding/
│       ├── BarberOnboardingPage.tsx (orchestrator, ~150 lines)
│       ├── components/
│       │   ├── BusinessInfoStep.tsx (~200 lines)
│       │   ├── ServicesStep.tsx (~250 lines)
│       │   ├── StripeConnectStep.tsx (~200 lines)
│       │   └── OnboardingProgress.tsx (~100 lines)
│       ├── hooks/
│       │   ├── useOnboardingForm.ts (~200 lines)
│       │   └── useStripeConnect.ts (~150 lines)
│       └── services/
│           └── onboardingService.ts (~200 lines)
```

##### **D. BookingForm.tsx (1,331 lines → Target: <300 lines per file)**

**Break into:**
```
app/
├── features/
│   └── booking/
│       ├── BookingForm.tsx (orchestrator, ~150 lines)
│       ├── components/
│       │   ├── ServiceSelectionStep.tsx (~150 lines)
│       │   ├── DateSelectionStep.tsx (~150 lines)
│       │   ├── TimeSelectionStep.tsx (~150 lines)
│       │   ├── AddonsStep.tsx (~150 lines)
│       │   └── PaymentStep.tsx (~200 lines)
│       ├── hooks/
│       │   ├── useBookingWizard.ts (~200 lines)
│       │   ├── useTimeSlots.ts (~150 lines)
│       │   └── useBookingPayment.ts (~200 lines)
│       └── services/
│           └── bookingService.ts (already exists, enhance)
```

---

#### **1.2 Create Data Access Layer**

**Priority:** CRITICAL  
**Estimated Effort:** 1 week

**Problem:** Direct Supabase queries scattered across components.

**Solution:** Create centralized data access services.

```
app/
└── shared/
    └── services/
        ├── profileService.ts
        ├── barberService.ts
        ├── bookingService.ts (enhance existing)
        ├── serviceService.ts
        └── reviewService.ts
```

**Example: `profileService.ts`**
```typescript
export class ProfileService {
  static async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw new ProfileServiceError(error);
    return data;
  }
  
  static async updateProfile(userId: string, updates: Partial<Profile>) {
    // Centralized update logic
  }
}
```

**Benefits:**
- Single source of truth for data access
- Easier to mock for testing
- Consistent error handling
- Type safety improvements

---

#### **1.3 Extract Custom Hooks**

**Priority:** HIGH  
**Estimated Effort:** 1 week

**Extract common patterns into reusable hooks:**

```
app/
└── shared/
    └── hooks/
        ├── useAsyncData.ts (generic data fetching hook)
        ├── useFormValidation.ts (form validation logic)
        ├── useDebounce.ts (debouncing utility)
        ├── useLocation.ts (location services)
        └── usePagination.ts (pagination logic)
```

**Example: `useAsyncData.ts`**
```typescript
export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    // Fetch logic with loading/error handling
  }, deps);
  
  return { data, loading, error, refetch };
}
```

---

### **Phase 2: Code Quality Improvements (Weeks 5-6)**

#### **2.1 Centralize Form Validation**

**Priority:** MEDIUM  
**Estimated Effort:** 3-4 days

**Create:** `app/shared/lib/validation/`

```
app/shared/lib/validation/
├── schemas.ts (Zod schemas)
├── validators.ts (validation functions)
└── index.ts
```

**Benefits:**
- Consistent validation rules
- Type-safe validation
- Reusable validation logic

---

#### **2.2 Improve Error Handling**

**Priority:** MEDIUM  
**Estimated Effort:** 2-3 days

**Create centralized error handling:**
```
app/shared/
└── lib/
    └── errors/
        ├── ErrorHandler.ts
        ├── ErrorBoundary.tsx (enhance existing)
        └── errorTypes.ts
```

---

#### **2.3 Refactor State Management**

**Priority:** MEDIUM  
**Estimated Effort:** 1 week

**Break down `data-context.tsx` (785 lines):**

```
app/
└── shared/
    └── stores/
        ├── profileStore.ts (Zustand)
        ├── barberStore.ts (Zustand)
        ├── bookingStore.ts (Zustand)
        └── uiStore.ts (Zustand)
```

**Benefits:**
- Better performance (selective subscriptions)
- Easier to test
- Clearer data flow
- Reduced context re-renders

---

### **Phase 3: Type Safety & Consistency (Week 7)**

#### **3.1 Centralize Type Definitions**

**Priority:** LOW  
**Estimated Effort:** 2-3 days

**Create:** `app/shared/types/`

```
app/shared/types/
├── barber.types.ts
├── booking.types.ts
├── profile.types.ts
├── service.types.ts
└── index.ts (re-exports)
```

**Remove duplicate type definitions and ensure consistency.**

---

#### **3.2 Add TypeScript Strict Mode**

**Priority:** LOW  
**Estimated Effort:** 1-2 days

**Enable strict TypeScript checking:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

---

## 📋 Implementation Guidelines

### **Refactoring Best Practices:**

1. **One File at a Time**
   - Don't refactor multiple large files simultaneously
   - Complete one refactor before moving to the next

2. **Feature Flags**
   - Use feature flags to gradually roll out refactored components
   - Allows for easy rollback if issues arise

3. **Test Coverage**
   - Write tests for new hooks/services before refactoring
   - Ensure existing functionality isn't broken

4. **Incremental Migration**
   - Keep old code working during refactoring
   - Migrate one component/hook at a time
   - Remove old code only after verification

5. **Code Review**
   - All refactored code should go through thorough code review
   - Focus on maintainability and clarity

---

## 🎯 Success Metrics

### **Quantitative Metrics:**

- **File Size Reduction:** Target <300 lines per file
- **Code Duplication:** Reduce by 40-50%
- **Test Coverage:** Increase from current to 70%+
- **Build Time:** Maintain or improve current build times
- **Bundle Size:** Monitor for any increases

### **Qualitative Metrics:**

- **Developer Velocity:** Faster feature development
- **Bug Resolution Time:** Faster debugging
- **Code Review Time:** Reduced review cycles
- **Onboarding Time:** New developers productive faster

---

## 📅 Recommended Timeline

| Phase | Duration | Priority | Risk Level |
|-------|----------|----------|------------|
| **Phase 1.1:** Break Down Large Components | 3-4 weeks | CRITICAL | Medium |
| **Phase 1.2:** Data Access Layer | 1 week | CRITICAL | Low |
| **Phase 1.3:** Extract Custom Hooks | 1 week | HIGH | Low |
| **Phase 2.1:** Form Validation | 3-4 days | MEDIUM | Low |
| **Phase 2.2:** Error Handling | 2-3 days | MEDIUM | Low |
| **Phase 2.3:** State Management | 1 week | MEDIUM | Medium |
| **Phase 3.1:** Type Definitions | 2-3 days | LOW | Low |
| **Phase 3.2:** TypeScript Strict | 1-2 days | LOW | Low |

**Total Estimated Time:** 7-9 weeks

---

## 🚨 Risk Mitigation

### **Potential Risks:**

1. **Breaking Changes**
   - **Mitigation:** Comprehensive testing, feature flags, gradual rollout

2. **Time Overruns**
   - **Mitigation:** Prioritize critical refactorings, break into smaller tasks

3. **Merge Conflicts**
   - **Mitigation:** Coordinate with team, communicate refactoring schedule

4. **Performance Regression**
   - **Mitigation:** Performance testing before/after, monitor bundle size

---

## 📝 Immediate Action Items

### **Week 1 Sprint:**

1. ✅ Create this refactoring plan document
2. 🔄 Set up feature branch: `refactor/component-breakdown`
3. 🔄 Start with `BookingForm.tsx` (smallest of the large files)
4. 🔄 Create `app/shared/services/` directory structure
5. 🔄 Begin extracting data access layer

### **Quick Wins (Can start immediately):**

1. **Extract `useAsyncData` hook** - Used in multiple places
2. **Create `barberService.ts`** - Consolidate barber queries
3. **Extract `useDebounce` hook** - Used in BrowsePage
4. **Create validation utilities** - Extract form validation

---

## 📚 Additional Recommendations

### **Long-term Improvements:**

1. **Component Library Documentation**
   - Document shared components in Storybook or similar
   - Create component usage examples

2. **API Documentation**
   - Document all service methods
   - Create API contracts/interfaces

3. **Performance Optimization**
   - Implement React.memo where appropriate
   - Add virtualization for long lists
   - Optimize image loading

4. **Testing Strategy**
   - Unit tests for hooks/services
   - Integration tests for features
   - E2E tests for critical flows

5. **Code Standards**
   - Enforce file size limits via ESLint
   - Add pre-commit hooks for code quality
   - Establish component composition guidelines

---

## ✅ Conclusion

The BocmApp codebase is functional but requires refactoring to improve maintainability and developer experience. The recommended approach is incremental, starting with breaking down the largest components and establishing better architectural patterns.

**Key Principles:**
- **Incremental:** One file/feature at a time
- **Tested:** Ensure functionality is preserved
- **Documented:** Update documentation as you refactor
- **Collaborative:** Team alignment on approach

**Next Steps:**
1. Review and approve this plan
2. Assign team members to phases
3. Create tracking tickets for each refactoring task
4. Begin Phase 1 implementation

---

**Document Version:** 1.0  
**Last Updated:** $(date)  
**Author:** Project Management Analysis


# BocmApp ↔ src Synchronization Plan

## Overview
This document outlines the plan to make BocmApp (React Native/Expo) look and function 1:1 with the src directory (Next.js web app).

## Current State Analysis

### BocmApp (React Native/Expo) - CURRENT STATE
- **Location**: `/BocmApp/`
- **Framework**: React Native with Expo
- **Styling**: `twrnc` (Tailwind for React Native)
- **Navigation**: React Navigation
- **Structure**: `app/shared/components/ui/`, `app/pages/`, `app/shared/hooks/`, etc.

### src (Next.js Web)
- **Location**: `/src/`
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Navigation**: Next.js App Router
- **Structure**: `src/shared/components/ui/`, `src/app/`, `src/shared/hooks/`, etc.

## Phase 1: Component Structure Alignment ✅

### 1.1 Create Shared Directory Structure ✅
- [x] Create `BocmApp/app/shared/` directory
- [x] Create `BocmApp/app/shared/components/` directory
- [x] Create `BocmApp/app/shared/components/ui/` directory
- [x] Create `BocmApp/app/shared/hooks/` directory
- [x] Create `BocmApp/app/shared/lib/` directory
- [x] Create `BocmApp/app/shared/types/` directory
- [x] Create `BocmApp/app/shared/utils/` directory
- [x] Create `BocmApp/app/shared/constants/` directory
- [x] Create `BocmApp/app/shared/contexts/` directory
- [x] Create `BocmApp/app/shared/services/` directory

### 1.2 Move Existing Components ✅
- [x] Move `BocmApp/app/components/` → `BocmApp/app/shared/components/ui/`
- [x] Move `BocmApp/app/hooks/` → `BocmApp/app/shared/hooks/`
- [x] Move `BocmApp/app/lib/` → `BocmApp/app/shared/lib/`
- [x] Move `BocmApp/app/types/` → `BocmApp/app/shared/types/`

### 1.3 Update Import Paths ✅
- [x] Update all import statements in BocmApp to use new shared paths
- [x] Create index files for easier imports
- [x] Update tsconfig.json paths if needed
- [x] Clean up old directories and files

## Phase 2: UI Component Parity

### 2.1 Current UI Components Status
**Components currently in BocmApp:**
- [x] `Button.tsx` - Basic button component
- [x] `Card.tsx` - Card component with header, content, footer
- [x] `Input.tsx` - Basic input component
- [x] `LoadingSpinner.tsx` - Loading spinner component
- [x] `Alert.tsx` - Alert component with title and description
- [x] `Badge.tsx` - Badge component
- [x] `Dialog.tsx` - Modal dialog component (newly created)
- [x] `Checkbox.tsx` - Checkbox component (newly created)
- [x] `Select.tsx` - Select dropdown component (newly created)

### 2.2 Missing Core UI Components
**Essential components from src that need React Native equivalents:**
- [x] `toast.tsx` → Create React Native toast component
- [x] `toaster.tsx` → Create React Native toast system
- [x] `use-toast.ts` → Create React Native toast hook
- [x] `label.tsx` → Create React Native label component
- [x] `form.tsx` → Create React Native form components
- [x] `textarea.tsx` → Create React Native textarea component
- [x] `switch.tsx` → Create React Native switch component
- [x] `radio-group.tsx` → Create React Native radio group component
- [x] `avatar.tsx` → Create React Native avatar component
- [x] `separator.tsx` → Create React Native separator component
- [x] `progress.tsx` → Create React Native progress bar component

### 2.3 Advanced UI Components (Lower Priority) ✅
**Complex components that may need React Native equivalents:**
- [x] `accordion.tsx` → Create React Native accordion
- [x] `alert-dialog.tsx` → Create React Native alert dialog
- [x] `dropdown-menu.tsx` → Create React Native dropdown menu
- [x] `popover.tsx` → Create React Native popover
- [x] `tabs.tsx` → Create React Native tabs
- [x] `toggle.tsx` → Create React Native toggle
- [x] `slider.tsx` → Create React Native slider
- [x] `calendar.tsx` → Create React Native calendar component
- [x] `skeleton.tsx` → Create React Native skeleton component
- [x] `scroll-area.tsx` → Create React Native scroll area component
- [x] `tooltip.tsx` → Create React Native tooltip component
- [x] `toggle-group.tsx` → Create React Native toggle group component
- [x] `hover-card.tsx` → Create React Native hover card component
- [x] `menubar.tsx` → Create React Native menubar component
- [x] `navigation-menu.tsx` → Create React Native navigation menu component

### 2.4 Component API Alignment ✅
- [x] Update `Button.tsx` to match src API and styling
- [x] Update `Card.tsx` to match src API and styling
- [x] Update `Input.tsx` to match src API and styling
- [x] Update `Alert.tsx` to match src API and styling
- [x] Update `Badge.tsx` to match src API and styling

## Phase 3: Styling and Design System ✅

### 3.1 Design Tokens Synchronization ✅
- [x] Extract design tokens from src Tailwind config
- [x] Create equivalent tokens in BocmApp twrnc config
- [x] Ensure color palette matches exactly
- [x] Ensure spacing scale matches exactly
- [x] Ensure typography scale matches exactly
- [x] Ensure border radius values match exactly

### 3.2 Component Styling Consistency ✅
- [x] Update all BocmApp components to use same design tokens
- [x] Ensure hover states work appropriately for mobile
- [x] Ensure focus states work appropriately for mobile
- [x] Ensure dark/light theme support matches

### 3.3 Utility Functions ✅
- [x] Copy `src/shared/lib/utils.ts` to `BocmApp/app/shared/lib/utils.ts`
- [x] Adapt utility functions for React Native where needed
- [x] Ensure `cn()` function works with twrnc

### 3.4 Design System Consolidation ✅
- [x] Remove duplicate design-tokens.ts file
- [x] Consolidate design system into theme.ts
- [x] Update StyleGuide component to use theme.ts
- [x] Ensure consistent design token access across codebase

## Phase 4: Page Structure Alignment ✅

### 4.1 Navigation Structure Analysis ✅
- [x] Analyze src app routing structure (Next.js App Router)
- [x] Analyze BocmApp navigation structure (React Navigation)
- [x] Map equivalent pages between both apps
- [x] Identify missing pages in BocmApp
- [x] Identify missing pages in src app

### 4.2 Current Page Mapping Status
**Pages currently in BocmApp:**
- [ ] `HomePage.tsx` - Main home page
- [ ] `LoginPage.tsx` - User login page
- [ ] `SignUpPage.tsx` - User registration page
- [ ] `FindBarberPage.tsx` - Browse/search barbers page
- [x] `CalendarPage.tsx` - Calendar/booking page ✅ **ENHANCED**
- [ ] `SettingsPage.tsx` - User settings page
- [ ] `BarberOnboardingPage.tsx` - Barber onboarding flow
- [ ] `CutsPage.tsx` - Cuts/reels page
- [ ] `BookingCalendarPage.tsx` - Booking calendar page
- [ ] `BookingSuccessPage.tsx` - Booking success page
- [ ] `EmailConfirmationScreen.tsx` - Email confirmation page
- [ ] `TermsPage.tsx` - Terms and conditions page

**Pages in src that need mapping:**
- [x] **Profile**: `src/app/profile/page.tsx` ↔ `BocmApp/app/pages/ProfilePortfolio.tsx` (CREATED)
- [ ] **Settings**: `src/app/settings/page.tsx` ↔ `BocmApp/app/pages/SettingsPage.tsx` (EXISTS)
- [ ] **Auth Pages**: `src/app/(routes)/` ↔ `BocmApp/app/pages/LoginPage.tsx, SignUpPage.tsx` (EXISTS)
- [ ] **Booking**: `src/app/book/` ↔ `BocmApp/app/pages/BookingCalendarPage.tsx` (EXISTS)
- [ ] **Cuts/Reels**: `src/app/reels/` ↔ `BocmApp/app/pages/CutsPage.tsx` (EXISTS)
- [ ] **Browse**: `src/app/browse/page.tsx` ↔ `BocmApp/app/pages/FindBarberPage.tsx` (EXISTS)
- [ ] **Calendar**: `src/app/calendar/page.tsx` ↔ `BocmApp/app/pages/CalendarPage.tsx` (EXISTS)

### 4.3 Missing Pages Implementation ✅
- [x] **Profile Portfolio**: Create `ProfilePortfolio.tsx` for user profile management
- [X] **Home Page**: Create proper landing page (currently using HomePage)
- [ ] **Barber Onboarding**: Add barber onboarding flow to src app (currently only in BocmApp)

### 4.4 Navigation Component Alignment ✅
- [x] **Navbar**: `src/shared/components/layout/navbar.tsx` ↔ `BocmApp/app/navigation/AppNavigator.tsx`
- [x] **Mobile Nav**: `src/shared/components/layout/mobile-nav.tsx` ↔ `BocmApp` (integrated in tab bar)
- [x] **Tab Bar**: Missing in src ↔ `BocmApp` (bottom tab navigation)
- [x] **Role-based Navigation**: Implement role-specific nav items in BocmApp

### 4.5 Layout and Structure Consistency ✅
- [x] **Layout Wrapper**: `src/shared/components/layout/layout-wrapper.tsx` ↔ `BocmApp/app/shared/components/layout/LayoutWrapper.tsx`
- [x] **Error Boundaries**: `src/shared/components/ui/enhanced-error-boundary.tsx` ↔ `BocmApp/app/shared/components/ui/ErrorBoundary.tsx`
- [x] **Loading States**: `src/shared/components/ui/loading-provider.tsx` ↔ `BocmApp/app/shared/components/ui/LoadingProvider.tsx`
- [x] **Theme Provider**: `src/shared/components/theme/theme-provider.tsx` ↔ `BocmApp/app/shared/components/theme/ThemeProvider.tsx`
- [x] **Toast System**: `src/shared/components/ui/toaster.tsx` ↔ `BocmApp/app/shared/components/ui/toaster.tsx`

### 4.6 Route Protection and Auth Flow ✅
- [x] **Auth Guards**: Implement route protection in BocmApp
- [x] **Role-based Access**: Ensure role-based page access in both apps
- [x] **Redirect Logic**: Align redirect behavior between apps
- [x] **Deep Linking**: Implement deep linking in BocmApp

### 4.7 Page Content Alignment ✅
- [x] **Page Headers**: Ensure consistent page headers and titles
- [x] **Page Layouts**: Align page layout structures
- [x] **Content Organization**: Ensure content is organized similarly
- [x] **Loading States**: Implement consistent loading states
- [x] **Error States**: Implement consistent error handling

## Phase 5: Shared Logic and Hooks ✅

### 5.1 Current Hooks Status ✅
**Hooks currently in BocmApp:**
- [x] `useAuth.tsx` - Authentication hook
- [x] `useCuts.tsx` - Cuts/portfolio management hook
- [x] `useData.tsx` - Data fetching and management hook
- [x] `usePayment.tsx` - Payment processing hook
- [x] `useSafeNavigation.tsx` - Safe navigation hook

**Hooks in src that need synchronization:**
- [x] Copy relevant hooks from `src/shared/hooks/` to `BocmApp/app/shared/hooks/`
- [x] Adapt hooks for React Native where needed
- [x] Ensure authentication hooks work the same way
- [x] Ensure data fetching hooks work the same way

### 5.2 Services Synchronization ✅
**Services currently in BocmApp:**
- [x] `api.ts` - Comprehensive API service (barber, booking, service, profile, analytics)

**Services in src that need synchronization:**
- [x] Copy relevant services from `src/shared/services/` to `BocmApp/app/shared/services/`
- [x] Adapt services for React Native where needed
- [x] Ensure API calls work the same way
- [x] Ensure error handling is consistent

### 5.3 Types Synchronization ✅
**Types currently in BocmApp:**
- [x] `index.ts` - Complete type definitions (User, Barber, Service, Booking, etc.)

**Types in src that need synchronization:**
- [x] Copy types from `src/shared/types/` to `BocmApp/app/shared/types/`
- [x] Ensure type definitions are identical
- [x] Update any platform-specific types

## Phase 6: Navigation and Routing ✅

### 6.1 Navigation Structure ✅
- [x] Map Next.js routes to React Navigation routes
- [x] Ensure deep linking works the same way
- [x] Ensure navigation state management is consistent
- [x] Update navigation components to match

### 6.2 Route Protection ✅
- [x] Ensure authentication guards work the same way
- [x] Ensure role-based access works the same way
- [x] Ensure redirect logic is consistent

## Phase 7: State Management ✅

### 7.1 Store Synchronization ✅
- [x] Copy relevant stores from `src/shared/stores/` to `BocmApp/app/shared/stores/`
- [x] Ensure Zustand stores work the same way
- [x] Ensure state persistence works appropriately for mobile

### 7.2 Context Synchronization ✅
- [x] Copy relevant contexts from `src/shared/contexts/` to `BocmApp/app/shared/contexts/`
- [x] Ensure context providers work the same way
- [x] Ensure state management is consistent

## Phase 8: Testing and Validation

### 8.1 Component Testing
- [ ] Test all UI components in both environments
- [ ] Ensure visual consistency between web and mobile
- [ ] Test responsive behavior on different screen sizes

### 8.2 Integration Testing
- [ ] Test navigation flows in both apps
- [ ] Test authentication flows in both apps
- [ ] Test data synchronization between apps

## Phase 9: Performance and Optimization

### 9.1 Performance Optimization
- [ ] Optimize bundle size for mobile
- [ ] Implement lazy loading where appropriate
- [ ] Optimize image loading and caching

### 9.2 Mobile-Specific Optimizations
- [ ] Implement proper touch interactions
- [ ] Optimize for mobile performance
- [ ] Ensure smooth animations and transitions

## Phase 10: Documentation and Maintenance

### 10.1 Documentation
- [ ] Document component APIs
- [ ] Document navigation structure
- [ ] Document state management patterns

### 10.2 Maintenance
- [ ] Set up automated testing
- [ ] Set up CI/CD pipelines
- [ ] Establish update procedures for both apps
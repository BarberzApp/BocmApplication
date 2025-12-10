# Testing Strategy for Barber App

## Overview

This document outlines our comprehensive testing strategy to ensure code quality, reliability, and maintainability across the barber app platform.

## Testing Pyramid

```
    /\
   /  \     E2E Tests (Cypress)
  /____\    Integration Tests (Jest + MSW)
 /      \   Unit Tests (Jest + RTL)
/________\  Component Tests (Jest + RTL)
```

## 1. Unit Testing

### What to Test
- **Components**: UI components, their props, states, and interactions
- **Hooks**: Custom React hooks and their logic
- **Utilities**: Helper functions, formatters, validators
- **Services**: API calls, data transformations

### Tools
- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers

### Example Structure
```
src/
├── shared/
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx
│   │       └── Button.test.tsx
│   ├── hooks/
│   │   ├── useAuth.tsx
│   │   └── useAuth.test.tsx
│   └── utils/
│       ├── formatters.ts
│       └── formatters.test.ts
```

### Best Practices
- Test behavior, not implementation
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test edge cases and error scenarios

## 2. Integration Testing

### What to Test
- **API Integration**: End-to-end API calls with mocked responses
- **Component Integration**: Multiple components working together
- **State Management**: Zustand stores and data flow
- **Authentication Flow**: Login, logout, session management

### Tools
- **MSW (Mock Service Worker)**: API mocking
- **Jest**: Test runner
- **React Testing Library**: Component integration testing

### Example
```typescript
// Integration test for booking flow
describe('Booking Integration', () => {
  it('should create booking and update UI', async () => {
    // Mock API responses
    server.use(
      rest.post('/api/bookings', (req, res, ctx) => {
        return res(ctx.json({ id: 'booking-123', status: 'confirmed' }))
      })
    )

    // Test component integration
    render(<BookingForm />)
    
    // Fill form and submit
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2024-01-15' } })
    fireEvent.click(screen.getByText('Book Appointment'))
    
    // Verify UI updates
    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed')).toBeInTheDocument()
    })
  })
})
```

## 3. End-to-End Testing

### What to Test
- **User Flows**: Complete user journeys (booking, payment, etc.)
- **Cross-Browser**: Different browsers and devices
- **Real API**: Integration with actual services (Stripe, Supabase)
- **Performance**: Load times, responsiveness

### Tools
- **Cypress**: E2E testing framework
- **Cypress Testing Library**: Better selectors
- **Custom Commands**: Reusable test utilities

### Test Categories
1. **Happy Path**: Successful user journeys
2. **Error Handling**: Network failures, validation errors
3. **Edge Cases**: Boundary conditions, unusual inputs
4. **Performance**: Load testing, memory leaks

### Example Structure
```
cypress/
├── e2e/
│   ├── booking-flow.cy.ts
│   ├── authentication.cy.ts
│   ├── payment-flow.cy.ts
│   └── error-handling.cy.ts
├── fixtures/
│   ├── test-data.json
│   └── mock-responses.json
└── support/
    ├── commands.ts
    └── e2e.ts
```

## 4. Performance Testing

### What to Test
- **Load Times**: Page load, component render times
- **Memory Usage**: Memory leaks, garbage collection
- **Bundle Size**: JavaScript bundle optimization
- **Core Web Vitals**: LCP, FID, CLS

### Tools
- **Performance API**: Browser performance metrics
- **Custom Performance Monitor**: Component-level monitoring
- **Lighthouse CI**: Automated performance audits

### Metrics to Track
- First Contentful Paint (FCP) < 1.5s
- Largest Contentful Paint (LCP) < 2.5s
- First Input Delay (FID) < 100ms
- Cumulative Layout Shift (CLS) < 0.1

## 5. Testing Commands

### Development
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm run test:components
npm run test:hooks
npm run test:utils
npm run test:integration
```

### E2E Testing
```bash
# Run E2E tests
npm run test:e2e

# Open Cypress UI
npm run test:e2e:open

# Run specific E2E test
npx cypress run --spec "cypress/e2e/booking-flow.cy.ts"
```

### CI/CD
```bash
# Run tests for CI
npm run test:ci

# Run all tests including E2E
npm run test:all
```

## 6. Test Data Management

### Mock Data
- **Consistent Test Data**: Use predefined mock objects
- **Factory Functions**: Generate test data dynamically
- **Database Seeds**: Consistent database state for tests

### Example
```typescript
// test-utils.ts
export const mockBarber = {
  id: 'test-barber-id',
  name: 'Test Barber',
  business_name: 'Test Business',
  email: 'test@example.com',
  // ... other properties
}

export const createMockBooking = (overrides = {}) => ({
  id: 'test-booking-id',
  barber_id: 'test-barber-id',
  client_id: 'test-client-id',
  date: '2024-01-15',
  time: '10:00',
  status: 'confirmed',
  ...overrides,
})
```

## 7. Coverage Requirements

### Minimum Coverage Thresholds
- **Statements**: 70%
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%

### Coverage Exclusions
- Configuration files
- Type definitions
- Test files
- Build artifacts

## 8. Testing Best Practices

### Component Testing
- Test user interactions, not implementation details
- Use semantic queries (getByRole, getByLabelText)
- Test accessibility features
- Mock external dependencies

### Hook Testing
- Test all hook states and transitions
- Mock dependencies and side effects
- Test error handling
- Verify cleanup functions

### API Testing
- Mock external services
- Test success and error responses
- Verify request/response formats
- Test rate limiting and timeouts

### E2E Testing
- Test complete user journeys
- Use realistic test data
- Test cross-browser compatibility
- Include performance assertions

## 9. Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ci
      - run: npm run test:e2e
      - run: npm run build
```

### Pre-commit Hooks
- Run unit tests
- Check code coverage
- Lint code
- Type check

## 10. Debugging Tests

### Common Issues
1. **Async Testing**: Use `waitFor` and `act`
2. **Mocking**: Ensure mocks are properly set up
3. **Timing**: Account for loading states and animations
4. **Environment**: Check test environment variables

### Debug Commands
```bash
# Debug Jest tests
npm test -- --verbose --no-coverage

# Debug Cypress tests
npx cypress open --config video=false

# Debug specific test
npm test -- --testNamePattern="Button Component"
```

## 11. Performance Testing

### Automated Performance Tests
```typescript
import { createPerformanceTest, checkPerformanceThresholds } from '@/shared/utils/performance-test'

describe('Performance Tests', () => {
  it('should load booking page within performance thresholds', async () => {
    const test = createPerformanceTest('Booking Page Load')
    
    test.start()
    await page.goto('/booking')
    test.end()
    
    const { metrics } = test.end()
    const violations = checkPerformanceThresholds(metrics)
    
    expect(violations).toHaveLength(0)
  })
})
```

## 12. Future Improvements

### Planned Enhancements
- [ ] Visual regression testing
- [ ] Accessibility testing automation
- [ ] Load testing for high-traffic scenarios
- [ ] Mobile device testing
- [ ] Cross-platform testing (React Native)

### Monitoring
- [ ] Test execution time tracking
- [ ] Flaky test detection
- [ ] Performance regression alerts
- [ ] Coverage trend analysis

---

## Quick Reference

### Test File Naming
- Unit tests: `ComponentName.test.tsx`
- Integration tests: `ComponentName.integration.test.tsx`
- E2E tests: `feature-name.cy.ts`

### Test Organization
```typescript
describe('ComponentName', () => {
  describe('when rendering', () => {
    it('should display correctly', () => {
      // test implementation
    })
  })
  
  describe('when user interacts', () => {
    it('should handle click events', () => {
      // test implementation
    })
  })
  
  describe('when API calls fail', () => {
    it('should show error message', () => {
      // test implementation
    })
  })
})
```

### Common Assertions
```typescript
// Component rendering
expect(screen.getByRole('button')).toBeInTheDocument()
expect(screen.getByText('Submit')).toBeVisible()

// User interactions
fireEvent.click(screen.getByRole('button'))
fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })

// Async operations
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument()
})

// API responses
expect(mockApi).toHaveBeenCalledWith(expectedParams)
expect(mockApi).toHaveBeenCalledTimes(1)
```


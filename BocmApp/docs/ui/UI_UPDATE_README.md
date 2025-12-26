# BocmApp UI Update

This document outlines the UI updates made to the BocmApp to match the design system from the main `src` folder.

## Overview

The BocmApp UI has been updated to use a consistent design system that matches the web application. The updates include:

- Modern color scheme with proper contrast
- Consistent component styling
- Improved typography
- Better spacing and layout
- Enhanced user experience

## Updated Components

### 1. Button Component (`app/components/Button.tsx`)
- **Variants**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- **Sizes**: `sm`, `default`, `lg`, `icon`
- **Features**: Consistent styling, proper hover states, accessibility support

### 2. Card Component (`app/components/Card.tsx`)
- **Sub-components**: `CardHeader`, `CardTitle`, `CardContent`
- **Features**: Clean white background, subtle shadows, rounded corners

### 3. Input Component (`app/components/Input.tsx`)
- **Features**: Label support, error handling, consistent styling
- **States**: Focus, error, disabled states

### 4. Badge Component (`app/components/Badge.tsx`)
- **Variants**: `default`, `secondary`, `destructive`, `outline`
- **Features**: Rounded design, consistent sizing

### 5. Alert Component (`app/components/Alert.tsx`)
- **Sub-components**: `AlertTitle`, `AlertDescription`
- **Variants**: `default`, `destructive`
- **Features**: Clear messaging, proper color coding

### 6. LoadingSpinner Component (`app/components/LoadingSpinner.tsx`)
- **Sizes**: `sm`, `default`, `lg`
- **Features**: Consistent with design system colors

## Design System

### Colors
The color scheme matches the web application:

```typescript
{
  background: '#262b2e',        // Dark background
  foreground: '#fff',           // White text
  primary: '#262b2e',           // Primary brand color
  secondary: '#c98f42',         // Secondary/accent color
  muted: '#f5f5f5',             // Muted background
  mutedForeground: '#b0b0b0',   // Muted text
  destructive: '#ff4d4f',       // Error/danger color
  border: '#e5e7eb',            // Border color
  saffron: '#8d7250',           // Brand accent
}
```

### Typography
- **Font Sizes**: xs (12), sm (14), base (16), lg (18), xl (20), 2xl (24), 3xl (30), 4xl (36)
- **Font Weights**: light (300), normal (400), medium (500), semibold (600), bold (700)

### Spacing
- **Spacing Scale**: xs (4), sm (8), md (16), lg (24), xl (32), xxl (48)

### Border Radius
- **Radius Scale**: sm (4), md (8), lg (12), xl (16), full (9999)

## Usage Examples

### Button Usage
```typescript
import { Button } from '../components';

<Button variant="default" size="lg" onPress={handlePress}>
  Get Started
</Button>
```

### Card Usage
```typescript
import { Card, CardHeader, CardTitle, CardContent } from '../components';

<Card>
  <CardHeader>
    <CardTitle>Welcome</CardTitle>
  </CardHeader>
  <CardContent>
    <Text>Content goes here</Text>
  </CardContent>
</Card>
```

### Input Usage
```typescript
import { Input } from '../components';

<Input 
  label="Email"
  placeholder="Enter your email"
  error="Please enter a valid email"
/>
```

## Theme Configuration

The theme is defined in `app/lib/theme.ts` and includes:
- Color palette
- Typography scale
- Spacing scale
- Border radius values
- Shadow definitions

## Utility Functions

Utility functions are available in `app/lib/utils.ts`:
- `cn()`: Combine class names
- `combineStyles()`: Combine style objects
- `createStyleSheet()`: Create typed style sheets

## Updated Pages

### HomePage
The HomePage has been updated to showcase the new design system:
- Clean card-based layout
- Proper color usage
- Consistent spacing
- Multiple button variants

## Migration Notes

1. **Import Changes**: Update imports to use the new component structure
2. **Color Updates**: Replace hardcoded colors with theme colors
3. **Spacing**: Use the defined spacing scale instead of arbitrary values
4. **Typography**: Use the defined font sizes and weights

## Future Enhancements

- Add more component variants
- Implement dark mode support
- Add animation utilities
- Create more complex layout components
- Add accessibility improvements

## Files Modified

- `app/components/Button.tsx` - Updated styling and variants
- `app/components/Card.tsx` - New component
- `app/components/Input.tsx` - New component
- `app/components/Badge.tsx` - New component
- `app/components/Alert.tsx` - New component
- `app/components/LoadingSpinner.tsx` - New component
- `app/components/index.ts` - Export file
- `app/lib/theme.ts` - Theme configuration
- `app/lib/utils.ts` - Utility functions
- `app/pages/HomePage.tsx` - Updated to use new components 
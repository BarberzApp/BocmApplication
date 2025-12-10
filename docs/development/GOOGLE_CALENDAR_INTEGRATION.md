# Google Calendar Integration

## Overview

The BOCM app now includes Google Calendar integration that allows both barbers and clients to easily sync their appointments with their Google Calendar. This feature provides multiple ways to add appointments to external calendars, enhancing the user experience and ensuring users never miss their appointments.

## Features

### 1. Google Calendar Web Integration
- **Direct Link**: Opens Google Calendar in a new tab with pre-filled appointment details
- **Automatic Event Creation**: Generates properly formatted calendar events with all relevant information
- **Role-Based Content**: Different event descriptions for barbers vs clients

### 2. iCal File Download
- **Standard Format**: Downloads appointments in iCal (.ics) format
- **Universal Compatibility**: Works with all major calendar applications (Apple Calendar, Outlook, etc.)
- **Individual Files**: Each appointment can be downloaded as a separate file

### 3. Smart Event Details
- **Service Information**: Includes service name, duration, and price
- **Contact Details**: Shows client/barber information based on user role
- **Location Support**: Includes barber location when available
- **Reminders**: Sets up 15-minute popup and 1-hour email reminders

## Implementation

### Core Utility Functions

Located at: `src/shared/lib/google-calendar-utils.ts`

#### `generateGoogleCalendarEvent()`
Creates properly formatted Google Calendar event data:

```typescript
function generateGoogleCalendarEvent(
  event: CalendarEvent,
  userRole: 'barber' | 'client',
  userInfo: UserInfo
): GoogleCalendarEvent
```

**Features:**
- Role-based event descriptions
- Automatic timezone detection
- Built-in reminders (15min popup, 1hr email)
- Location inclusion

#### `addToGoogleCalendar()`
Opens Google Calendar with pre-filled event details:

```typescript
function addToGoogleCalendar(
  event: CalendarEvent,
  userRole: 'barber' | 'client',
  userInfo: UserInfo
): void
```

#### `downloadICalFile()`
Downloads appointment as iCal file:

```typescript
function downloadICalFile(
  events: CalendarEvent[],
  userRole: 'barber' | 'client',
  userInfo: UserInfo,
  filename?: string
): void
```

### Integration Points

#### 1. Enhanced Calendar Component
**Location**: `src/shared/components/calendar/enhanced-calendar.tsx`

**Features:**
- Google Calendar button in event detail dialog
- iCal download button in event detail dialog
- Role-aware event formatting
- Error handling with console logging

**Usage:**
```tsx
// In event dialog
<Button onClick={() => addToGoogleCalendar(selectedEvent, 'barber', userInfo)}>
  <ExternalLink className="w-4 h-4 mr-2" />
  Google Calendar
</Button>
```

#### 2. Features Calendar Component
**Location**: `src/features/calendar/components/page.tsx`

**Features:**
- Google Calendar sync for each booking card
- iCal download for individual appointments
- Role-based user information
- Consistent styling with app theme

**Usage:**
```tsx
// In booking card
<Button onClick={() => addToGoogleCalendar(bookingEvent, userRole, userInfo)}>
  <ExternalLink className="w-4 h-4 mr-2" />
  Google Calendar
</Button>
```

## User Experience

### For Barbers
- **Event Title**: "Appointment: [Service Name] - [Client Name]"
- **Description**: Includes client details, service info, price, and guest contact info if applicable
- **Location**: Barber's business location
- **Reminders**: 15-minute popup and 1-hour email notifications

### For Clients
- **Event Title**: "Appointment: [Service Name]"
- **Description**: Service details, price, and barber information
- **Location**: Barber's business location
- **Reminders**: Same notification setup as barbers

## Technical Details

### Event Formatting

#### Google Calendar URL Structure
```
https://calendar.google.com/calendar/render?action=TEMPLATE&text=[Title]&dates=[StartDate]/[EndDate]&details=[Description]&location=[Location]&ctz=[Timezone]
```

#### iCal File Structure
```ical
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BOCM//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:[UniqueID]@bocm.com
DTSTAMP:[Timestamp]
DTSTART:[StartDateTime]
DTEND:[EndDateTime]
SUMMARY:[EventTitle]
DESCRIPTION:[EventDescription]
LOCATION:[Location]
END:VEVENT
END:VCALENDAR
```

### Error Handling
- **Console Logging**: All errors are logged to console for debugging
- **Graceful Degradation**: App continues to function if calendar integration fails
- **User Feedback**: Clear button states and loading indicators

### Browser Compatibility
- **Google Calendar**: Works in all modern browsers
- **iCal Download**: Compatible with all browsers that support Blob API
- **Mobile Support**: Fully responsive and touch-friendly

## Security Considerations

### Data Privacy
- **No API Keys**: Uses Google Calendar's web interface, no authentication required
- **Local Processing**: All event generation happens client-side
- **User Control**: Users manually choose when to sync appointments

### Information Exposure
- **Minimal Data**: Only necessary appointment details are included
- **Role-Based**: Different information shown based on user role
- **Optional**: Users can choose not to use the feature

## Future Enhancements

### Potential Improvements
1. **Bulk Export**: Export multiple appointments at once
2. **Calendar Sync**: Real-time two-way sync with Google Calendar API
3. **Custom Reminders**: Allow users to set custom reminder times
4. **Recurring Events**: Support for recurring appointments
5. **Calendar Selection**: Choose which Google Calendar to add events to

### API Integration
- **Google Calendar API**: For more advanced features
- **OAuth Integration**: For authenticated calendar access
- **Webhook Support**: For real-time updates

## Usage Instructions

### For Barbers
1. Navigate to the Calendar page
2. Click on any appointment to view details
3. Click "Google Calendar" to open Google Calendar with pre-filled details
4. Click "Download iCal" to save the appointment file
5. Import the iCal file into your preferred calendar app

### For Clients
1. Navigate to the Bookings page
2. Find your appointment in the list
3. Click "Google Calendar" to add to Google Calendar
4. Click "Download iCal" to save the appointment file
5. Import the iCal file into your preferred calendar app

## Troubleshooting

### Common Issues
1. **Google Calendar not opening**: Check popup blocker settings
2. **iCal file not downloading**: Ensure browser supports Blob API
3. **Wrong timezone**: Verify system timezone settings
4. **Missing information**: Check that appointment data is complete

### Debug Information
- All calendar operations are logged to browser console
- Check console for detailed error messages
- Verify user role and appointment data structure

## Testing

### Manual Testing Checklist
- [ ] Google Calendar button opens new tab with pre-filled event
- [ ] iCal download creates valid calendar file
- [ ] Event details are correct for both roles
- [ ] Timezone information is accurate
- [ ] Error handling works properly
- [ ] Mobile responsiveness is maintained

### Automated Testing
- Unit tests for utility functions
- Integration tests for calendar components
- E2E tests for user workflows

## Conclusion

The Google Calendar integration provides a seamless way for users to manage their appointments across multiple calendar platforms. The implementation is secure, user-friendly, and maintains the app's high-quality user experience while adding valuable functionality for appointment management. 
# Homebase App - Design Guidelines

## Brand Identity

**App Personality**: Professional yet approachable service marketplace platform that seamlessly transitions between homeowner and service provider experiences.

**Visual Direction**: Clean, sophisticated interface with **Liquid Glass aesthetic** - subtle transparency, soft blurs, and frosted effects creating depth without clutter. The design should feel premium and trustworthy while remaining accessible.

**Memorable Element**: The unified #38AE5F accent color threading through both portals, combined with the smooth role-switching experience that transforms the entire interface without requiring separate logins.

## Navigation Architecture

**Root Navigation Type**: Role-based Tab Navigation (changes based on user state)

### Guest Mode (Default)
- Find (marketplace browsing)
- Manage (locked preview with gate)
- More

### Homeowner Mode (Authenticated)
- Find (marketplace)
- Manage (bookings)
- Messages
- More

### Provider Mode (Authenticated + Approved Provider)
- Home (dashboard)
- Leads
- Schedule  
- Money
- More

**Role Switching**: Only accessible in More > Settings for users with provider profiles. Switching roles completely replaces the tab bar and navigation stack, followed by a confirmation screen.

## Screen-by-Screen Specifications

### Guest/Homeowner: Find (Marketplace)
- **Header**: Liquid glass transparent header with search bar, location selector (left), filter icon (right)
- **Content**: Scrollable grid of service category cards with liquid glass effect
- **Safe Area**: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components**: Category cards (2-column grid), Featured providers carousel, Recent searches

### Guest/Homeowner: Manage
- **Guest**: Empty state with "Sign in to manage bookings" illustration and Account Gate trigger
- **Homeowner**: Scrollable list of booking cards
- **Header**: Default with title "Manage", filter icon (right)
- **Safe Area**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components**: Booking cards (liquid glass), status pills, empty state illustration

### Homeowner: Messages
- **Header**: Default with title "Messages", compose icon (right)
- **Content**: Scrollable list of conversation rows
- **Safe Area**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components**: Conversation list rows with avatar, preview text, timestamp, unread badge

### Both: More
- **Header**: Transparent liquid glass with profile section (avatar, name, role indicator)
- **Content**: Scrollable grouped list sections
- **Safe Area**: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Sections**: 
  - Profile (avatar, edit profile)
  - Account (payment methods, addresses)
  - Settings (notifications, role switcher if provider exists, "Become a Provider" button if not)
  - Support & Legal

### Provider: Home (Dashboard)
- **Header**: Liquid glass with greeting, notification icon (right)
- **Content**: Scrollable cards showing stats and quick actions
- **Safe Area**: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components**: Stat cards (liquid glass), earnings chart, upcoming jobs list

### Provider: Leads
- **Header**: Default with title "Leads", filter icon (right)
- **Content**: Scrollable list of lead cards with swipe actions
- **Safe Area**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components**: Lead cards showing job details, status pills, action buttons

### Account Gate Modal
- **Type**: Bottom sheet modal with liquid glass backdrop
- **Content**: Centered illustration, headline, "Continue with Apple" primary button, secondary auth options
- **Components**: Modal container, close button (top right), action buttons

## Color Palette

**Accent** (Only accent color in entire app):
- Primary: #38AE5F

**Neutrals (Light Mode)**:
- Background: #FFFFFF
- Surface: #F8F9FA
- Border: #E5E7EB
- Text Primary: #1F2937
- Text Secondary: #6B7280
- Text Tertiary: #9CA3AF

**Neutrals (Dark Mode)**:
- Background: #0F1419
- Surface: #1A1F26
- Border: #2D3339
- Text Primary: #F9FAFB
- Text Secondary: #D1D5DB
- Text Tertiary: #9CA3AF

**Semantic** (Use accent color with icons/text for context):
- Success: #38AE5F (same as primary)
- Warning: Use amber/orange icon with neutral text
- Error: Use red icon with neutral text
- Info: Use blue icon with neutral text

## Typography

**Font Family**: SF Pro (System font for iOS)

**Type Scale**:
- Display: 32px, Bold
- H1: 24px, Bold
- H2: 20px, Semibold
- H3: 18px, Semibold
- Body: 16px, Regular
- Body Small: 14px, Regular
- Caption: 12px, Regular
- Label: 14px, Medium

## Visual Design System

**Liquid Glass Effect** (Apply to these elements only):
- Headers (when transparent)
- Tab bars
- Key cards (booking cards, stat cards, featured cards)
- Modals and bottom sheets
- Status pills

**Liquid Glass Specifications**:
- Background: Surface color with 70% opacity
- Blur: 20px backdrop blur
- Border: 1px solid Border color with 40% opacity
- Corner radius: 16px for cards, 12px for pills

**Component Styling**:
- **PrimaryButton**: #38AE5F background, white text, 12px corner radius, full width, 52px height
- **SecondaryButton**: Transparent background, #38AE5F border (1.5px), #38AE5F text, 12px corner radius
- **Card**: Liquid glass effect OR solid Surface color with subtle shadow (use sparingly)
- **ListRow**: 56px height, left icon/avatar, right chevron, hairline divider
- **StatusPill**: Liquid glass, 6px corner radius, 8px vertical padding, 12px horizontal padding
- **TextField**: Surface background, Border color border (1px), 12px corner radius, 48px height, 16px padding

**Touchable Feedback**: All interactive elements reduce opacity to 0.7 when pressed

**Floating Elements Shadow** (only for floating action buttons):
- shadowOffset: { width: 0, height: 2 }
- shadowOpacity: 0.10
- shadowRadius: 2

## Assets to Generate

1. **icon.png** - App icon featuring abstract home/service symbol in #38AE5F on white background (iOS home screen)

2. **splash-icon.png** - Same icon for splash screen

3. **empty-bookings.png** - Minimalist illustration of empty calendar/checklist in grayscale with subtle #38AE5F accent (Manage tab when no bookings)

4. **empty-messages.png** - Simple illustration of message bubble in grayscale (Messages tab when no conversations)

5. **empty-leads.png** - Illustration of waiting/inbox state in grayscale (Provider Leads tab when no leads)

6. **account-gate.png** - Welcoming illustration for Account Gate modal in grayscale with #38AE5F highlight

7. **avatar-default.png** - Default user avatar in circular format with #38AE5F background and white initial placeholder

8. **role-switch-confirmation.png** - Checkmark or transition illustration for role switch success (Role switch confirmation screen)
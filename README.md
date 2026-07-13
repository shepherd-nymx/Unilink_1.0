# UNILINK

UNILINK is a grocery delivery application with separate interfaces for customers, drivers, and admin.

## Features

### Customer Portal
- Login using username + phone number
- Browse and select groceries from a checklist
- Choose payment option: Pay on Delivery or EcoCash
- Location automatically captured using GPS coordinates
- View order ticket with all details

### Driver Portal
- Login using phone number + monthly key
- Monthly keys expire after 30 days and require renewal
- Configure delivery settings:
  - Maximum distance willing to travel
  - Delivery fees based on order tiers
  - Availability status (ON/OFF)
  - Delivery type (walking/vehicle)
- View pending delivery requests
- Accept deliveries and view customer locations
- Open customer location in Google Maps

### Admin Portal
- Login credentials: `admin` / `admin123`
- Add and manage customers
- Add and manage drivers
- Generate and renew driver monthly keys
- View all deliveries and transactions
- Track order statuses

## Database Schema

### Tables
- **admins** - Admin user accounts
- **customers** - Customer profiles (added by admin only)
- **drivers** - Driver profiles with monthly keys
- **driver_keys** - History of driver authentication keys
- **grocery_items** - Available items for purchase
- **deliveries** - Order transactions and tickets

## Getting Started

### Admin Access
Available admin accounts:
- Username: `admin` / Password: `admin123`
- Username: `mufaro` / Password: `Mutevedzi@20`

### Sample Data
The database is pre-populated with 15 common grocery items.

### User Registration
- Customers and drivers cannot register themselves
- Only admin can add new customers and drivers
- Driver keys are automatically generated when creating a driver

## Technical Stack
- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Authentication)
- **Navigation**: Expo Router
- **UI**: React Native StyleSheet
- **Icons**: Lucide React Native
- **Location**: Expo Location

## Project Structure
```
app/
├── index.tsx                    # Landing page with role selection
├── customer/
│   ├── login.tsx               # Customer authentication
│   ├── dashboard.tsx           # Grocery selection and ordering
│   └── ticket.tsx              # Order confirmation
├── driver/
│   ├── login.tsx               # Driver authentication
│   ├── dashboard.tsx           # View pending deliveries
│   └── settings.tsx            # Configure driver preferences
└── admin/
    ├── login.tsx               # Admin authentication
    ├── dashboard.tsx           # Admin main menu
    ├── customers.tsx           # Manage customers
    ├── drivers.tsx             # Manage drivers
    └── deliveries.tsx          # View all deliveries
```

## Database Migrations
All database migrations are stored in `supabase/migrations/` directory.

## Security
- Row Level Security (RLS) enabled on all tables
- Admin-only access for user management
- Secure authentication for all user roles
- Location data captured only at order placement

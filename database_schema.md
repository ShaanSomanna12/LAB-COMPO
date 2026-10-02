# Database Schema Overview

The platform uses a relational PostgreSQL database (hosted on Supabase) with strict Row Level Security (RLS) enabled. Below is a high-level overview of the core entities.

## Core Tables

### 1. `users`
Stores all authenticated user profiles and their role metadata.
- `id` (UUID, Primary Key)
- `usn` (String, Unique) - Institutional identifier used for student login.
- `email` (String, Unique)
- `name`, `department`, `branch`, `section`, `mobile`
- `role` (Enum: `student`, `admin`, `hod`, `super_admin`)
- `id_card_url` (String) - Verified ID card reference.

### 2. `components`
The central catalog of all laboratory hardware available for checkout.
- `component_id` (UUID, Primary Key)
- `name` (String)
- `department` (String) - Defines which department owns the asset (e.g., ECE, CSE).
- `total_quantity` (Integer)
- `available_quantity` (Integer)
- `base_condition` (Text)
- `value_tier` (Enum: `STANDARD`, `HIGH`, `CRITICAL`) - Determines if HOD approval is required.
- `photo_url` (String)

### 3. `reservations`
Tracks the complete lifecycle of a student's hardware borrowing request.
- `id` (UUID, Primary Key)
- `student_name`, `usn`, `department`, `mobile`
- `target_department` (String) - Department from which items are requested.
- `request_date`, `time_slot`, `duration` (Integer)
- `status` (Enum: `PENDING_APPROVAL`, `PENDING_HOD`, `APPROVED`, `CHECKED_OUT`, `RETURN_REQUESTED`, `RETURNED`, `REJECTED`)
- `project_title`, `project_description`, `request_mode`
- `id_card_url`, `signature_url` (String) - References to storage buckets for verification.

### 4. `reservation_items`
A junction table mapping specific components to a reservation (many-to-many).
- `id` (UUID, Primary Key)
- `reservation_id` (UUID, Foreign Key -> `reservations`)
- `component_id` (UUID, Foreign Key -> `components`)
- `quantity` (Integer)

## Security
- **Row Level Security (RLS):** Policies are enforced at the database level. For example, students can only read their own reservations, while Lab Admins can only read/update reservations and components within their specifically assigned department, ensuring strict multitenancy.

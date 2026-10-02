# Technical Architecture

## Overview
The platform utilizes a modern, hybrid architecture designed for scalability, security, and developer velocity. It leverages a serverless database backend paired with a meta-framework for the frontend and API gateway.

## Technology Stack

### Frontend & API Gateway
- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Styling:** Tailwind CSS, Framer Motion (for fluid animations)
- **UI Components:** Lucide React (icons), Sonner (toast notifications)
- **Rendering Strategy:** Hybrid (Client-Side Rendering for dynamic dashboards, Server-Side API routes for secure operations).

### Backend & Database
- **Database:** PostgreSQL (managed by [Supabase](https://supabase.com/))
- **Authentication:** Supabase Auth (Email/Password, customized to support USN-based login).
- **Storage:** Supabase Storage (Buckets for `id_cards`, `signatures`, and inventory images).
- **Security:** Row Level Security (RLS) policies implemented natively in PostgreSQL to ensure strict data segregation between departments and roles.

## Architectural Patterns

1. **API Encapsulation:** Next.js API routes (`/api/*`) act as a secure gateway, encapsulating sensitive operations (like sending emails or processing OTPs) away from the client browser.
2. **Relational Integrity:** Unlike NoSQL document stores, PostgreSQL was selected to enforce atomic row-level locks (e.g., `SELECT FOR UPDATE`) and specific data invariants, which are essential for a hardware reservation system to safely decrement stock and prevent overlapping bookings.
3. **Event-Driven Workflows:** State transitions (e.g., from `PENDING_APPROVAL` to `CHECKED_OUT`) trigger updates in real-time, often leveraging Supabase's real-time subscriptions or background cron jobs for overdue notifications.

## System Interfaces
- **Student Portal:** Component catalog, cart management, checkout form, dynamic requisition letter generation, and reservation tracking.
- **Admin/Faculty Portal:** Dashboard for approving/rejecting requests, verifying component condition through uploaded images, and managing inventory stock.
- **HOD Dashboard:** Executive view for high-value component approvals and disciplinary escalations.

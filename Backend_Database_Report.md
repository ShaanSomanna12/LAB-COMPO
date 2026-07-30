# Phoenix Technical Architecture & Code Logic Report

This document details the exact programming languages, structural codebase architecture, and core backend/database execution logic for the Phoenix platform.

## 1. Programming Languages & Runtime Environments
- **Primary Language:** **TypeScript** (Strict mode enabled). All Next.js frontend components, server-side API routes, and database client interfaces are strongly typed to catch schema mismatches at compile time.
- **Backend Worker Language:** **JavaScript (CommonJS/ES6)** running on a dedicated **Node.js** daemon.
- **Database Query Language:** **SQL (PostgreSQL Dialect)**, heavily utilizing PL/pgSQL for stored procedures, Row-Level Security policies, and trigger functions.

## 2. API Architecture (The Decoupled System)
The system employs a decoupled microservice architecture, splitting synchronous HTTP requests and asynchronous background tasks across two distinct runtimes.

### A. Next.js API Routes (Synchronous REST Layer)
- **Framework:** Next.js 16 (App Router paradigm).
- **Location:** `frontend/src/app/api/...`
- **Logic:** These endpoints process all immediate HTTP requests. 
- **Code Flow:** 
  1. A `POST /api/requests` is intercepted.
  2. The JWT (JSON Web Token) is extracted from cookies and validated using `@supabase/ssr` on the server edge.
  3. Input payloads (like USN, component IDs) are parsed and validated against strict Regex strings (e.g., `/^[1-4][A-Z]{2}[0-9]{2}[A-Z]{2,3}[0-9]{2,3}$/` for USNs).
  4. Synchronous database mutations (Inserts/Updates) are executed via the `@supabase/supabase-js` client, awaited, and an HTTP 200/400 is returned to the client.

### B. Express.js / Node.js Worker (Asynchronous Queue Layer)
- **Framework:** Express.js 5 / Node.js.
- **Location:** `backend/index.js` and `backend/workers/`
- **Logic:** Offloads heavy computing and time-delayed processes from the Next.js event loop to prevent blocking UI threads.
- **Code Flow (BullMQ Integration):**
  1. The Next.js API pushes a serialized JSON payload to a Redis memory queue using `new Queue('notification-queue')`.
  2. The backend Node.js worker constantly listens via `new Worker('notification-queue', async (job) => { ... })`.
  3. Inside the worker, it executes Base64 PDF generation (using `jspdf` buffers) and triggers HTTP requests to the `@sendgrid/mail` SMTP API.
  4. It utilizes BullMQ's native Redis-backed timer scheduling for `delayed` jobs (e.g., executing a callback exactly 48 hours later for an overdue notice).

## 3. Database Schema & Execution Logic (PostgreSQL)
The database relies heavily on the RDBMS engine's constraints rather than application-layer `if/else` logic to ensure data integrity.

### A. Concurrency Logic (Double-Booking Prevention)
- **Layer 1 (Application): Redis Distributed Locking:** Using the `ioredis` driver, before a checkout transaction begins, the code executes `SETNX component:<id>:lock true EX 300`. This grants a 300-second (5-minute) mutually exclusive lock. If the client drops, the lock naturally expires.
- **Layer 2 (Database): PostgreSQL Exclusion Constraints:** The reservations table schema utilizes the native `tsrange` (timestamp range) data type. 
  ```sql
  ALTER TABLE reservations 
  ADD CONSTRAINT no_overlapping_reservations 
  EXCLUDE USING GIST (component_id WITH =, time_range WITH &&);
  ```
  This relational algebra logic guarantees the database engine itself will forcefully reject (`HTTP 409 Conflict`) any `INSERT` query where time ranges (`&&`) overlap for the same `component_id`.

### B. Cryptographic Audit Trail Logic (PL/pgSQL Triggers)
- Instead of the Node.js API pushing audit logs, the database handles it internally via Triggers to ensure zero bypass (even if an admin accesses the DB directly).
- **Trigger Logic:** 
  ```sql
  CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reservations
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();
  ```
- Inside the `process_audit_log()` procedure, the script captures the `JSONB` payload of the `NEW` and `OLD` records. It computes the `curr_hash` using a SHA-256 algorithm: `encode(digest(payload || prev_hash, 'sha256'), 'hex')`. This writes an immutable cryptographic chain directly into the `strict_audit_log` table.

### C. Row Level Security (RLS)
- Supabase enforces authorization directly at the query execution level. 
- Using SQL policies (e.g., `CREATE POLICY "Students can view own requests" ON requests FOR SELECT USING (auth.uid() = user_id);`), unauthorized data access is mathematically blocked *before* the query result is ever returned to the Node API.

## 4. Reverse Geocoding Integration Logic
- **Client Side:** The application invokes `navigator.geolocation.getCurrentPosition()` to extract raw floating-point `latitude` and `longitude`.
- **API Fetch:** A standard asynchronous `fetch()` is executed against `https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}`.
- **Caching Logic:** The application parses the returned JSON `display_name` and caches the mapped key-value pair `(lat,lon) -> address_string` directly in the browser's `localStorage`. Subsequent renders check this cache first to bypass external API rate limiting.

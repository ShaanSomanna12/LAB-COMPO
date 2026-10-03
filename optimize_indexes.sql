-- ==========================================
-- LabNexus Database Performance Optimization
-- Indexes for High-Concurrency Scaling
-- ==========================================

-- 1. RESERVATIONS TABLE
-- ------------------------------------------
-- Speeds up queries fetching reservations by student ID
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);

-- Speeds up admin & HOD dashboard filtering by status (e.g. 'PENDING_APPROVAL', 'APPROVED')
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- Speeds up HOD filtering by department
CREATE INDEX IF NOT EXISTS idx_reservations_student_department ON reservations(student_department);

-- Speeds up sorting in all admin tables
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at DESC);

-- Speeds up relational joins when fetching components
CREATE INDEX IF NOT EXISTS idx_reservations_component_id ON reservations(component_id);


-- 2. USERS TABLE
-- ------------------------------------------
-- Speeds up login, OTP generation, and profile lookups
CREATE INDEX IF NOT EXISTS idx_users_usn ON users(usn);

-- Speeds up authentication mapping via email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- 3. COMPONENTS TABLE
-- ------------------------------------------
-- Speeds up inventory searches by name
CREATE INDEX IF NOT EXISTS idx_components_name ON components(name);

-- Speeds up inventory filtering by lab location and department
CREATE INDEX IF NOT EXISTS idx_components_location ON components(lab_location);
CREATE INDEX IF NOT EXISTS idx_components_department ON components(department);


-- 4. IOT TRANSACTIONS (Quick Checkout)
-- ------------------------------------------
-- Speeds up fetching history for individual students
CREATE INDEX IF NOT EXISTS idx_iot_transactions_student_id ON iot_transactions(student_id);

-- Speeds up admin dashboard filtering by status
CREATE INDEX IF NOT EXISTS idx_iot_transactions_status ON iot_transactions(status);

-- Speeds up admin dashboard filtering by Lab ID
CREATE INDEX IF NOT EXISTS idx_iot_transactions_lab_id ON iot_transactions(lab_id);

-- Speeds up relational joins for transaction items
CREATE INDEX IF NOT EXISTS idx_iot_items_transaction_id ON iot_transaction_items(transaction_id);

-- 5. COMPONENT INSTANCES (Assets)
-- ------------------------------------------
-- Speeds up finding an AVAILABLE instance during checkout locking
CREATE INDEX IF NOT EXISTS idx_instances_component_status ON component_instances(component_id, status);

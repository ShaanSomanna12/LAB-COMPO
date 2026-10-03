-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- Create IoT Components Table
CREATE TABLE IF NOT EXISTS iot_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_id INT NOT NULL DEFAULT 1 CHECK (lab_id IN (1, 2)),
    name TEXT NOT NULL,
    description TEXT,
    total_quantity INT NOT NULL DEFAULT 0,
    available_quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create IoT Transactions Table
CREATE TABLE IF NOT EXISTS iot_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    lab_id INT NOT NULL CHECK (lab_id IN (1, 2)),
    type TEXT NOT NULL CHECK (type IN ('session', 'project')),
    session_time TEXT,
    project_title TEXT,
    mentor_name TEXT,
    status TEXT NOT NULL CHECK (status IN ('borrowed', 'returned', 'overdue')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create IoT Transaction Items Table
CREATE TABLE IF NOT EXISTS iot_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES iot_transactions(id) ON DELETE CASCADE,
    component_id UUID REFERENCES iot_components(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1
);

-- RLS Policies
ALTER TABLE iot_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_transaction_items ENABLE ROW LEVEL SECURITY;

-- Allow all users to read components
DROP POLICY IF EXISTS "Anyone can view components" ON iot_components;
CREATE POLICY "Anyone can view components" ON iot_components FOR SELECT USING (true);

-- Allow students to read and create their own transactions
DROP POLICY IF EXISTS "Students can view own transactions" ON iot_transactions;
CREATE POLICY "Students can view own transactions" ON iot_transactions FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can create own transactions" ON iot_transactions;
CREATE POLICY "Students can create own transactions" ON iot_transactions FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can view own transaction items" ON iot_transaction_items;
CREATE POLICY "Students can view own transaction items" ON iot_transaction_items FOR SELECT USING (
    transaction_id IN (SELECT id FROM iot_transactions WHERE student_id = auth.uid())
);

DROP POLICY IF EXISTS "Students can create own transaction items" ON iot_transaction_items;
CREATE POLICY "Students can create own transaction items" ON iot_transaction_items FOR INSERT WITH CHECK (
    transaction_id IN (SELECT id FROM iot_transactions WHERE student_id = auth.uid())
);

-- Allow admins full access
DROP POLICY IF EXISTS "Admins have full access to components" ON iot_components;
CREATE POLICY "Admins have full access to components" ON iot_components USING (EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND role_id IN (3, 5)));

DROP POLICY IF EXISTS "Admins have full access to transactions" ON iot_transactions;
CREATE POLICY "Admins have full access to transactions" ON iot_transactions USING (EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND role_id IN (3, 5)));

DROP POLICY IF EXISTS "Admins have full access to transaction items" ON iot_transaction_items;
CREATE POLICY "Admins have full access to transaction items" ON iot_transaction_items USING (EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND role_id IN (3, 5)));

-- Helper RPC to safely decrement available_quantity
CREATE OR REPLACE FUNCTION decrement_iot_quantity(comp_id UUID, qty INT) 
RETURNS VOID AS $$
BEGIN
  UPDATE iot_components 
  SET available_quantity = available_quantity - qty 
  WHERE id = comp_id AND available_quantity >= qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for component ID %', comp_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic RPC for IoT Checkout to prevent race conditions
CREATE OR REPLACE FUNCTION process_iot_checkout(
  p_student_id UUID,
  p_lab_id INT,
  p_session_time TEXT,
  p_project_title TEXT,
  p_cart JSONB
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_item JSONB;
BEGIN
  -- 1. Create Transaction
  INSERT INTO iot_transactions (student_id, lab_id, type, session_time, project_title, status)
  VALUES (p_student_id, p_lab_id, 'session', p_session_time, p_project_title, 'borrowed')
  RETURNING id INTO v_tx_id;

  -- 2. Process Cart Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart)
  LOOP
    -- Decrement stock (will throw exception and rollback if insufficient)
    PERFORM decrement_iot_quantity((v_item->>'id')::UUID, (v_item->>'quantity')::INT);

    -- Insert item
    INSERT INTO iot_transaction_items (transaction_id, component_id, quantity)
    VALUES (v_tx_id, (v_item->>'id')::UUID, (v_item->>'quantity')::INT);
  END LOOP;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End of IoT schema definition.
-- Inventory and Mock Data is omitted. It will be added through the Admin Portal UI.

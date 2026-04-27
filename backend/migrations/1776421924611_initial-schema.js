exports.up = (pgm) => {
  // Enables extensions for UUIDs, GIST index, and Cryptography
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.createExtension('btree_gist', { ifNotExists: true });
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  pgm.createTable('users', {
    user_id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    usn: { type: 'varchar(20)', unique: true, notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    email: { type: 'varchar(255)', notNull: true },
    role_id: { type: 'integer', notNull: true, default: 1 }, /* 1:Student, 2:Faculty, 3:LabAdmin, 4:HOD, 5:SuperAdmin */
    password_hash: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  pgm.createTable('components', {
    component_id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    name: { type: 'varchar(255)', notNull: true },
    department: { type: 'varchar(100)', notNull: true },
    lab_location: { type: 'varchar(255)', notNull: true },
    total_quantity: { type: 'integer', notNull: true },
    base_condition: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  pgm.createTable('reservations', {
    reservation_id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(user_id)', onDelete: 'CASCADE' },
    component_id: { type: 'uuid', notNull: true, references: 'components(component_id)', onDelete: 'CASCADE' },
    time_range: { type: 'tsrange', notNull: true },
    status: { type: 'varchar(50)', notNull: true, default: 'PENDING' },
    before_img_url: { type: 'varchar(1000)' },
    after_img_url: { type: 'varchar(1000)' },
    faculty_approver_id: { type: 'uuid', references: 'users(user_id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  // Exclusion Constraint to prevent double booking. Ignored if the reservation is REJECTED.
  pgm.sql(`
    ALTER TABLE reservations 
    ADD CONSTRAINT prevent_double_booking 
    EXCLUDE USING gist (component_id WITH =, time_range WITH &&)
    WHERE (status != 'REJECTED');
  `);

  // Immutable Audit Log Table
  pgm.createTable('audit_logs', {
    log_id: { type: 'serial', primaryKey: true },
    actor_id: { type: 'uuid', references: 'users(user_id)' },
    action_type: { type: 'varchar(50)', notNull: true },
    table_affected: { type: 'varchar(100)', notNull: true },
    payload: { type: 'jsonb' },
    prev_hash: { type: 'varchar(255)' },
    curr_hash: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  // PlpgSQL Trigger logic for calculating SHA-256 chain
  pgm.sql(`
    CREATE OR REPLACE FUNCTION audit_trigger_func()
    RETURNS TRIGGER AS $$
    DECLARE
      prev_h VARCHAR;
      new_h VARCHAR;
      payload_json JSONB;
      acting_user_id UUID;
    BEGIN
      -- Try pulling actor_id from context/JWT configs set on DB locally per transaction
      BEGIN
        acting_user_id := current_setting('app.current_user_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        acting_user_id := NULL;
      END;

      IF TG_OP = 'DELETE' THEN
        payload_json := row_to_json(OLD)::jsonb;
      ELSE
        payload_json := row_to_json(NEW)::jsonb;
      END IF;

      SELECT curr_hash INTO prev_h FROM audit_logs ORDER BY log_id DESC LIMIT 1;
      IF prev_h IS NULL THEN
        prev_h := 'GENESIS';
      END IF;

      new_h := encode(digest(payload_json::text || prev_h, 'sha256'), 'hex');

      INSERT INTO audit_logs (actor_id, action_type, table_affected, payload, prev_hash, curr_hash)
      VALUES (acting_user_id, TG_OP, TG_TABLE_NAME, payload_json, prev_h, new_h);

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`CREATE TRIGGER components_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON components FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();`);
  pgm.sql(`CREATE TRIGGER reservations_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON reservations FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TRIGGER IF EXISTS reservations_audit_trigger ON reservations;`);
  pgm.sql(`DROP TRIGGER IF EXISTS components_audit_trigger ON components;`);
  pgm.sql(`DROP FUNCTION IF EXISTS audit_trigger_func;`);
  pgm.dropTable('audit_logs');
  pgm.dropConstraint('reservations', 'prevent_double_booking');
  pgm.dropTable('reservations');
  pgm.dropTable('components');
  pgm.dropTable('users');
  pgm.dropExtension('pgcrypto');
  pgm.dropExtension('btree_gist');
  pgm.dropExtension('uuid-ossp');
};

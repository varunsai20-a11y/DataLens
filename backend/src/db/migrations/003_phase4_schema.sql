-- Migration 003: Phase 4 Users & Dataset Ownership Schema

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Insert System Demo Account for Safe Dataset Migration
-- Structurally valid bcrypt hash; login is explicitly blocked in authService logic.
INSERT INTO users (id, email, password_hash, name, role, is_system)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@datalens.internal',
    '$2a$12$R.S5K4p.q9HwH9Lw4lK4u.9a7g2h5j8k1l4m7n0p3q6r9s2t5u8v1',
    'System Demo Account',
    'USER',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- 3. Add user_id Column to datasets Table
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS user_id UUID;

-- 4. Migrate Existing Unowned Datasets to System Demo User (Zero Data Loss)
UPDATE datasets 
SET user_id = '00000000-0000-0000-0000-000000000001' 
WHERE user_id IS NULL;

-- 5. Enforce NOT NULL Constraint and Foreign Key with ON DELETE RESTRICT
ALTER TABLE datasets ALTER COLUMN user_id SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_datasets_user_id'
    ) THEN
        ALTER TABLE datasets 
        ADD CONSTRAINT fk_datasets_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 6. Indexes for Performance and Security Lookups
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

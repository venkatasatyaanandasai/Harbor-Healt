CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('patient', 'donor', 'volunteer')),
  volunteer_code text UNIQUE,
  referred_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'volunteer') = (volunteer_code IS NOT NULL))
);

CREATE TABLE donor_profiles (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  phone_ciphertext text NOT NULL,
  phone_iv text NOT NULL,
  phone_auth_tag text NOT NULL,
  blood_group text NOT NULL,
  country text NOT NULL,
  state text NOT NULL,
  district text NOT NULL,
  city text NOT NULL,
  available boolean NOT NULL DEFAULT true,
  consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX donor_profiles_matching_idx
  ON donor_profiles (available, blood_group, country, state, district);

CREATE TABLE blood_requests (
  id uuid PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  blood_group text NOT NULL,
  area text NOT NULL,
  units integer NOT NULL CHECK (units BETWEEN 1 AND 20),
  urgency text NOT NULL CHECK (urgency IN ('Routine', 'Urgent')),
  clinic text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX blood_requests_active_idx
  ON blood_requests (status, urgency, created_at DESC);

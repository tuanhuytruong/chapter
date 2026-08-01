-- Phase 4: provider-neutral static MB VietQR billing.
CREATE TABLE IF NOT EXISTS chapter.billing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  transfer_reference TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('vietqr_static')),
  sku TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('plus','deep_reader')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('month','year')),
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd > 0),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  status TEXT NOT NULL CHECK (status IN ('created','pending','paid','expired','rejected','canceled')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, request_key),
  UNIQUE(transfer_reference)
);
CREATE INDEX IF NOT EXISTS billing_orders_owner_history_idx ON chapter.billing_orders(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_orders_pending_expiry_idx ON chapter.billing_orders(status, expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS chapter.billing_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES chapter.billing_orders(id) ON DELETE CASCADE,
  confirmer_id UUID REFERENCES chapter.users(id) ON DELETE SET NULL,
  receipt_reference TEXT NOT NULL,
  received_amount_vnd INTEGER NOT NULL CHECK (received_amount_vnd > 0),
  received_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(receipt_reference)
);

CREATE TABLE IF NOT EXISTS chapter.billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES chapter.billing_orders(id) ON DELETE RESTRICT,
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd > 0),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  provider TEXT NOT NULL CHECK (provider IN ('vietqr_static')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_transactions_owner_history_idx ON chapter.billing_transactions(owner_id, created_at DESC);

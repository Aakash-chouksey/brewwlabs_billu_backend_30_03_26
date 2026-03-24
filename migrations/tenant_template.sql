-- Tenant DB Template DDL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  phone varchar(64),
  email varchar(255),
  password_hash varchar(512),
  profile_image_url text,
  role varchar(64) NOT NULL,
  outlet_ids jsonb DEFAULT '[]',
  token_version integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- outlets
CREATE TABLE IF NOT EXISTS outlets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  address text,
  contact_number varchar(64),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outlets_business ON outlets(business_id);
CREATE INDEX IF NOT EXISTS idx_outlets_created_at ON outlets(created_at);

-- products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  sku varchar(128),
  category_id uuid,
  price numeric(12,2) DEFAULT 0,
  tax numeric(8,2) DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  customer_details jsonb NOT NULL DEFAULT '{}',
  order_status varchar(32) DEFAULT 'CREATED',
  billing_subtotal numeric(12,2) DEFAULT 0,
  billing_tax numeric(12,2) DEFAULT 0,
  billing_discount numeric(12,2) DEFAULT 0,
  billing_total numeric(12,2) DEFAULT 0,
  payment_method varchar(64),
  payment_status varchar(32),
  idempotency_key varchar(255),
  waiter_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_created ON orders(outlet_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

-- order_items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid,
  qty integer DEFAULT 1,
  price numeric(12,2) DEFAULT 0,
  modifiers jsonb DEFAULT '[]',
  line_total numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_business ON order_items(business_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created ON order_items(created_at);

-- inventory
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  outlet_id uuid,
  product_id uuid,
  qty_on_hand numeric DEFAULT 0,
  reorder_point numeric DEFAULT 0,
  unit varchar(64),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_outlet ON inventory(product_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory(created_at);

-- settings
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  key varchar(255) NOT NULL,
  value jsonb DEFAULT '{}',
  scope varchar(64) DEFAULT 'global',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settings_business ON settings(business_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- royalty_ledger
CREATE TABLE IF NOT EXISTS royalty_ledger (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  order_id uuid NOT NULL,
  outlet_id uuid,
  royalty_percentage numeric(8,4) DEFAULT 0,
  royalty_amount numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_royalty_business ON royalty_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_royalty_order ON royalty_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_royalty_created ON royalty_ledger(created_at);

-- simple FK constraints (to be enforced at application level until tenant models are in place)
-- Add them if tenant migrations will create consistent GUIDs

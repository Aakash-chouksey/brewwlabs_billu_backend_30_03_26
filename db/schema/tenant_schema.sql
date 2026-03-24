--
-- PostgreSQL database dump
--


-- Dumped from database version 17.8 (a284a84)
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: tenant_template; Type: SCHEMA; Schema: -; Owner: -
--




--
-- Name: enum_StockTransactions_adjustment_type; Type: TYPE; Schema: -; Owner: -
--

CREATE TYPE "enum_StockTransactions_adjustment_type" AS ENUM (
    'ADD',
    'REMOVE'
);


--
-- Name: enum_StockTransactions_type; Type: TYPE; Schema: -; Owner: -
--

CREATE TYPE "enum_StockTransactions_type" AS ENUM (
    'PURCHASE',
    'SELF_CONSUME',
    'ADJUSTMENT',
    'SALE',
    'WASTAGE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: InventorySales; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE "InventorySales" (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity numeric(10,2) NOT NULL,
    sale_price numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    sale_date timestamp with time zone NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(255),
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: OperationTimings; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE "OperationTimings" (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    day character varying(255) NOT NULL,
    open_time time without time zone,
    close_time time without time zone,
    is_open boolean DEFAULT true,
    special_hours json,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: StockTransactions; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE "StockTransactions" (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    type "enum_StockTransactions_type" NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_cost numeric(10,2),
    total_cost numeric(10,2),
    previous_stock numeric(10,2),
    new_stock numeric(10,2),
    supplier_id uuid,
    recipe_id uuid,
    invoice_number character varying(255),
    reason text,
    adjustment_type "enum_StockTransactions_adjustment_type",
    transaction_date timestamp with time zone NOT NULL,
    recorded_by uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: Wastages; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE "Wastages" (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity numeric(10,2) NOT NULL,
    reason character varying(255) NOT NULL,
    wastage_date timestamp with time zone NOT NULL,
    notes text,
    recorded_by uuid,
    cost_value numeric(10,2),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE accounts (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255) DEFAULT 'Cash'::character varying,
    balance numeric(10,2) DEFAULT 0,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    status character varying(255) DEFAULT 'active'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: billing_configs; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE billing_configs (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    theme_color character varying(255) DEFAULT '#000000'::character varying,
    paper_size character varying(255) DEFAULT 'Thermal80mm'::character varying,
    footer_text character varying(255) DEFAULT 'Thank you for your business!'::character varying,
    lottery_mode boolean DEFAULT false,
    show_logo boolean DEFAULT true,
    show_tax boolean DEFAULT true,
    tax_rate numeric(5,4) DEFAULT 0.05,
    tax_inclusive boolean DEFAULT false,
    header_text character varying(255) DEFAULT ''::character varying,
    business_address text DEFAULT ''::text,
    business_phone character varying(255) DEFAULT ''::character varying,
    business_email character varying(255) DEFAULT ''::character varying,
    service_charge_rate numeric(5,4) DEFAULT 0,
    service_charge_inclusive boolean DEFAULT false,
    logo_url character varying(255) DEFAULT ''::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE categories (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    color character varying(255) DEFAULT '#3B82F6'::character varying,
    image character varying(255),
    is_enabled boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: customer_ledger; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE customer_ledger (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    customer_id uuid,
    transaction_id uuid,
    order_id uuid,
    entry_type character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text NOT NULL,
    balance_before numeric(10,2) NOT NULL,
    balance_after numeric(10,2) NOT NULL,
    entry_date timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: customer_transactions; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE customer_transactions (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    customer_id uuid,
    order_id uuid,
    transaction_type character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(255),
    description text,
    transaction_date timestamp with time zone NOT NULL,
    created_by uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE customers (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(255) NOT NULL,
    email character varying(255),
    address text,
    total_due numeric(10,2) DEFAULT 0,
    total_paid numeric(10,2) DEFAULT 0,
    last_visit_at timestamp with time zone,
    visit_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: expense_types; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE expense_types (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE expenses (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    expense_type_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    description character varying(255),
    date timestamp with time zone,
    payment_method character varying(255) DEFAULT 'Cash'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: feature_flags; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE feature_flags (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    is_enabled boolean DEFAULT false,
    rollout_percentage integer DEFAULT 0,
    target_users jsonb DEFAULT '[]'::jsonb,
    target_plan character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: incomes; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE incomes (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    source character varying(255) NOT NULL,
    description character varying(255),
    date timestamp with time zone,
    payment_method character varying(255) DEFAULT 'Cash'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: inventory_categories; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE inventory_categories (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: inventory_items; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE inventory_items (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    inventory_category_id uuid,
    unit character varying(255) DEFAULT 'piece'::character varying,
    sku character varying(255),
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    current_stock numeric(10,3) DEFAULT 0,
    minimum_stock numeric(10,3) DEFAULT 5,
    cost_per_unit numeric(10,2) DEFAULT 0,
    supplier_id uuid,
    supplier_name character varying(255),
    last_restocked_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE inventory_transactions (
    id uuid NOT NULL,
    inventory_item_id uuid,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    transaction_type character varying(255) NOT NULL,
    quantity numeric(10,3) NOT NULL,
    reference character varying(255),
    reason text,
    cost_per_unit numeric(10,2),
    total_cost numeric(10,2),
    supplier character varying(255),
    from_outlet_id uuid,
    to_outlet_id uuid,
    previous_stock numeric(10,3),
    new_stock numeric(10,3),
    created_by uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: membership_plans; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE membership_plans (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    duration_days integer NOT NULL,
    outlets_limit integer DEFAULT 1,
    staff_limit integer DEFAULT 5,
    max_products integer DEFAULT 100,
    max_invoices integer DEFAULT 1000,
    api_rate_limit integer DEFAULT 60,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE order_items (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    order_id uuid,
    product_id uuid,
    name character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price numeric(15,2) DEFAULT 0 NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE orders (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid,
    order_number character varying(50) NOT NULL,
    customer_details jsonb,
    table_id uuid,
    status character varying(50) DEFAULT 'CREATED'::character varying NOT NULL,
    billing_subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    billing_tax numeric(15,2) DEFAULT 0 NOT NULL,
    billing_discount numeric(15,2) DEFAULT 0 NOT NULL,
    billing_total numeric(15,2) DEFAULT 0 NOT NULL,
    payment_method character varying(50),
    payment_status character varying(50),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    customer_id uuid
);


--
-- Name: outlets; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE outlets (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    address text,
    manager_user_id uuid,
    parent_outlet_id uuid,
    is_head_office boolean DEFAULT false,
    email character varying(255),
    status character varying(255) DEFAULT 'active'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: partner_memberships; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE partner_memberships (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    status character varying(255) DEFAULT 'active'::character varying,
    payment_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: partner_types; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE partner_types (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    commission_percentage double precision DEFAULT '0'::double precision,
    description character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: partner_wallets; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE partner_wallets (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    balance numeric(10,2) DEFAULT 0,
    transactions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE payments (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid,
    payment_id character varying(255),
    order_id character varying(255),
    internal_order_id uuid,
    amount numeric(10,2),
    currency character varying(255),
    status character varying(255),
    method character varying(255),
    email character varying(255),
    contact character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: product_types; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE product_types (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    icon character varying(255) DEFAULT '🥬'::character varying,
    color character varying(255) DEFAULT '#10B981'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE products (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    category_id uuid,
    product_type_id uuid,
    name character varying(255) NOT NULL,
    price numeric(15,2) DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true,
    description text,
    image character varying(255),
    current_stock numeric(15,2) DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: purchase_items; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE purchase_items (
    id uuid NOT NULL,
    purchase_id uuid,
    product_id uuid,
    name character varying(255) NOT NULL,
    cost_price numeric(10,2) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit character varying(255),
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: purchases; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE purchases (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    supplier_id uuid,
    supplier_name character varying(255),
    total_amount numeric(10,2) NOT NULL,
    items jsonb DEFAULT '[]'::jsonb,
    date timestamp with time zone,
    status character varying(255) DEFAULT 'Completed'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: recipe_items; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE recipe_items (
    id uuid NOT NULL,
    recipe_id uuid,
    inventory_item_id uuid,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    quantity_required numeric(10,3) NOT NULL,
    unit character varying(255) NOT NULL,
    is_optional boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: recipes; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE recipes (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    instructions text,
    prep_time integer DEFAULT 0,
    is_active boolean DEFAULT true,
    version integer DEFAULT 1,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: roll_trackings; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE roll_trackings (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    roll_name character varying(255) DEFAULT 'Thermal Roll'::character varying,
    status character varying(255) DEFAULT 'active'::character varying,
    length double precision DEFAULT '50'::double precision,
    printed_length double precision DEFAULT '0'::double precision,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    replaced_by uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE settings (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    app_name character varying(255) DEFAULT 'BrewwLabs POS'::character varying,
    logo_url character varying(255),
    support_email character varying(255),
    support_phone character varying(255),
    terms_url character varying(255),
    privacy_url character varying(255),
    maintenance_mode boolean DEFAULT false,
    currency character varying(255) DEFAULT 'INR'::character varying,
    timezone character varying(255) DEFAULT 'Asia/Kolkata'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE subscriptions (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status character varying(255) DEFAULT 'active'::character varying,
    start_date timestamp with time zone,
    end_date timestamp with time zone NOT NULL,
    bill_count integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: suppliers; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE suppliers (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    contact_person character varying(255),
    email character varying(255),
    phone character varying(255),
    address text,
    gst_number character varying(255),
    payment_terms character varying(255),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: table_areas; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE table_areas (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid,
    name character varying(255) NOT NULL,
    description character varying(255),
    capacity integer DEFAULT 20,
    layout character varying(255) DEFAULT 'square'::character varying,
    status character varying(255) DEFAULT 'active'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: tables; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE tables (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid,
    name character varying(255) NOT NULL,
    table_no character varying(255),
    capacity integer DEFAULT 4,
    area_id uuid,
    status character varying(255) DEFAULT 'Available'::character varying,
    current_order_id uuid,
    shape character varying(255) DEFAULT 'square'::character varying,
    current_occupancy integer DEFAULT 0,
    qr_code character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: timings; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE timings (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    day character varying(255) NOT NULL,
    open_time character varying(255) NOT NULL,
    close_time character varying(255) NOT NULL,
    is_closed boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: transactions; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE transactions (
    id uuid NOT NULL,
    type character varying(255) NOT NULL,
    category character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    description character varying(255),
    account_id uuid NOT NULL,
    date timestamp with time zone,
    business_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    performed_by uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: web_contents; Type: TABLE; Schema: -; Owner: -
--

CREATE TABLE web_contents (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid,
    page character varying(255) NOT NULL,
    title character varying(255),
    content text,
    meta_description character varying(255),
    images jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: InventorySales InventorySales_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "InventorySales"
    ADD CONSTRAINT "InventorySales_pkey" PRIMARY KEY (id);


--
-- Name: OperationTimings OperationTimings_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "OperationTimings"
    ADD CONSTRAINT "OperationTimings_pkey" PRIMARY KEY (id);


--
-- Name: StockTransactions StockTransactions_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "StockTransactions"
    ADD CONSTRAINT "StockTransactions_pkey" PRIMARY KEY (id);


--
-- Name: Wastages Wastages_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "Wastages"
    ADD CONSTRAINT "Wastages_pkey" PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: billing_configs billing_configs_business_id_key; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE billing_configs
    ADD CONSTRAINT billing_configs_business_id_key UNIQUE (business_id);


--
-- Name: billing_configs billing_configs_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE billing_configs
    ADD CONSTRAINT billing_configs_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customer_ledger customer_ledger_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE customer_ledger
    ADD CONSTRAINT customer_ledger_pkey PRIMARY KEY (id);


--
-- Name: customer_transactions customer_transactions_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE customer_transactions
    ADD CONSTRAINT customer_transactions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: expense_types expense_types_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE expense_types
    ADD CONSTRAINT expense_types_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_name_key; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE feature_flags
    ADD CONSTRAINT feature_flags_name_key UNIQUE (name);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: incomes incomes_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE incomes
    ADD CONSTRAINT incomes_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: membership_plans membership_plans_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE membership_plans
    ADD CONSTRAINT membership_plans_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: outlets outlets_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE outlets
    ADD CONSTRAINT outlets_pkey PRIMARY KEY (id);


--
-- Name: partner_memberships partner_memberships_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE partner_memberships
    ADD CONSTRAINT partner_memberships_pkey PRIMARY KEY (id);


--
-- Name: partner_types partner_types_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE partner_types
    ADD CONSTRAINT partner_types_pkey PRIMARY KEY (id);


--
-- Name: partner_wallets partner_wallets_business_id_key; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE partner_wallets
    ADD CONSTRAINT partner_wallets_business_id_key UNIQUE (business_id);


--
-- Name: partner_wallets partner_wallets_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE partner_wallets
    ADD CONSTRAINT partner_wallets_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_types product_types_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE product_types
    ADD CONSTRAINT product_types_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: recipe_items recipe_items_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: roll_trackings roll_trackings_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE roll_trackings
    ADD CONSTRAINT roll_trackings_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: table_areas table_areas_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE table_areas
    ADD CONSTRAINT table_areas_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: timings timings_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE timings
    ADD CONSTRAINT timings_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: web_contents web_contents_pkey; Type: CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE web_contents
    ADD CONSTRAINT web_contents_pkey PRIMARY KEY (id);


--
-- Name: billing_configs_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX billing_configs_business_id ON billing_configs USING btree (business_id);


--
-- Name: categories_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX categories_business_id ON categories USING btree (business_id);


--
-- Name: customer_ledger_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_ledger_business_id ON customer_ledger USING btree (business_id);


--
-- Name: customer_ledger_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_ledger_business_id_outlet_id ON customer_ledger USING btree (business_id, outlet_id);


--
-- Name: customer_ledger_business_id_outlet_id_customer_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_ledger_business_id_outlet_id_customer_id ON customer_ledger USING btree (business_id, outlet_id, customer_id);


--
-- Name: customer_ledger_business_id_outlet_id_customer_id_entry_date; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_ledger_business_id_outlet_id_customer_id_entry_date ON customer_ledger USING btree (business_id, outlet_id, customer_id, entry_date);


--
-- Name: customer_ledger_business_id_outlet_id_transaction_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_ledger_business_id_outlet_id_transaction_id ON customer_ledger USING btree (business_id, outlet_id, transaction_id);


--
-- Name: customer_transactions_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_transactions_business_id ON customer_transactions USING btree (business_id);


--
-- Name: customer_transactions_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_transactions_business_id_outlet_id ON customer_transactions USING btree (business_id, outlet_id);


--
-- Name: customer_transactions_business_id_outlet_id_customer_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_transactions_business_id_outlet_id_customer_id ON customer_transactions USING btree (business_id, outlet_id, customer_id);


--
-- Name: customer_transactions_business_id_outlet_id_transaction_date; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_transactions_business_id_outlet_id_transaction_date ON customer_transactions USING btree (business_id, outlet_id, transaction_date);


--
-- Name: customer_transactions_business_id_outlet_id_transaction_type; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customer_transactions_business_id_outlet_id_transaction_type ON customer_transactions USING btree (business_id, outlet_id, transaction_type);


--
-- Name: customers_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customers_business_id ON customers USING btree (business_id);


--
-- Name: customers_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customers_business_id_outlet_id ON customers USING btree (business_id, outlet_id);


--
-- Name: customers_business_id_outlet_id_name; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX customers_business_id_outlet_id_name ON customers USING btree (business_id, outlet_id, name);


--
-- Name: customers_business_id_outlet_id_phone; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX customers_business_id_outlet_id_phone ON customers USING btree (business_id, outlet_id, phone);


--
-- Name: expense_types_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX expense_types_business_id ON expense_types USING btree (business_id);


--
-- Name: expense_types_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX expense_types_business_id_outlet_id ON expense_types USING btree (business_id, outlet_id);


--
-- Name: expense_types_business_id_outlet_id_name; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX expense_types_business_id_outlet_id_name ON expense_types USING btree (business_id, outlet_id, name);


--
-- Name: expenses_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX expenses_business_id ON expenses USING btree (business_id);


--
-- Name: expenses_business_id_date; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX expenses_business_id_date ON expenses USING btree (business_id, date);


--
-- Name: expenses_business_id_expense_type_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX expenses_business_id_expense_type_id ON expenses USING btree (business_id, expense_type_id);


--
-- Name: expenses_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX expenses_business_id_outlet_id ON expenses USING btree (business_id, outlet_id);


--
-- Name: inventory_categories_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_categories_business_id ON inventory_categories USING btree (business_id);


--
-- Name: inventory_categories_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_categories_business_id_outlet_id ON inventory_categories USING btree (business_id, outlet_id);


--
-- Name: inventory_categories_business_id_outlet_id_name; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX inventory_categories_business_id_outlet_id_name ON inventory_categories USING btree (business_id, outlet_id, name);


--
-- Name: inventory_items_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_items_business_id ON inventory_items USING btree (business_id);


--
-- Name: inventory_items_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_items_business_id_outlet_id ON inventory_items USING btree (business_id, outlet_id);


--
-- Name: inventory_items_business_id_outlet_id_inventory_category_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_items_business_id_outlet_id_inventory_category_id ON inventory_items USING btree (business_id, outlet_id, inventory_category_id);


--
-- Name: inventory_items_business_id_outlet_id_is_active; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_items_business_id_outlet_id_is_active ON inventory_items USING btree (business_id, outlet_id, is_active);


--
-- Name: inventory_items_business_id_outlet_id_name; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX inventory_items_business_id_outlet_id_name ON inventory_items USING btree (business_id, outlet_id, name);


--
-- Name: inventory_items_supplier_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_items_supplier_id ON inventory_items USING btree (supplier_id);


--
-- Name: inventory_transactions_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_transactions_business_id ON inventory_transactions USING btree (business_id);


--
-- Name: inventory_transactions_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_transactions_business_id_outlet_id ON inventory_transactions USING btree (business_id, outlet_id);


--
-- Name: inventory_transactions_business_id_outlet_id_created_at; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_transactions_business_id_outlet_id_created_at ON inventory_transactions USING btree (business_id, outlet_id, created_at);


--
-- Name: inventory_transactions_business_id_outlet_id_transaction_type; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_transactions_business_id_outlet_id_transaction_type ON inventory_transactions USING btree (business_id, outlet_id, transaction_type);


--
-- Name: inventory_transactions_inventory_item_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_transactions_inventory_item_id ON inventory_transactions USING btree (inventory_item_id);


--
-- Name: inventory_transactions_reference; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX inventory_transactions_reference ON inventory_transactions USING btree (reference);


--
-- Name: order_items_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX order_items_business_id ON order_items USING btree (business_id);


--
-- Name: order_items_order_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX order_items_order_id ON order_items USING btree (order_id);


--
-- Name: orders_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX orders_business_id ON orders USING btree (business_id);


--
-- Name: orders_business_id_outlet_id_created_at; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX orders_business_id_outlet_id_created_at ON orders USING btree (business_id, outlet_id, created_at);


--
-- Name: orders_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX orders_outlet_id ON orders USING btree (outlet_id);


--
-- Name: outlets_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX outlets_business_id ON outlets USING btree (business_id);


--
-- Name: outlets_parent_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX outlets_parent_outlet_id ON outlets USING btree (parent_outlet_id);


--
-- Name: partner_types_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX partner_types_business_id ON partner_types USING btree (business_id);


--
-- Name: partner_types_business_id_name; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX partner_types_business_id_name ON partner_types USING btree (business_id, name);


--
-- Name: payments_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX payments_business_id ON payments USING btree (business_id);


--
-- Name: payments_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX payments_business_id_outlet_id ON payments USING btree (business_id, outlet_id);


--
-- Name: product_types_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX product_types_business_id ON product_types USING btree (business_id);


--
-- Name: product_types_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX product_types_business_id_outlet_id ON product_types USING btree (business_id, outlet_id);


--
-- Name: products_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX products_business_id ON products USING btree (business_id);


--
-- Name: products_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX products_business_id_outlet_id ON products USING btree (business_id, outlet_id);


--
-- Name: products_business_outlet_name_unique; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX products_business_outlet_name_unique ON products USING btree (business_id, outlet_id, name);


--
-- Name: products_category_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX products_category_id ON products USING btree (category_id);


--
-- Name: purchase_items_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX purchase_items_business_id_outlet_id ON purchase_items USING btree (business_id, outlet_id);


--
-- Name: purchase_items_purchase_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX purchase_items_purchase_id ON purchase_items USING btree (purchase_id);


--
-- Name: purchases_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX purchases_business_id ON purchases USING btree (business_id);


--
-- Name: purchases_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX purchases_business_id_outlet_id ON purchases USING btree (business_id, outlet_id);


--
-- Name: recipe_items_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipe_items_business_id ON recipe_items USING btree (business_id);


--
-- Name: recipe_items_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipe_items_business_id_outlet_id ON recipe_items USING btree (business_id, outlet_id);


--
-- Name: recipe_items_business_id_outlet_id_recipe_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipe_items_business_id_outlet_id_recipe_id ON recipe_items USING btree (business_id, outlet_id, recipe_id);


--
-- Name: recipe_items_inventory_item_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipe_items_inventory_item_id ON recipe_items USING btree (inventory_item_id);


--
-- Name: recipe_items_recipe_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipe_items_recipe_id ON recipe_items USING btree (recipe_id);


--
-- Name: recipe_items_recipe_id_inventory_item_id; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX recipe_items_recipe_id_inventory_item_id ON recipe_items USING btree (recipe_id, inventory_item_id);


--
-- Name: recipes_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipes_business_id ON recipes USING btree (business_id);


--
-- Name: recipes_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipes_business_id_outlet_id ON recipes USING btree (business_id, outlet_id);


--
-- Name: recipes_business_id_outlet_id_is_active; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipes_business_id_outlet_id_is_active ON recipes USING btree (business_id, outlet_id, is_active);


--
-- Name: recipes_business_id_outlet_id_product_id; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX recipes_business_id_outlet_id_product_id ON recipes USING btree (business_id, outlet_id, product_id);


--
-- Name: recipes_product_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX recipes_product_id ON recipes USING btree (product_id);


--
-- Name: settings_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX settings_business_id ON settings USING btree (business_id);


--
-- Name: table_areas_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX table_areas_business_id ON table_areas USING btree (business_id);


--
-- Name: table_areas_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX table_areas_business_id_outlet_id ON table_areas USING btree (business_id, outlet_id);


--
-- Name: tables_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX tables_business_id ON tables USING btree (business_id);


--
-- Name: tables_business_id_created_at; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX tables_business_id_created_at ON tables USING btree (business_id, created_at);


--
-- Name: tables_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX tables_business_id_outlet_id ON tables USING btree (business_id, outlet_id);


--
-- Name: tables_business_id_outlet_id_name; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX tables_business_id_outlet_id_name ON tables USING btree (business_id, outlet_id, name);


--
-- Name: tables_business_id_outlet_id_status; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX tables_business_id_outlet_id_status ON tables USING btree (business_id, outlet_id, status);


--
-- Name: tables_business_id_outlet_id_table_no; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX tables_business_id_outlet_id_table_no ON tables USING btree (business_id, outlet_id, table_no);


--
-- Name: timings_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX timings_business_id ON timings USING btree (business_id);


--
-- Name: timings_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX timings_business_id_outlet_id ON timings USING btree (business_id, outlet_id);


--
-- Name: web_contents_business_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX web_contents_business_id ON web_contents USING btree (business_id);


--
-- Name: web_contents_business_id_outlet_id; Type: INDEX; Schema: -; Owner: -
--

CREATE INDEX web_contents_business_id_outlet_id ON web_contents USING btree (business_id, outlet_id);


--
-- Name: web_contents_business_id_page; Type: INDEX; Schema: -; Owner: -
--

CREATE UNIQUE INDEX web_contents_business_id_page ON web_contents USING btree (business_id, page);


--
-- Name: InventorySales InventorySales_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "InventorySales"
    ADD CONSTRAINT "InventorySales_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);


--
-- Name: StockTransactions StockTransactions_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "StockTransactions"
    ADD CONSTRAINT "StockTransactions_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);


--
-- Name: StockTransactions StockTransactions_recipe_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "StockTransactions"
    ADD CONSTRAINT "StockTransactions_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES recipes(id);


--
-- Name: StockTransactions StockTransactions_supplier_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "StockTransactions"
    ADD CONSTRAINT "StockTransactions_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id);


--
-- Name: Wastages Wastages_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE "Wastages"
    ADD CONSTRAINT "Wastages_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);


--
-- Name: customer_ledger customer_ledger_customer_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE customer_ledger
    ADD CONSTRAINT customer_ledger_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_transactions customer_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE customer_transactions
    ADD CONSTRAINT customer_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_inventory_category_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE inventory_items
    ADD CONSTRAINT inventory_items_inventory_category_id_fkey FOREIGN KEY (inventory_category_id) REFERENCES inventory_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE inventory_transactions
    ADD CONSTRAINT inventory_transactions_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_outlet_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE orders
    ADD CONSTRAINT orders_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES tables(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_product_type_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE products
    ADD CONSTRAINT products_product_type_id_fkey FOREIGN KEY (product_type_id) REFERENCES product_types(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_product_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchases purchases_supplier_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE purchases
    ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recipe_items recipe_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE recipe_items
    ADD CONSTRAINT recipe_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recipe_items recipe_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE recipe_items
    ADD CONSTRAINT recipe_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: table_areas table_areas_outlet_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE table_areas
    ADD CONSTRAINT table_areas_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tables tables_area_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE tables
    ADD CONSTRAINT tables_area_id_fkey FOREIGN KEY (area_id) REFERENCES table_areas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tables tables_outlet_id_fkey; Type: FK CONSTRAINT; Schema: -; Owner: -
--

ALTER TABLE tables
    ADD CONSTRAINT tables_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--



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
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: enum_tenant_registry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_tenant_registry_status AS ENUM (
    'active',
    'suspended',
    'onboarding',
    'deleted',
    'pending_approval',
    'pending'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    user_id uuid,
    brand_id uuid,
    user_email character varying(255),
    user_role character varying(50),
    action_type character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    action_description text,
    ip_address character varying(255),
    user_agent text,
    request_method character varying(10),
    request_path character varying(500),
    tenant_id uuid,
    severity_level character varying(255) DEFAULT 'LOW'::character varying,
    outcome character varying(255) DEFAULT 'SUCCESS'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    old_values jsonb,
    new_values jsonb,
    created_at timestamp with time zone
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(255),
    gst_number character varying(255),
    address text,
    type character varying(255) DEFAULT 'SOLO'::character varying NOT NULL,
    owner_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    status character varying(255) DEFAULT 'active'::character varying NOT NULL,
    subscription_plan character varying(255) DEFAULT 'free'::character varying,
    business_id uuid,
    settings json DEFAULT '{}'::json,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: system_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_metrics (
    id uuid NOT NULL,
    metric_name character varying(255) NOT NULL,
    metric_value jsonb NOT NULL,
    last_updated timestamp with time zone
);


--
-- Name: tenant_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_registry (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    schema_name character varying(255) NOT NULL,
    status public.enum_tenant_registry_status DEFAULT 'active'::public.enum_tenant_registry_status,
    created_at timestamp with time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    outlet_id uuid,
    outlet_ids jsonb DEFAULT '[]'::jsonb,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(255),
    password_hash text NOT NULL,
    role character varying(50) NOT NULL,
    is_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    last_login timestamp with time zone,
    panel_type character varying(20) DEFAULT 'TENANT'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    salary numeric(10,2),
    location character varying(255),
    experience integer,
    rating numeric(3,2) DEFAULT 0,
    total_orders integer DEFAULT 0,
    performance numeric(5,2) DEFAULT 0,
    token_version integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_email_key UNIQUE (email);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: system_metrics system_metrics_metric_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_metrics
    ADD CONSTRAINT system_metrics_metric_name_key UNIQUE (metric_name);


--
-- Name: system_metrics system_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_metrics
    ADD CONSTRAINT system_metrics_pkey PRIMARY KEY (id);


--
-- Name: tenant_registry tenant_registry_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_registry
    ADD CONSTRAINT tenant_registry_business_id_key UNIQUE (business_id);


--
-- Name: tenant_registry tenant_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_registry
    ADD CONSTRAINT tenant_registry_pkey PRIMARY KEY (id);


--
-- Name: tenant_registry tenant_registry_schema_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_registry
    ADD CONSTRAINT tenant_registry_schema_name_key UNIQUE (schema_name);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_action_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_type_idx ON public.audit_logs USING btree (action_type);


--
-- Name: audit_logs_brand_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_brand_id_idx ON public.audit_logs USING btree (brand_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);


--
-- Name: businesses_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX businesses_email ON public.businesses USING btree (email);


--
-- Name: businesses_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX businesses_owner_id ON public.businesses USING btree (owner_id);


--
-- Name: businesses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX businesses_status ON public.businesses USING btree (status);


--
-- Name: businesses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX businesses_type ON public.businesses USING btree (type);


--
-- Name: users_business_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_business_email_unique ON public.users USING btree (business_id, email);


--
-- Name: users_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_business_id ON public.users USING btree (business_id);


--
-- Name: users_business_id_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_business_id_role ON public.users USING btree (business_id, role);


--
-- Name: tenant_registry tenant_registry_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_registry
    ADD CONSTRAINT tenant_registry_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



--
-- PostgreSQL database dump
--

\restrict G3sFYNqczBMTdVqIBWDmcjQfRSbZg1GFGU7jQKP2DbGnD8piif8hfzlb5cJCezx

-- Dumped from database version 18.3 (Homebrew)
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_clients; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.api_clients (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    api_key character varying(255) NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.api_clients OWNER TO angeloimperiale;

--
-- Name: api_clients_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.api_clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_clients_id_seq OWNER TO angeloimperiale;

--
-- Name: api_clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.api_clients_id_seq OWNED BY public.api_clients.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    client_id integer,
    action character varying(100) NOT NULL,
    resource_type character varying(100),
    resource_id character varying(100),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO angeloimperiale;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO angeloimperiale;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.events (
    id integer NOT NULL,
    external_event_id character varying(100),
    name character varying(255) NOT NULL,
    venue character varying(255),
    city character varying(100),
    country character varying(100),
    event_date timestamp without time zone NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    visibility character varying(50) DEFAULT 'public'::character varying,
    notes text
);


ALTER TABLE public.events OWNER TO angeloimperiale;

--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.events_id_seq OWNER TO angeloimperiale;

--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    role_target character varying(50),
    type character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO angeloimperiale;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO angeloimperiale;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: partner_event_access; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.partner_event_access (
    id integer NOT NULL,
    user_id integer,
    event_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.partner_event_access OWNER TO angeloimperiale;

--
-- Name: partner_event_access_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.partner_event_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partner_event_access_id_seq OWNER TO angeloimperiale;

--
-- Name: partner_event_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.partner_event_access_id_seq OWNED BY public.partner_event_access.id;


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.pricing_rules (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    event_id integer,
    category character varying(255),
    partner_user_id integer,
    markup_type character varying(50) DEFAULT 'percentage'::character varying,
    markup_value numeric(10,2) DEFAULT 0 NOT NULL,
    min_price numeric(10,2),
    max_price numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pricing_rules OWNER TO angeloimperiale;

--
-- Name: pricing_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pricing_rules_id_seq OWNER TO angeloimperiale;

--
-- Name: pricing_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.pricing_rules_id_seq OWNED BY public.pricing_rules.id;


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.reservations (
    id integer NOT NULL,
    reservation_code character varying(100) NOT NULL,
    client_id integer,
    ticket_id integer,
    quantity integer NOT NULL,
    status character varying(50) DEFAULT 'reserved'::character varying,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    confirmed_at timestamp without time zone,
    user_id integer
);


ALTER TABLE public.reservations OWNER TO angeloimperiale;

--
-- Name: reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reservations_id_seq OWNER TO angeloimperiale;

--
-- Name: reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.reservations_id_seq OWNED BY public.reservations.id;


--
-- Name: ticket_requests; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.ticket_requests (
    id integer NOT NULL,
    user_id integer,
    ticket_id integer,
    quantity integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    approved_at timestamp without time zone,
    approved_by integer,
    rejected_at timestamp without time zone,
    rejected_by integer,
    rejection_reason text
);


ALTER TABLE public.ticket_requests OWNER TO angeloimperiale;

--
-- Name: ticket_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.ticket_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ticket_requests_id_seq OWNER TO angeloimperiale;

--
-- Name: ticket_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.ticket_requests_id_seq OWNED BY public.ticket_requests.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    event_id integer,
    supplier_ticket_id character varying(100),
    category character varying(100),
    block character varying(100),
    row_name character varying(100),
    seat_from character varying(50),
    seat_to character varying(50),
    quantity integer NOT NULL,
    available_quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'EUR'::character varying,
    status character varying(50) DEFAULT 'available'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    low_stock_threshold integer DEFAULT 2
);


ALTER TABLE public.tickets OWNER TO angeloimperiale;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO angeloimperiale;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: angeloimperiale
--

CREATE TABLE public.users (
    id integer NOT NULL,
    company_name character varying(255),
    contact_name character varying(255),
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'partner'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    approved_at timestamp without time zone,
    approved_by integer,
    email_verified boolean DEFAULT false,
    email_verification_token text,
    email_verification_expires timestamp without time zone
);


ALTER TABLE public.users OWNER TO angeloimperiale;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: angeloimperiale
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO angeloimperiale;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: angeloimperiale
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: api_clients id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.api_clients ALTER COLUMN id SET DEFAULT nextval('public.api_clients_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: partner_event_access id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.partner_event_access ALTER COLUMN id SET DEFAULT nextval('public.partner_event_access_id_seq'::regclass);


--
-- Name: pricing_rules id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.pricing_rules ALTER COLUMN id SET DEFAULT nextval('public.pricing_rules_id_seq'::regclass);


--
-- Name: reservations id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.reservations ALTER COLUMN id SET DEFAULT nextval('public.reservations_id_seq'::regclass);


--
-- Name: ticket_requests id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.ticket_requests ALTER COLUMN id SET DEFAULT nextval('public.ticket_requests_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: api_clients api_clients_api_key_key; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.api_clients
    ADD CONSTRAINT api_clients_api_key_key UNIQUE (api_key);


--
-- Name: api_clients api_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.api_clients
    ADD CONSTRAINT api_clients_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: partner_event_access partner_event_access_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.partner_event_access
    ADD CONSTRAINT partner_event_access_pkey PRIMARY KEY (id);


--
-- Name: partner_event_access partner_event_access_user_id_event_id_key; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.partner_event_access
    ADD CONSTRAINT partner_event_access_user_id_event_id_key UNIQUE (user_id, event_id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_reservation_code_key; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_reservation_code_key UNIQUE (reservation_code);


--
-- Name: ticket_requests ticket_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.api_clients(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: partner_event_access partner_event_access_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.partner_event_access
    ADD CONSTRAINT partner_event_access_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: partner_event_access partner_event_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.partner_event_access
    ADD CONSTRAINT partner_event_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: pricing_rules pricing_rules_partner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_partner_user_id_fkey FOREIGN KEY (partner_user_id) REFERENCES public.users(id);


--
-- Name: reservations reservations_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.api_clients(id);


--
-- Name: reservations reservations_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: reservations reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ticket_requests ticket_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: ticket_requests ticket_requests_rejected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id);


--
-- Name: ticket_requests ticket_requests_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: ticket_requests ticket_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: users users_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: angeloimperiale
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict G3sFYNqczBMTdVqIBWDmcjQfRSbZg1GFGU7jQKP2DbGnD8piif8hfzlb5cJCezx


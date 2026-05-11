DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS api_clients;

CREATE TABLE events (
id SERIAL PRIMARY KEY,
external_event_id VARCHAR(100),
name VARCHAR(255) NOT NULL,
venue VARCHAR(255),
city VARCHAR(100),
country VARCHAR(100),
event_date TIMESTAMP NOT NULL,
status VARCHAR(50) DEFAULT 'active',
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tickets (
id SERIAL PRIMARY KEY,
event_id INTEGER REFERENCES events(id),
supplier_ticket_id VARCHAR(100),
category VARCHAR(100),
block VARCHAR(100),
row_name VARCHAR(100),
seat_from VARCHAR(50),
seat_to VARCHAR(50),
quantity INTEGER NOT NULL,
available_quantity INTEGER NOT NULL,
price NUMERIC(10,2) NOT NULL,
currency VARCHAR(10) DEFAULT 'EUR',
status VARCHAR(50) DEFAULT 'available',
notes TEXT,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api_clients (
id SERIAL PRIMARY KEY,
name VARCHAR(255) NOT NULL,
api_key VARCHAR(255) UNIQUE NOT NULL,
active BOOLEAN DEFAULT true,
created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reservations (
id SERIAL PRIMARY KEY,
reservation_code VARCHAR(100) UNIQUE NOT NULL,
client_id INTEGER REFERENCES api_clients(id),
ticket_id INTEGER REFERENCES tickets(id),
quantity INTEGER NOT NULL,
status VARCHAR(50) DEFAULT 'reserved',
expires_at TIMESTAMP NOT NULL,
created_at TIMESTAMP DEFAULT NOW(),
confirmed_at TIMESTAMP
);

INSERT INTO api_clients (name, api_key)
VALUES ('Test Partner', 'test-api-key-123');

INSERT INTO events (
external_event_id,
name,
venue,
city,
country,
event_date
)
VALUES
(
'RM-BAR-2026',
'Real Madrid vs Barcelona',
'Santiago Bernabeu',
'Madrid',
'Spain',
'2026-10-12 20:00:00'
),
(
'MIL-INT-2026',
'Milan vs Inter',
'San Siro',
'Milano',
'Italy',
'2026-09-20 20:45:00'
);

INSERT INTO tickets (
event_id,
supplier_ticket_id,
category,
block,
row_name,
seat_from,
seat_to,
quantity,
available_quantity,
price,
currency
)
VALUES
(
1,
'TCK-001',
'Longside',
'105',
'12',
'1',
'4',
4,
4,
350.00,
'EUR'
),
(
1,
'TCK-002',
'Shortside',
'220',
'8',
'10',
'13',
4,
4,
180.00,
'EUR'
),
(
2,
'TCK-003',
'Tribuna Rossa',
'R1',
'5',
'20',
'21',
2,
2,
250.00,
'EUR'
);

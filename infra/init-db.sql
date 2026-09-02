-- Runs automatically on first container start.
-- Extensions must exist before any migration or hypertable creation.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS timescaledb;

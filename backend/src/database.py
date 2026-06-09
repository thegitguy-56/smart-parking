# backend/src/database.py

import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parent.parent / "parking.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # WAL mode: allows concurrent reads alongside writes (avoids "database is locked")
    conn.execute("PRAGMA journal_mode=WAL")
    # Wait up to 10 s for any lock before raising an error
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def init_db() -> None:
    """Create tables if they do not already exist."""
    conn = get_connection()
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS occupancy_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_id     TEXT    NOT NULL,
            status      TEXT    NOT NULL CHECK(status IN ('occupied', 'empty')),
            confidence  REAL    NOT NULL,
            logged_at   TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS predictions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_id         TEXT    NOT NULL,
            horizon_minutes INTEGER NOT NULL,
            vacancy_prob    REAL    NOT NULL,
            predicted_at    TEXT    NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_occupancy_slot
            ON occupancy_log(slot_id, logged_at);

        CREATE INDEX IF NOT EXISTS idx_predictions_slot
            ON predictions(slot_id, predicted_at);
    """)

    conn.commit()
    conn.close()


def log_occupancy(records: list[dict]) -> None:
    """
    Insert a batch of occupancy readings.

    Each record must have:
        slot_id    : str
        status     : 'occupied' | 'empty'
        confidence : float
    """
    now = datetime.now(timezone.utc).isoformat()
    rows = [(r["slot_id"], r["status"], r["confidence"], now) for r in records]

    conn = get_connection()
    conn.executemany(
        "INSERT INTO occupancy_log (slot_id, status, confidence, logged_at) "
        "VALUES (?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    conn.close()


def get_latest_occupancy() -> list[dict]:
    """
    Return the most recent status for every slot.
    Uses a subquery to pick the MAX logged_at per slot_id.
    """
    conn = get_connection()
    rows = conn.execute("""
        SELECT ol.slot_id, ol.status, ol.confidence, ol.logged_at
        FROM   occupancy_log ol
        INNER JOIN (
            SELECT slot_id, MAX(logged_at) AS max_ts
            FROM   occupancy_log
            GROUP  BY slot_id
        ) latest ON ol.slot_id = latest.slot_id
                 AND ol.logged_at = latest.max_ts
        ORDER BY ol.slot_id
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_full_history(limit: int = 500, offset: int = 0) -> list[dict]:
    """Return a paginated slice of occupancy_log, ordered by time."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT slot_id, status, confidence, logged_at "
        "FROM   occupancy_log "
        "ORDER  BY logged_at DESC "
        "LIMIT  ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_predictions(records: list[dict]) -> None:
    """
    Insert Prophet forecast results.

    Each record must have:
        slot_id         : str
        horizon_minutes : int
        vacancy_prob    : float
    """
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        (r["slot_id"], r["horizon_minutes"], r["vacancy_prob"], now)
        for r in records
    ]
    conn = get_connection()
    conn.executemany(
        "INSERT INTO predictions (slot_id, horizon_minutes, vacancy_prob, predicted_at) "
        "VALUES (?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    conn.close()


def get_latest_predictions(horizon_minutes: int) -> list[dict]:
    """Return the most recent forecast for each slot at the requested horizon."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT p.slot_id, p.vacancy_prob, p.predicted_at
        FROM   predictions p
        INNER JOIN (
            SELECT slot_id, MAX(predicted_at) AS max_ts
            FROM   predictions
            WHERE  horizon_minutes = ?
            GROUP  BY slot_id
        ) latest ON p.slot_id   = latest.slot_id
                 AND p.predicted_at = latest.max_ts
        WHERE p.horizon_minutes = ?
        ORDER BY p.slot_id
    """, (horizon_minutes, horizon_minutes)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_analytics_summary() -> dict:
    """
    Return aggregated analytics without sending raw rows.
    Computes:
      - total_readings: total rows in occupancy_log
      - avg_occupancy_pct: overall average occupancy percentage
      - peak_hour: 0-23 hour with highest average occupancy
      - busiest_slot: slot_id with most occupied readings
      - hourly_trend: list of {hour, occupied, empty} for last 48 buckets
    """
    conn = get_connection()

    # Total readings
    total = conn.execute("SELECT COUNT(*) AS cnt FROM occupancy_log").fetchone()["cnt"]

    # Average occupancy %
    avg_row = conn.execute("""
        SELECT ROUND(100.0 * SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END)
               / NULLIF(COUNT(*), 0), 1) AS avg_pct
        FROM occupancy_log
    """).fetchone()
    avg_pct = float(avg_row["avg_pct"]) if avg_row["avg_pct"] is not None else 0.0

    # Peak hour (0-23) — SQLite strftime extracts UTC hour
    peak_row = conn.execute("""
        SELECT CAST(strftime('%H', logged_at) AS INTEGER) AS hr,
               SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occ_count
        FROM   occupancy_log
        GROUP  BY hr
        ORDER  BY occ_count DESC
        LIMIT  1
    """).fetchone()
    peak_hour = int(peak_row["hr"]) if peak_row else 0

    # Busiest slot (most occupied readings)
    busy_row = conn.execute("""
        SELECT slot_id, COUNT(*) AS cnt
        FROM   occupancy_log
        WHERE  status = 'occupied'
        GROUP  BY slot_id
        ORDER  BY cnt DESC
        LIMIT  1
    """).fetchone()
    busiest_slot = busy_row["slot_id"] if busy_row else None

    # Hourly trend: last 48 distinct hours bucketed by strftime('%Y-%m-%dT%H:00', logged_at)
    trend_rows = conn.execute("""
        SELECT strftime('%Y-%m-%dT%H:00', logged_at) AS hour,
               SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
               SUM(CASE WHEN status = 'empty'    THEN 1 ELSE 0 END) AS empty
        FROM   occupancy_log
        GROUP  BY hour
        ORDER  BY hour DESC
        LIMIT  48
    """).fetchall()
    # Reverse so chronological order (oldest first)
    hourly_trend = list(reversed([dict(r) for r in trend_rows]))

    conn.close()

    return {
        "total_readings":   total,
        "avg_occupancy_pct": avg_pct,
        "peak_hour":         peak_hour,
        "busiest_slot":      busiest_slot,
        "hourly_trend":      hourly_trend,
    }
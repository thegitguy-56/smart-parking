# backend/src/database.py

import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parent.parent / "parking.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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


def get_full_history() -> list[dict]:
    """Return every row in occupancy_log, ordered by time."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT slot_id, status, confidence, logged_at "
        "FROM   occupancy_log "
        "ORDER  BY logged_at"
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
"""Orbital state: sun angle, eclipse, orbit phase.

Uses a real TLE for NORAD ID 25544 (ISS) fetched from CelesTrak and propagated
with skyfield/sgp4.  A disk cache provides an offline fallback so the service
keeps running when the network is unavailable.

Eclipse detection: cylindrical shadow model — the satellite is in eclipse when
its position projected perpendicular to the Earth-Sun line is less than one
Earth radius and it is on the anti-sun side of the Earth.

Sun angle: angle between the satellite's nadir-pointing +Z axis (sat→Earth
centre, reversed) and the sat→Sun vector.

Public API (unchanged):
    orbital_period_s(altitude_km) -> float
    propagate(start, hours, step_s, ...) -> list[dict]
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
import numpy as np
from skyfield.api import EarthSatellite, load

# ---------------------------------------------------------------------------
# Constants (kept for callers that import them directly)
# ---------------------------------------------------------------------------
EARTH_RADIUS_KM = 6371.0
MU = 398600.4418  # km^3/s^2

DEFAULT_ALTITUDE_KM = 420.0
ISS_NORAD_ID = 25544

# Both data files live next to this module so paths are cwd-independent
_CACHE_PATH    = Path(__file__).parent / f"tle_cache_{ISS_NORAD_ID}.json"
_EPHEMERIS_PATH = Path(__file__).parent / "de421.bsp"

# CelesTrak endpoints — JSON GP format is primary, plain-text TLE is fallback
_TLE_URL_JSON = (
    f"https://celestrak.org/satcat/tle.php?CATNR={ISS_NORAD_ID}&FORMAT=JSON"
)
_TLE_URL_TXT = (
    f"https://celestrak.org/SATCAT/tle.php?CATNR={ISS_NORAD_ID}&FORMAT=TLE"
)

# ---------------------------------------------------------------------------
# Skyfield timescale (module-level singleton — loading it is expensive)
# ---------------------------------------------------------------------------
_ts = load.timescale()


# ---------------------------------------------------------------------------
# TLE fetching and caching
# ---------------------------------------------------------------------------

def _fetch_tle_from_network() -> tuple[str, str, str]:
    """Return (name, line1, line2) from CelesTrak, or raise on failure."""
    # Primary: JSON GP endpoint
    try:
        r = httpx.get(_TLE_URL_JSON, timeout=10.0)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and data:
            entry = data[0]
            name = entry.get("OBJECT_NAME", "ISS (ZARYA)")
            line1 = entry.get("TLE_LINE1", "")
            line2 = entry.get("TLE_LINE2", "")
            if line1 and line2:
                return name, line1, line2
    except Exception:
        pass

    # Secondary: plain 3-line TLE text endpoint
    try:
        r = httpx.get(_TLE_URL_TXT, timeout=10.0)
        r.raise_for_status()
        lines = [ln.strip() for ln in r.text.strip().splitlines() if ln.strip()]
        if len(lines) >= 3:
            return lines[0], lines[1], lines[2]
        if len(lines) == 2:
            return "ISS (ZARYA)", lines[0], lines[1]
    except Exception:
        pass

    raise RuntimeError("Both CelesTrak endpoints failed (network unavailable).")


def _load_tle() -> tuple[str, str, str]:
    """Return (name, line1, line2), trying network first then disk cache."""
    try:
        name, line1, line2 = _fetch_tle_from_network()
        # Persist to disk (plain UTF-8, no BOM) so the fallback reader can parse it
        _CACHE_PATH.write_text(
            json.dumps({"name": name, "line1": line1, "line2": line2}),
            encoding="utf-8",
        )
        return name, line1, line2
    except Exception as net_err:
        if _CACHE_PATH.exists():
            try:
                # utf-8-sig tolerates an optional UTF-8 BOM written by some editors
                cached = json.loads(_CACHE_PATH.read_text(encoding="utf-8-sig"))
                return cached["name"], cached["line1"], cached["line2"]
            except Exception:
                pass
        raise RuntimeError(
            f"Could not fetch TLE from network ({net_err}) "
            "and no usable disk cache found."
        ) from net_err


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def orbital_period_s(altitude_km: float = DEFAULT_ALTITUDE_KM) -> float:
    """Keplerian period from altitude.

    Kept for callers that supply an explicit altitude and for backward
    compatibility.  When called with the default it returns the Keplerian
    period at ~420 km, which agrees with the real ISS period to <1 s.
    """
    a = EARTH_RADIUS_KM + altitude_km
    return 2 * math.pi * math.sqrt(a**3 / MU)


def _tle_period_s(satrec) -> float:
    """Return orbital period in seconds from a sgp4 satrec object.

    ``satrec.no_kozai`` is the mean motion in rad/min (after Kozai correction).
    """
    return 2 * math.pi / satrec.no_kozai * 60.0


def propagate(
    start: datetime,
    hours: float,
    step_s: int,
    norad_id: int = ISS_NORAD_ID,
    altitude_km: float = DEFAULT_ALTITUDE_KM,  # kept for signature compat
    beta_deg: float = 0.0,                      # kept for signature compat, unused
) -> list[dict]:
    """Return one orbital-state sample per step.

    Output keys (unchanged contract):
        t             – ISO 8601 UTC string
        sun_angle_deg – angle between sat +Z (nadir) and sat→Sun vector, degrees
        eclipse       – True while in Earth's cylindrical shadow
        orbit_phase   – 0..1, time-since-epoch mod period / period
    """
    if norad_id != ISS_NORAD_ID:
        raise ValueError(
            f"Unsupported norad_id {norad_id}: this build only supports the "
            f"ISS (NORAD {ISS_NORAD_ID})."
        )
    name, line1, line2 = _load_tle()
    satellite = EarthSatellite(line1, line2, name, _ts)
    period_s = _tle_period_s(satellite.model)

    n = int(hours * 3600 / step_s)

    t0_utc = (
        start.replace(tzinfo=timezone.utc)
        if start.tzinfo is None
        else start.astimezone(timezone.utc)
    )

    # Julian dates for the batch (Terrestrial Time; TT≈UTC for our purposes)
    J2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    jd0 = (t0_utc - J2000).total_seconds() / 86400.0 + 2451545.0
    offsets_days = np.arange(n, dtype=np.float64) * step_s / 86400.0
    times = _ts.tt_jd(jd0 + offsets_days)

    # Satellite GCRS positions (km), shape (n, 3)
    gcrs = satellite.at(times)
    pos_km = np.asarray(gcrs.position.km).T  # (n, 3)

    # Geocentric Sun direction in GCRS (Earth → Sun), shape (n, 3)
    planets: Any = load(str(_EPHEMERIS_PATH))
    earth: Any = planets["earth"]
    sun_astrometric = earth.at(times).observe(planets["sun"])
    sun_gcrs_km = np.asarray(sun_astrometric.position.km).T  # (n, 3)

    out = []
    for i in range(n):
        sat_pos = pos_km[i]       # GCRS, geocentric, km
        sun_vec = sun_gcrs_km[i]  # GCRS, geocentric (Earth → Sun), km

        # --- Eclipse: cylindrical shadow test ----------------------------
        # Project satellite position onto the Earth-Sun unit vector
        sun_hat = sun_vec / np.linalg.norm(sun_vec)
        proj = float(np.dot(sat_pos, sun_hat))        # + toward Sun, - away
        perp_sq = float(np.dot(sat_pos, sat_pos)) - proj * proj
        # Shadow: anti-sun side (proj < 0) AND within Earth's cylinder
        in_eclipse = proj < 0.0 and perp_sq < EARTH_RADIUS_KM**2

        # --- Sun angle (nadir +Z = Earth-centre direction from sat) ------
        z_hat = -sat_pos / np.linalg.norm(sat_pos)   # +Z points toward Earth
        sat_to_sun = sun_vec - sat_pos                # vector from sat to Sun
        sat_to_sun_hat = sat_to_sun / np.linalg.norm(sat_to_sun)
        cos_angle = float(np.clip(np.dot(z_hat, sat_to_sun_hat), -1.0, 1.0))
        sun_angle = math.degrees(math.acos(cos_angle))

        # --- Orbit phase (0..1, wraps every TLE period) ------------------
        elapsed_s = i * step_s
        phase = (elapsed_s % period_s) / period_s

        t_iso = (t0_utc + timedelta(seconds=elapsed_s)).isoformat()

        out.append({
            "t": t_iso,
            "sun_angle_deg": round(sun_angle, 2),
            "eclipse": bool(in_eclipse),
            "orbit_phase": round(phase, 4),
        })

    return out


# ---------------------------------------------------------------------------
# CLI smoke-test / validation
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    start_dt = datetime.now(timezone.utc)
    states = propagate(start_dt, hours=1.6, step_s=60)
    eclipses = [s for s in states if s["eclipse"]]
    period_min = orbital_period_s() / 60

    print(
        f"{len(states)} samples | "
        f"period {period_min:.1f} min | "
        f"eclipse samples: {len(eclipses)} "
        f"({100 * len(eclipses) / max(len(states), 1):.1f}% of window)"
    )

    # Eclipse entry/exit transitions
    transitions = [
        (states[i - 1]["t"], states[i]["t"], states[i]["eclipse"])
        for i in range(1, len(states))
        if states[i]["eclipse"] != states[i - 1]["eclipse"]
    ]
    if transitions:
        print("Eclipse transitions (first 8):")
        for _, cur_t, now_ecl in transitions[:8]:
            label = "ENTRY ->" if now_ecl else "EXIT  <-"
            print(f"  {label}  {cur_t}")
    else:
        print("No eclipse transitions in window (beta angle may be high today).")

    if states:
        lit_angles = [s["sun_angle_deg"] for s in states if not s["eclipse"]]
        if lit_angles:
            print(
                f"Sun angle (illuminated only): "
                f"min={min(lit_angles):.1f} deg  max={max(lit_angles):.1f} deg"
            )

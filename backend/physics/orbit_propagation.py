"""Orbital state: sun angle, eclipse, position.

STUB — this is a circular-orbit approximation with a fixed beta angle. It gives
the rest of the pipeline something contract-shaped to run against.

TODO (Abdul):
  * Load a real TLE from CelesTrak, cache it to disk as the offline fallback.
  * Propagate with sgp4/skyfield instead of the circular assumption below.
  * Compute the true sun vector and a cylindrical-shadow eclipse test.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

EARTH_RADIUS_KM = 6371.0
MU = 398600.4418  # km^3/s^2

DEFAULT_ALTITUDE_KM = 420.0   # ISS-like
DEFAULT_BETA_DEG = 25.0       # sun elevation above the orbital plane


def orbital_period_s(altitude_km: float = DEFAULT_ALTITUDE_KM) -> float:
    a = EARTH_RADIUS_KM + altitude_km
    return 2 * math.pi * math.sqrt(a ** 3 / MU)


def eclipse_fraction(altitude_km: float, beta_deg: float) -> float:
    """Fraction of the orbit spent in Earth's shadow, for a given beta angle."""
    h = altitude_km
    a = EARTH_RADIUS_KM + h
    denom = a * math.cos(math.radians(beta_deg))
    if abs(denom) < 1e-6:
        return 0.0
    ratio = math.sqrt(h ** 2 + 2 * EARTH_RADIUS_KM * h) / denom
    if ratio >= 1.0:
        return 0.0                      # beta high enough for full sun
    return math.acos(ratio) / math.pi


def propagate(start: datetime, hours: float, step_s: int,
              altitude_km: float = DEFAULT_ALTITUDE_KM,
              beta_deg: float = DEFAULT_BETA_DEG) -> list[dict]:
    """Return one orbital-state sample per step."""
    period = orbital_period_s(altitude_km)
    ecl_frac = eclipse_fraction(altitude_km, beta_deg)
    n = int(hours * 3600 / step_s)
    out = []

    for i in range(n):
        t = start + timedelta(seconds=i * step_s)
        phase = (i * step_s % period) / period          # 0..1 around the orbit
        # eclipse centred on phase 0.5 (anti-sun side)
        in_eclipse = abs(phase - 0.5) < ecl_frac / 2

        if in_eclipse:
            sun_angle = 180.0
        else:
            # angle between the sun vector and the spacecraft +Z face
            sun_angle = math.degrees(math.acos(
                max(-1.0, min(1.0, math.cos(2 * math.pi * phase) * math.cos(math.radians(beta_deg))))
            ))

        out.append({
            "t": t.replace(tzinfo=timezone.utc).isoformat(),
            "sun_angle_deg": round(sun_angle, 2),
            "eclipse": in_eclipse,
            "orbit_phase": round(phase, 4),
        })
    return out


if __name__ == "__main__":
    states = propagate(datetime.utcnow(), hours=1.6, step_s=60)
    print(f"{len(states)} samples, period {orbital_period_s()/60:.1f} min, "
          f"eclipse {eclipse_fraction(DEFAULT_ALTITUDE_KM, DEFAULT_BETA_DEG)*100:.1f}% of orbit")

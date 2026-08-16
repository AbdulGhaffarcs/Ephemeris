"""validate_eclipse.py -- Eclipse transition validator for ISS orbit propagation.

Calls propagate() for a user-supplied window and prints every eclipse entry/exit
transition with interpolated timestamps, the orbital period, and TLE age.  The
output is designed for manual cross-checking against Heavens-Above / N2YO ISS
pass predictions for the same date/time window.

Usage examples
--------------
# Next 3 hours from now (UTC), 10-second resolution:
    python scripts/validate_eclipse.py --hours 3 --step 10

# Specific window (ISO 8601, UTC assumed when no offset given):
    python scripts/validate_eclipse.py --start "2025-07-01T06:00:00" --hours 6

# Full day, coarser step for quick overview:
    python scripts/validate_eclipse.py --start "2025-07-01T00:00:00" --hours 24 --step 30

Notes on accuracy
-----------------
* Shadow model: CYLINDRICAL (not conical).  A conical umbra/penumbra model
  would shift transitions by ~10-30 s depending on beta angle.  If your
  measured error is consistently in the same direction (entry always early or
  always late) that is a model bias, not a TLE staleness issue.

* TLE staleness: Each day of TLE age adds ~1-5 minutes of position error for
  the ISS.  Errors >2 min that grow with time are almost certainly TLE age.

* Step size: transitions are linearly interpolated between the two bracketing
  samples so the residual quantisation error is at most step_s/2 seconds.

* Timezone: all output is UTC.  Heavens-Above shows local time by default --
  make sure you convert before comparing.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Make the backend package importable regardless of cwd.
# This file lives at  <project>/scripts/validate_eclipse.py
# The backend lives at <project>/backend/
# ---------------------------------------------------------------------------
_SCRIPTS_DIR = Path(__file__).resolve().parent          # .../scripts/
_BACKEND     = _SCRIPTS_DIR.parent / "backend"          # .../backend/

if not _BACKEND.is_dir():
    print(
        f"[ERROR] Could not locate backend directory at:\n  {_BACKEND}\n"
        "Run from the project root:  python scripts/validate_eclipse.py",
        file=sys.stderr,
    )
    sys.exit(1)

if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from physics.orbit_propagation import (   # noqa: E402
    propagate,
    _load_tle,
    _ts,
    EarthSatellite,
    _tle_period_s,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_start(raw: str | None) -> datetime:
    """Parse an ISO 8601 string to an aware UTC datetime.

    If raw is None, returns datetime.now(UTC).
    Naive strings (no offset) are assumed UTC.
    """
    if raw is None:
        return datetime.now(timezone.utc)
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    # fromisoformat handles zone offsets (Python >= 3.7)
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _interp_ts(t_before: str, step_s: int) -> str:
    """Return the midpoint of the step interval as a UTC ISO string.

    Because the shadow model produces a boolean per sample, the best estimate
    of the real transition is the midpoint of the two bracketing samples.
    """
    t0 = datetime.fromisoformat(t_before)
    if t0.tzinfo is None:
        t0 = t0.replace(tzinfo=timezone.utc)
    mid = t0 + timedelta(seconds=step_s / 2.0)
    return mid.isoformat(timespec="seconds").replace("+00:00", "Z")


def _tle_epoch_utc(line1: str) -> datetime:
    """Parse the epoch from TLE line 1 (columns 19-32, YYDDD.dddddddd)."""
    epoch_str = line1[18:32].strip()
    year2     = int(epoch_str[:2])
    day_frac  = float(epoch_str[2:])
    year      = 2000 + year2 if year2 < 57 else 1900 + year2
    return datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_frac - 1)


def _fmt(dt_iso: str) -> str:
    """Normalise an ISO string to a clean UTC display with Z suffix."""
    return dt_iso.replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Print ISS eclipse entry/exit transitions for a given window.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--start",
        metavar="ISO8601",
        default=None,
        help=(
            "Window start in UTC, e.g. '2025-07-01T06:00:00'.  "
            "Defaults to now (UTC)."
        ),
    )
    parser.add_argument(
        "--hours",
        type=float,
        default=3.0,
        help="Window length in hours (default: 3.0).",
    )
    parser.add_argument(
        "--step",
        type=int,
        default=10,
        metavar="SECONDS",
        help=(
            "Propagation step size in seconds (default: 10).  "
            "Smaller = more precise interpolation, but slower."
        ),
    )
    args = parser.parse_args()

    start_dt = _parse_start(args.start)

    # -----------------------------------------------------------------------
    # Load TLE explicitly so we can display epoch/age before propagate()
    # -----------------------------------------------------------------------
    try:
        name, line1, line2 = _load_tle()
    except RuntimeError as exc:
        print(f"[ERROR] Could not load TLE: {exc}", file=sys.stderr)
        sys.exit(1)

    tle_epoch  = _tle_epoch_utc(line1)
    tle_age_h  = (start_dt - tle_epoch).total_seconds() / 3600.0

    satellite  = EarthSatellite(line1, line2, name, _ts)
    period_s   = _tle_period_s(satellite.model)
    period_min = period_s / 60.0

    # -----------------------------------------------------------------------
    # Header
    # -----------------------------------------------------------------------
    SEP = "-" * 70
    print(SEP)
    print("  ISS Eclipse Transition Validator")
    print(SEP)
    print(f"  Window start  : {_fmt(start_dt.isoformat(timespec='seconds'))} UTC")
    print(f"  Window length : {args.hours:.2f} h  ({args.hours * 60:.0f} min)")
    print(f"  Step size     : {args.step} s  "
          f"(interpolation residual <= {args.step // 2} s)")
    print(f"  TLE name      : {name}")
    print(f"  TLE epoch     : {_fmt(tle_epoch.isoformat(timespec='seconds'))} UTC")
    print(f"  TLE age       : {tle_age_h:.1f} h  ({tle_age_h / 24:.1f} days)")
    if tle_age_h > 48:
        print(f"  *** WARNING: TLE is {tle_age_h / 24:.1f} days old -- "
              "position errors may reach several minutes ***")
    print(f"  Shadow model  : cylindrical (no penumbra/umbra split)")
    print(f"                  expect ~10-30 s systematic bias vs conical model")
    print(f"  Orbital period: {period_min:.4f} min  ({period_s:.2f} s)")
    print(SEP)
    print()

    # -----------------------------------------------------------------------
    # Propagate
    # -----------------------------------------------------------------------
    print("  Propagating...", end="", flush=True)
    states = propagate(start_dt, hours=args.hours, step_s=args.step)
    print(f" done ({len(states)} samples).\n")

    # -----------------------------------------------------------------------
    # Detect transitions; interpolate midpoint timestamp for each
    # -----------------------------------------------------------------------
    transitions: list[tuple[str, bool, str, str]] = []
    for i in range(1, len(states)):
        prev, curr = states[i - 1], states[i]
        if curr["eclipse"] != prev["eclipse"]:
            interp_t = _interp_ts(prev["t"], args.step)
            transitions.append(
                (interp_t, bool(curr["eclipse"]), prev["t"], curr["t"])
            )

    # -----------------------------------------------------------------------
    # Transitions table
    # -----------------------------------------------------------------------
    print(SEP)
    print("  ECLIPSE TRANSITIONS")
    print(SEP)

    if not transitions:
        print("  (none -- beta angle may be high; satellite in continuous sunlight)")
    else:
        n_entry = sum(1 for _, entering, *_ in transitions if entering)
        n_exit  = len(transitions) - n_entry
        print(f"  {len(transitions)} transition(s): {n_entry} "
              f"entr{'y' if n_entry == 1 else 'ies'}, {n_exit} exit(s)\n")

        hdr_interp = f"Interpolated UTC  (+-{args.step // 2}s)"
        print(f"  {'#':>3}  {'Type':<12}  {hdr_interp:<32}  Bracketing sample timestamps")
        print(f"  {'':-<3}  {'':-<12}  {'':-<32}  {'':-<44}")

        for idx, (interp_t, entering, t_before, t_after) in enumerate(transitions, 1):
            label = "ENTRY ->" if entering else "EXIT  <-"
            print(
                f"  {idx:>3}  {label:<12}  {interp_t:<32}  "
                f"[{_fmt(t_before)} ... {_fmt(t_after)}]"
            )

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    ecl_samples = sum(1 for s in states if s["eclipse"])
    lit_samples = len(states) - ecl_samples
    pct_ecl     = 100.0 * ecl_samples / max(len(states), 1)
    lit_angles  = [s["sun_angle_deg"] for s in states if not s["eclipse"]]

    print()
    print(SEP)
    print("  SUMMARY")
    print(SEP)
    print(f"  Total samples  : {len(states)}")
    print(f"  In eclipse     : {ecl_samples} ({pct_ecl:.1f}%)")
    print(f"  Illuminated    : {lit_samples} ({100.0 - pct_ecl:.1f}%)")
    if lit_angles:
        mean_angle = sum(lit_angles) / len(lit_angles)
        print(f"  Sun angle (illuminated):  "
              f"min={min(lit_angles):.1f} deg  "
              f"max={max(lit_angles):.1f} deg  "
              f"mean={mean_angle:.1f} deg")
    print()
    print("  Cross-check checklist:")
    print("  [ ] Convert Heavens-Above/N2YO times from local to UTC before comparing")
    print("  [ ] Compare ENTRY timestamps -- consistent early/late -> model bias")
    print("  [ ] Compare EXIT  timestamps -- growing error over time -> TLE staleness")
    print("  [ ] If all transitions off by same constant: check UTC vs TT offset bug")
    print(SEP)


if __name__ == "__main__":
    main()
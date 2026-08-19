import sys
sys.path.insert(0, ".")
import math, random
from datetime import datetime, timezone
from physics.orbit_propagation import propagate
from physics.thermal_model import predict, T_HOT_C, T_COLD_C, equilibrium_c
from physics.telemetry_sim import simulate, TAU_S, NOISE_SIGMA_C, ALBEDO_GAIN_C
from physics.detector import score

t0 = datetime.fromisoformat("2026-08-15T18:00:00Z").replace(tzinfo=timezone.utc)
states = propagate(t0, 3.0, 60, norad_id=25544)
n = len(states)
print("states:", n)

boundaries = []
prev_phase = states[0]["orbit_phase"]
for i, s in enumerate(states):
    ph = s["orbit_phase"]
    if prev_phase >= 0.9 and ph < 0.1:
        boundaries.append(i)
    prev_phase = ph
print("Orbit boundaries:", boundaries)

def _old_eq(sun_angle_deg, eclipse, orbit_phase):
    base = T_COLD_C if eclipse else T_COLD_C + (T_HOT_C - T_COLD_C) * max(0.0, math.cos(math.radians(sun_angle_deg)))
    return base + ALBEDO_GAIN_C * (0.35 + 0.65 * math.cos(2 * math.pi * orbit_phase) ** 2)

rng = random.Random(7)
alpha = 60 / TAU_S
t0_c = equilibrium_c(states[0]["sun_angle_deg"], states[0]["eclipse"])
old_obs, t_c = [], t0_c
for s in states:
    t_eq = _old_eq(s["sun_angle_deg"], s["eclipse"], s["orbit_phase"])
    t_c += alpha * (t_eq - t_c)
    old_obs.append(round(t_c + rng.gauss(0, NOISE_SIGMA_C), 3))

pred = predict(states, 60)
old_res = [round(o - p, 3) for p, o in zip(pred, old_obs)]
print("BEFORE: min=%s  max=%s  mean=%s" % (min(old_res), max(old_res), round(sum(old_res)/len(old_res), 4)))
cuts = [0] + boundaries + [n]
for k in range(len(cuts) - 1):
    seg = old_res[cuts[k]:cuts[k+1]]
    print("  orbit %d (i %d-%d): mean=%s" % (k+1, cuts[k], cuts[k+1]-1, round(sum(seg)/len(seg), 4)))

print("\nAFTER:")
for scenario in ("nominal", "spike", "drift", "fault"):
    obs = simulate(states, 60, scenario)
    sc  = score(pred, obs)
    res = [d["residual"] for d in sc]
    flags = sum(1 for d in sc if d["flagged"])
    print("  %-8s  flags=%3d  min=%s  max=%s" % (scenario, flags, min(res), max(res)))
    if scenario == "nominal":
        if flags > 0:
            print("  !! NOMINAL FLAGS:")
            for i, d in enumerate(sc):
                if d["flagged"]:
                    print("     i=%d  r=%s  z=%s  cusum=%s" % (i, d["residual"], d["zscore"], d["cusum"]))
        for k in range(len(cuts) - 1):
            seg = res[cuts[k]:cuts[k+1]]
            print("    orbit %d: mean=%s  min=%s  max=%s" % (k+1, round(sum(seg)/len(seg), 4), min(seg), max(seg)))

a = simulate(states, 60, "nominal", seed=7)
b = simulate(states, 60, "nominal", seed=7)
c = simulate(states, 60, "nominal", seed=42)
print("\nDeterminism same_seed=%s  diff_seed_differs=%s" % (a == b, a != c))

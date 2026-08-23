import math

# The exact constants from apps/mobile/src/motion/motion.ts
SPRINGS = {
    'press':    dict(damping=22, stiffness=420, mass=0.55),
    'standard': dict(damping=18, stiffness=220, mass=0.9),
    'sheet':    dict(damping=26, stiffness=240, mass=1.1),
    'bouncy':   dict(damping=11, stiffness=260, mass=0.8),
}

def displacement(t, damping, stiffness, mass):
    """x(t) for a spring released from x=1 with zero velocity."""
    w0 = math.sqrt(stiffness / mass)
    zeta = damping / (2 * math.sqrt(stiffness * mass))
    if zeta < 1:                                   # underdamped — overshoots
        wd = w0 * math.sqrt(1 - zeta * zeta)
        return math.exp(-zeta * w0 * t) * (math.cos(wd * t) + (zeta * w0 / wd) * math.sin(wd * t))
    if abs(zeta - 1) < 1e-9:                       # critically damped
        return math.exp(-w0 * t) * (1 + w0 * t)
    a = w0 * math.sqrt(zeta * zeta - 1)            # overdamped
    c1 = (zeta * w0 + a) / (2 * a)
    c2 = -(zeta * w0 - a) / (2 * a)
    return math.exp(-zeta * w0 * t) * (c1 * math.exp(-a * t) + c2 * math.exp(a * t))

def settle_ms(damping, stiffness, mass, tol=0.001):
    """First time the spring is within tol of rest and stays there."""
    t, step = 0.0, 0.001
    last = 0.0
    while t < 10:
        if abs(displacement(t, damping, stiffness, mass)) < tol:
            last = last or t
            if t - last > 0.05:
                return last
        else:
            last = 0.0
        t += step
    return 1.0

print("/*")
print(" * Spring easings, generated from the MOBILE APP's own constants.")
print(" * Source: apps/mobile/src/motion/motion.ts — do not edit by hand.")
print(" * Regenerate: python3 scratchpad/spring2css.py")
print(" */")
for name, cfg in SPRINGS.items():
    duration = settle_ms(**cfg)
    steps = 24 if name != 'press' else 16
    points = []
    for i in range(steps + 1):
        t = duration * i / steps
        p = 1 - displacement(t, **cfg)
        points.append(f"{p:.4f}".rstrip('0').rstrip('.'))
    w0 = math.sqrt(cfg['stiffness'] / cfg['mass'])
    zeta = cfg['damping'] / (2 * math.sqrt(cfg['stiffness'] * cfg['mass']))
    overshoot = max(0.0, max(1 - displacement(duration * i / 400, **cfg) for i in range(401)) - 1)
    print(f"\n  /* {name}: zeta={zeta:.2f} ({'underdamped' if zeta<1 else 'over/critical'}), "
          f"overshoot {overshoot*100:.1f}% */")
    print(f"  --dur-{name}: {round(duration*1000)}ms;")
    print(f"  --ease-{name}: linear({', '.join(points)});")

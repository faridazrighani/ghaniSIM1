# SNK Boundary NPSH Audit

## Scope

SNK is treated as the downstream Fluid Out Boundary. It is not a pressure-loss element. Discharge restriction must come from modeled piping, fittings, valves, equipment pressure drops, and elevation changes between the pump discharge and the SNK.

## Boundary Modes

### Free Outlet / Atmospheric Discharge

- Independent input: SNK outlet elevation.
- Pressure condition: `Pout = 0 bar g = 1.01325 bar a`.
- Solver role: flow is solved from pump curve and system curve intersection.
- Pump/NPSH effect: low downstream pressure can increase operating flow; higher flow may increase suction loss and NPSHR, reducing NPSH margin.

### Outlet Pressure Boundary

- Independent inputs: outlet/reference pressure, pressure input basis, pipe pressure type, and outlet elevation.
- Pressure conversion: `Pabs = Pinput + Patm` for gauge input, and `Pabs = Pinput` for absolute input.
- Pressure head: `Hp = Pabs x 100000 / (rho x g)`.
- Boundary head: `HSNK = Hp + zSNK + Hvel` for static pressure, or `HSNK = Hp + zSNK` for stagnation pressure.
- Solver role: pump operating flow is solved against the downstream boundary head and discharge losses.

### Flow Demand Boundary

- Independent input: discharge flow demand.
- Reference pressure is advisory/readout context, not the independent downstream pressure condition.
- Solver role: pump is evaluated at the demanded flow; required outlet pressure/head is reported as a consequence of pump head, suction boundary, and discharge losses.
- Pump/NPSH effect: imposed flow directly changes NPSHR and suction-side losses, therefore NPSH margin can change.

## Dependency Chain

1. Active Fluid Basis provides density and vapor pressure.
2. SRC and suction path determine suction boundary head and suction losses.
3. SNK mode determines whether downstream pressure is atmospheric, specified, or flow-imposed.
4. Discharge path components determine discharge losses.
5. Pump curve and system curve determine operating point, unless flow demand imposes flow.
6. Operating flow determines velocity, Reynolds number, head losses, NPSHR, and pump power.
7. NPSHA is checked at pump suction, but SNK affects it indirectly through operating flow and suction losses.

## Literature Basis

- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`: Bernoulli equation, pressure head, velocity head, elevation head, and head-loss principles.
- `pdf_ref/ref2-introduction-fluid-mechanics.pdf`: steady incompressible energy equation and pressure boundary interpretation.
- `pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf`: cavitation and centrifugal pump suction context.
- `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf`: NPSHA, NPSHR, and NPSH margin guidance.
- NIST Guide to the SI: standard atmosphere is 101325 Pa exactly.
- NASA Glenn Bernoulli reference: static pressure plus dynamic pressure forms total/stagnation pressure.


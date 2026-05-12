# Heat Exchanger NPSH Calculation Trace Audit

## Summary

This audit covers the Heat Exchanger object as used by the pump hydraulic and NPSH model. The current object is a simplified process/hydraulic equipment item with:

- user-entered heat duty
- user-entered pressure drop
- user-entered outlet temperature
- active Fluid Basis density, specific heat, vapor pressure, and temperature

The Heat Exchanger is not a pump, source boundary, or pipe. When it is connected by solid hydraulic piping, its pressure drop is treated as equipment head loss. If it lies upstream of a pump suction, that head loss reduces NPSHA. If it lies on the pump discharge side, it affects discharge/system head but does not directly subtract from pump suction NPSHA.

## References Used

### Local repository references

| Reference | Audit use |
|---|---|
| `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf` | Pressure head, Bernoulli/energy balance, density, specific heat, and head-loss fundamentals. |
| `pdf_ref/ref2-introduction-fluid-mechanics.pdf` | Steady-flow energy balance and pressure/elevation head interpretation. |
| `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf` | NPSHA definition, vapor pressure head, suction loss, and pump datum context. |

### External trusted references

| Reference | Audit use |
|---|---|
| NIST Guide to the SI Appendix B.8 | Confirms `1 bar = 100000 Pa`, `1 atm = 101325 Pa`, and standard gravity `9.80665 m/s2`; the application currently keeps `g = 9.81 m/s2` for consistency with the existing hydraulic model. |
| NIST thermophysical properties publication / NIST Chemistry WebBook SRD 69 | Confirms thermophysical properties such as density, heat capacity, viscosity, and vapor pressure are standard Fluid Basis inputs for supported fluids. |
| NASA Glenn Bernoulli's Equation | Confirms pressure and velocity terms as energy/pressure terms in steady incompressible flow, with stated assumptions. |

## Formula Audit

| Calculation | Formula | Units | Status |
|---|---|---:|---|
| Pressure drop sanitization | `dP_loss = max(dP_input, 0)` | bar | Formula verified |
| Pressure drop head | `hL = dP(bar) * 100000 / (rho * g)` | m | Formula verified |
| Temperature change | `deltaT = Tout - Tin` | deg C interval | Formula verified |
| Mass flow | `m_dot(kg/h) = Q(m3/h) * rho(kg/m3)` | kg/h | Formula verified |
| Sensible heat duty | `Qdot(kW) = (m_dot / 3600) * Cp(kJ/kg.K) * deltaT(K)` | kW | Formula verified |
| Duty residual | `Residual = Duty input - calculated duty` | kW | Formula verified |
| NPSH contribution | `NPSHA effect = -hL_HX` only when HX is in pump suction path | m | Formula verified |

Temperature intervals in deg C and K have the same magnitude, so `Tout - Tin` can be used directly in the sensible heat equation when Cp is in `kJ/kg.K`.

## NPSH Relevance

- Heat Exchanger pressure drop is not a vapor pressure term; it is a suction path loss only when the exchanger is physically upstream of the pump suction through solid hydraulic connections.
- The pump NPSHA calculation uses active Fluid Basis vapor pressure. The Heat Exchanger outlet temperature does not automatically change vapor pressure for NPSH. The user must update Fluid Basis or SRC temperature mode when suction temperature changes before the pump.
- The current Heat Exchanger model does not calculate local two-phase flashing, fouling growth, UA, LMTD, NTU, tube-side/shell-side split losses, or mechanical exchanger rating.

## UI and Realtime Trace Changes

- Added a Heat Exchanger readout section in the Object Task Window.
- Added `Calculation Trace / Step-by-step Report`.
- Added `Dependency Chain`.
- Added `NPSH Role` section showing whether the exchanger is detected on a pump suction or discharge path.
- Added realtime readouts for pressure-drop head, solved flow, mass flow, calculated duty, duty residual, density, Cp, vapor pressure, and NPSH loss contribution.
- Unit Standard changes now refresh Heat Exchanger readouts and trace bodies through the same quantity registry used by instruments, SRC, Vessel H, and Vessel V.

## Unit Conversion Audit

Internal units remain unchanged:

- Duty: kW
- Pressure drop: bar
- Head/elevation: m
- Temperature: deg C
- Flow: m3/h
- Mass flow: kg/h
- Density: kg/m3
- Specific heat: kJ/kg.K
- Vapor pressure: bar a

Display units follow the selected Unit Standard:

- Metric / European Engineering: kW, bar, m, deg C, m3/h, kg/h
- SI / International: kW, kPa, m, deg C, m3/s, kg/s, J/kg.K
- US Customary: hp, psi, ft, deg F, gpm, lb/h, Btu/lb.F

## Numerical Audit Case

Default audit basis:

- Fluid: Water at 25 deg C
- Density: `997.047 kg/m3`
- Specific heat: `4.181 kJ/kg.K`
- Pressure drop: `0.1 bar`
- Solved flow: `120 m3/h`
- Outlet temperature: `60 deg C`

Expected results:

| Result | Calculation | Expected |
|---|---|---:|
| Pressure-drop head | `0.1 * 100000 / (997.047 * 9.81)` | `1.023 m` |
| Mass flow | `120 * 997.047` | `119645.640 kg/h` |
| Delta T | `60 - 25` | `35 deg C` |
| Calculated duty | `(119645.640 / 3600) * 4.181 * 35` | `4863.042 kW` |
| Duty residual | `100 - 4863.042` | `-4763.042 kW` |

The large duty residual is expected for the test case because 100 kW is only a default input and does not match the solved hydraulic flow plus 35 deg C temperature rise.

## Mismatches Found

| Finding | Decision |
|---|---|
| Heat Exchanger pressure drop was used in the hydraulic solver, but the Task Window did not show how `bar` became head loss. | Fixed by adding Pressure Drop Head equation and NPSH role trace. |
| Heat Exchanger had no dependency chain or calculation trace. | Fixed by adding trace sections and realtime readouts. |
| Heat duty input was not compared against hydraulic flow, density, Cp, and outlet temperature. | Fixed by adding calculated duty and duty residual. |
| Unit Standard changes did not explicitly refresh Heat Exchanger trace bodies. | Fixed by adding Heat Exchanger refresh hooks. |

## Needs Verification

- Detailed exchanger thermal design (`UA`, `LMTD`, `NTU`, shell/tube side split, fouling) is not implemented and remains outside the current simplified model.
- Local phase-change or flashing through the exchanger is not modeled.
- If an exchanger outlet feeds pump suction at a temperature different from Fluid Basis, vapor pressure must be reassessed through Fluid Basis or SRC temperature mode; this is now documented as an assumption/advisory rather than silently recalculated.

## Tests

Added `tests/heat-exchanger-trace-validation.cjs`:

- verifies pressure drop head formula
- verifies mass flow and heat duty equation
- verifies suction-path NPSH contribution
- verifies Dependency Chain and Equation Steps rendering
- verifies US Customary display units for duty, pressure drop, head, flow, mass flow, temperature, and specific heat

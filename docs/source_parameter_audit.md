# SRC Parameter Formula Audit

Date: 2026-05-12

## Scope

This audit covers the `SRC` object parameters, calculation steps, unit conversions, and realtime display functions that feed pump hydraulic and NPSH calculations.

Audited files:

- `properties/objects/network-node-properties.js`
- `core/state-manager.js`
- `properties/object-properties.js`
- `formulas/constants.js`
- `formulas/objects/hydraulic-network-formulas.js`
- `formulas/objects/pump-formulas.js`
- `core/simulation-engine.js`
- `tests/source-boundary-validation.cjs`
- `tests/source-ui-rules.cjs`
- `tests/source-trace-validation.cjs`

## References

Local repository references:

- `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf`
  - Section 9.6.1.2.2 defines NPSHA as total suction head absolute at the first-stage impeller datum minus absolute vapor pressure head.
  - Appendix A lists atmospheric pressure head, vapor pressure head, suction gauge head, suction velocity head, vertical datum distance, and suction head loss as NPSHA terms.
- `pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf`
  - Defines NPSH as excess inlet total head over vapor pressure head and discusses NPSHA/NPSHR at pump inlet.
- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`
  - Supports pressure head, Bernoulli/energy balance, static/dynamic/stagnation pressure, and head-loss concepts.
- `pdf_ref/ref2-introduction-fluid-mechanics.pdf`
  - Supports Bernoulli equation and incompressible steady-flow energy-balance interpretation.

External references used for cross-check:

- NASA Glenn Research Center, Bernoulli's Equation: static pressure plus dynamic pressure forms total pressure for steady incompressible inviscid flow.
  URL: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoullis-equation/
- NIST Guide to the SI, Appendix B: `1 atm = 101325 Pa` exactly.
  URL: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors
- NIST Chemistry WebBook SRD 69, Thermophysical Properties of Fluid Systems: density, viscosity, specific volume, heat capacity, speed of sound, and related fluid-property data are available for water, methanol, and other supported pure fluids.
  URL: https://webbook.nist.gov/chemistry/fluid/

## Verified Formula Map

| SRC/UI parameter | Formula / rule | Unit basis | Status |
| --- | --- | --- | --- |
| Pressure Basis = Gauge | `Pabs = Pgauge + Patm` | `Patm = 101325 Pa = 1.01325 bar` | Fixed and verified |
| Pressure Basis = Absolute | `Pabs = Pabs input` | bar a | Formula verified |
| Pressure to head | `Hp = Pabs(Pa) / (rho * g)` | `1 bar = 100000 Pa`, `g = 9.81 m/s2` | Formula verified |
| Mass flow to volume flow | `Q(m3/h) = m_dot(kg/h) / rho(kg/m3)` | Uses effective SRC fluid density | Fixed and verified |
| Volume flow to mass flow | `m_dot(kg/h) = Q(m3/h) * rho(kg/m3)` | Uses effective SRC fluid density | Fixed and verified |
| Open Tank / Reservoir head | `Hsource = Pabs_surface/(rho*g) + z_liquid_level` | liquid surface velocity neglected | Formula verified |
| Pressurized Vessel head | `Hsource = Pabs_vessel/(rho*g) + z_liquid_level` | inherited vessel/tank data when enabled | Formula verified |
| External Header static pressure | `Hsource = Pstatic/(rho*g) + z_tie_in + v^2/(2g)` | velocity head added once | Display fixed and verified |
| External Header total pressure | `Hsource = Ptotal/(rho*g) + z_tie_in` | total/stagnation pressure already includes velocity head | Formula verified |
| Suction path loss | `HL = Darcy-Weisbach pipe loss + fitting/valve/equipment minor losses` | m of liquid | Formula verified |
| Vapor pressure head | `Hv = Pv(Pa)/(rho*g)` | vapor pressure from active/effective fluid basis | Formula verified |
| NPSHA | `NPSHa = Hp + z_source + Hvel - z_pump - HL - Hv` | m | Display fixed and verified |

## Findings And Fixes

1. Atmospheric pressure constant
   - Finding: application used `1.013 bar`, while the standard atmosphere reference is `101325 Pa = 1.01325 bar`.
   - Fix: `ATM_PRESSURE_BAR` changed to `1.01325` in `formulas/constants.js`.
   - Impact: visible 3-decimal readouts usually remain the same, but equation trace now uses a more exact standard basis.

2. External Header static pressure trace
   - Finding: the solver already added inlet velocity head once for `External Header / Pipe Tie-in` with `Static Pressure`, but the NPSHA Equation Steps displayed `NPSHa = Hp + z_source - z_pump - HL - Hv`, omitting `Hvel`.
   - Fix: pump trace now includes `Source Velocity Head`, stores `boundary.velocityHead`, and displays `NPSHa = Hp + z_source + Hvel - z_pump - HL - Hv`.
   - Impact: Equation Steps now reconcile numerically with realtime NPSHA for external header static pressure cases.

3. SRC custom temperature fluid properties
   - Finding: hydraulic calculations could use recomputed source-temperature properties, but the SRC property panel displayed global Fluid Basis density/viscosity/vapor pressure. Mass-flow conversion also used global density.
   - Fix: SRC panel now displays effective source fluid properties via `getFluidPropsAtSourceTemperature()` when available, and mass/volume flow conversion uses the effective SRC density.
   - Impact: `Temperature Mode = Custom` now keeps readout, flow conversion, and hydraulic calculation aligned.

4. Semantic dashed attachment
   - Finding: dashed attachment is correctly excluded from hydraulic traversal.
   - Status: no formula change required. Dashed SRC-to-tank/vessel only supports boundary-data inheritance; pipe/hydraulic components remain required for flow and pressure-loss calculation.

5. SRC Task Window trace
   - Finding: SRC property values were displayed, but the Source Object Task Window did not show an auditable `Calculation Trace / Step-by-step Report`.
   - Fix: added `buildSourceCalculationTrace()` and a Source Task Window trace renderer showing Dependency Chain, pressure basis, inherited/manual elevation, effective fluid basis, mass/volume conversion, source hydraulic head, external-header velocity head, and hydraulic traversal status.
   - Impact: SRC numbers now have the same realtime audit surface as Fluid Basis, Pipe, Tank, Pump, and Instrument task windows.

## Verified Realtime Display Functions

- `properties/object-properties.js`
  - SRC property panel displays effective pressure, elevation, fluid basis link, density, viscosity, vapor pressure, mass/volume conversion, and realtime Calculation Trace.
- `formulas/objects/hydraulic-network-formulas.js`
  - `buildSourceCalculationTrace()` reports the source dependency chain, formulas, local references, and semantic-vs-hydraulic traversal rules used by the solver.
- `formulas/objects/pump-formulas.js`
  - Pump NPSH trace now includes source velocity head and the NPSHA equation that matches the solver.
- `formulas/objects/hydraulic-network-formulas.js`
  - Source boundary head and NPSHA calculations use pressure head, elevation head, optional velocity head, losses, and vapor pressure head consistently.
- `core/simulation-engine.js`
  - Fixed-flow warnings remain valid when source flow, downstream pressure, and pump curve are all specified.

## Tests Run

- `node --check formulas/constants.js formulas/objects/hydraulic-network-formulas.js formulas/objects/pump-formulas.js core/state-manager.js properties/object-properties.js`
- `node tests/source-boundary-validation.cjs`
- `node tests/source-ui-rules.cjs`
- `node tests/source-trace-validation.cjs`
- `node tests/npsh-validation.cjs`

## Residual Notes

- SRC `Fixed Flow Source` still reports residual head when downstream pressure and pump curve are also fixed. This is mathematically correct for an over-specified system.
- The current hydraulic solver supports one series suction path per pump. Branched or multi-source hydraulic networks still require a future nodal solver.

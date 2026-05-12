# Vessel H Parameter Formula Audit

Date: 2026-05-12

## Scope

This audit covers the toolbar object labelled `Vessel H`. In the codebase this object uses the internal type `separator` and the schema `SEPARATOR_SCHEMA`.

The current model is a simplified hydraulic/process vessel boundary. It is not an ASME mechanical pressure-vessel design model and it is not a full separator sizing/rating model.

Audited files:

- `toolbar/toolbar-catalog.js`
- `properties/objects/separator-properties.js`
- `formulas/objects/separator-formulas.js`
- `properties/object-properties.js`
- `core/simulation-engine.js`
- `ui/sidebar-properties.js`
- `tests/vessel-trace-validation.cjs`

## References

Local repository references:

- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`
  - Supports pressure head, Bernoulli/energy balance, density, vapor pressure, and head-loss fundamentals.
- `pdf_ref/ref2-introduction-fluid-mechanics.pdf`
  - Supports steady incompressible energy-balance and pressure/elevation head interpretation.
- `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf`
  - Supports source pressure, vapor pressure head, liquid-level datum, and suction-loss context for NPSH use.

External references used for cross-check:

- NIST Guide to the SI, Appendix B: `1 atm = 101325 Pa` exactly.
  URL: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors
- NIST Chemistry WebBook SRD 69, Thermophysical Properties of Fluid Systems.
  URL: https://webbook.nist.gov/chemistry/fluid/
- NASA Glenn Research Center, Bernoulli's Equation: static plus dynamic pressure forms total pressure for steady incompressible flow under the stated assumptions.
  URL: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoullis-equation/

## Verified Formula Map

| Vessel H parameter | Formula / rule | Unit basis | Status |
| --- | --- | --- | --- |
| Pressure Basis = Gauge | `Pabs = Pgauge + Patm` | `Patm = 101325 Pa = 1.01325 bar` | Formula verified |
| Pressure Basis = Absolute | `Pabs = Pabsolute input` | bar a | Formula verified |
| Liquid surface elevation | `z_liquid = z_base + liquidLevelOffset` | m | Formula verified |
| Nozzle endpoint elevation | `z_pipe_endpoint = inlet/outlet nozzle elevation` | m | Formula verified |
| Outlet submergence | `z_liquid - z_outlet_nozzle` | m | Formula verified |
| Pressure drop head | `hL = dP(Pa) / (rho * g)` | `dP(bar) * 100000`, active Fluid Basis density | Formula verified |
| Hydraulic inlet flow | `Qhyd,in = sum(solved pipe flow entering vessel)` | m3/h from solid hydraulic pipe results only | Formula verified |
| Hydraulic outlet flow | `Qhyd,out = sum(solved pipe flow leaving vessel)` | m3/h from solid hydraulic pipe results only | Formula verified |
| Total SRC feed flow | `Qsrc,total = sum(attached SRC flow specification)` | m3/h; semantic inventory feed, not pressure-loss path | Formula verified |
| Inlet flow | `Qin = Qhyd,in + Qsrc,total` | m3/h | Formula verified |
| Outlet flow | `Qout = Qhyd,out` | m3/h | Formula verified |
| Net flow | `Qnet = Qin - Qout` | m3/h | Formula verified |
| Level trend | sign of `Qnet` with a 2% or 0.01 m3/h deadband | Rising, Falling, Balanced, or No flow | Engineering readout |
| Residence holdup | `V = Q * residenceTime / 60` | `Q` uses total vessel inlet flow when available, time in min, volume in m3 | Engineering sizing estimate |

## Findings And Fixes

1. Vessel H did not expose an auditable calculation trace.
   - Fix: added `buildSeparatorCalculationTrace()` with readouts, Dependency Chain, Equation Steps, warnings, assumptions, and references.

2. Unit Standard display needed explicit Vessel H coverage.
   - Fix: Vessel H Task Window values now use the Quantity Registry display helper. Metric/European, SI, and US Customary units are converted at the display boundary while internal calculations remain metric.

3. Vessel H pressure drop was used by the hydraulic solver but not traceable in the UI.
   - Fix: Equation Steps now show `hL = dP * 100000 / (rho * g)` and identify it as equipment head loss used in hydraulic traversal.

4. Vessel H can be used by SRC as a `Pressurized Vessel` attachment target.
   - Fix: Dependency Chain now states that dashed SRC attachment may inherit vessel pressure and liquid-surface elevation, but real flow still requires solid hydraulic pipe connections.

5. Vessel H did not show steady inventory flow balance.
   - Fix: added `Hydraulic Inlet Flow`, `Hydraulic Outlet Flow`, `Total SRC Feed Flow`, `Inlet Flow`, `Outlet Flow`, `Net Flow`, `Level Trend`, and `SRC Feed Flow Breakdown`.
   - Important boundary: dashed SRC attachment flow is used only as an inventory/source-feed specification. It is not included in hydraulic graph traversal, pipe friction, vessel pressure-drop traversal, or NPSH suction-path loss.

## Realtime Display Behavior

The toolbar label `Vessel H` is a symbolic tool label and does not change with Unit Standard.

The Vessel H object Task Window does change:

- Vessel pressure input: bar g/bar a, kPa g/kPa a, or psig/psia.
- Calculated absolute pressure: bar a, kPa a, or psia.
- Pressure drop: bar, kPa, or psi.
- Elevation/head: m or ft.
- Solved flow: m3/h, m3/s, or gpm.
- Hydraulic inlet/outlet flow, total SRC feed flow, inlet flow, outlet flow, and net flow: m3/h, m3/s, or gpm.
- Holdup volume: m3 or ft3.
- Density/vapor pressure readouts follow active Fluid Basis and selected Unit Standard.

`SRC Feed Flow Breakdown` lists each attached SRC, source type, and volumetric feed value. This is a steady inventory readout only; a dashed SRC line does not create a hydraulic path.

## Standard Example Values

New Vessel H objects now start with editable reference values so the Task Window is not blank:

| Field | Example value | Purpose |
| --- | ---: | --- |
| Base Elevation | `6 m` | Starting source/equipment datum example |
| Liquid Level Elev. Offset | `3 m` | Example liquid surface offset above base |
| Inlet Nozzle Elev. | `3 m` | Example hydraulic inlet port elevation |
| Outlet Nozzle Elev. | `1 m` | Example hydraulic outlet port elevation |
| Pressure Basis | `Gauge` | Common operator input basis |
| Vessel Pressure | `0.1 bar g` | Mild pressurized-vessel example, not a design pressure |
| Pressure Drop | `0.1 bar` | Existing equipment loss example |
| Residence Time | `5 min` | Existing residence-holdup example |

These values are examples only. They are not separator sizing guarantees, ASME design values, or PSV design inputs.

## Needs Verification

- Full separator process sizing/rating is not implemented. Gas/liquid disengagement, droplet settling, K-value/Souders-Brown sizing, boot/weir design, residence distribution, mist eliminator performance, and API/GPSA separator design checks need dedicated references before they can be marked verified.
- ASME pressure vessel mechanical checks such as MAWP, wall thickness, corrosion allowance, nozzle reinforcement, hydrotest, and relief sizing are not implemented.

## Tests Run

- `node tests/vessel-trace-validation.cjs`
- `node tests/unit-system-validation.cjs`
- `node tests/source-trace-validation.cjs`
- `node tests/source-boundary-validation.cjs`
- `node tests/tank-trace-validation.cjs`
- `node tests/pipe-validation.cjs`

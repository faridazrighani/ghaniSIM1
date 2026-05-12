# Vessel V Parameter Formula Audit

Date: 2026-05-12

## Scope

This audit covers the toolbar object labelled `Vessel V`. In the codebase this object uses the internal type `verticalVessel` and the schema `VERTICAL_VESSEL_SCHEMA`.

The current model is a simplified hydraulic/process vertical vessel boundary. It is not an ASME mechanical pressure-vessel design model and it is not a full vertical separator sizing/rating model.

Audited files:

- `toolbar/toolbar-catalog.js`
- `properties/objects/separator-properties.js`
- `formulas/objects/separator-formulas.js`
- `properties/object-properties.js`
- `core/simulation-engine.js`
- `ui/sidebar-properties.js`
- `tests/vessel-v-trace-validation.cjs`

## References

Local repository references:

- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`
  - Supports pressure head, Bernoulli/energy balance, density, vapor pressure, kinematic viscosity, specific weight, and head-loss fundamentals.
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

| Vessel V parameter | Formula / rule | Unit basis | Status |
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

1. Vessel V previously shared the Vessel H trace path but still displayed some Vessel H-specific wording.
   - Fix: calculation trace metadata now uses object-specific labels: `Vessel V`, `Vessel V / Vertical Vessel`, and `Vertical`.

2. Vessel V needed an auditable object-specific test.
   - Fix: added `tests/vessel-v-trace-validation.cjs`, covering pressure, elevation, nozzle/submergence, flow balance, SRC feed breakdown, US unit display, and object-specific wording.

3. Vessel V standard example values needed to be explicit and different from Vessel H.
   - Fix: added `VESSEL_V_STANDARD_EXAMPLE` with a taller vertical-vessel style liquid level/nozzle arrangement and `orientation = Vertical`.

4. SRC attachment behavior needed to remain clear for Vessel V.
   - Fix: Dependency Chain states that dashed SRC attachment may inherit Vessel V pressure and liquid-surface elevation, while hydraulic flow and pressure loss still require solid pipe/hydraulic connections.

## Realtime Display Behavior

The toolbar label `Vessel V` is a symbolic tool label and does not change with Unit Standard.

The Vessel V object Task Window does change:

- Vessel pressure input: bar g/bar a, kPa g/kPa a, or psig/psia.
- Calculated absolute pressure: bar a, kPa a, or psia.
- Pressure drop: bar, kPa, or psi.
- Elevation/head: m or ft.
- Solved flow: m3/h, m3/s, or gpm.
- Hydraulic inlet/outlet flow, total SRC feed flow, inlet flow, outlet flow, and net flow: m3/h, m3/s, or gpm.
- Holdup volume: m3 or ft3.
- Density/vapor pressure readouts follow active Fluid Basis and selected Unit Standard.

Unit Standard changes explicitly refresh all Vessel V readouts and calculation-trace bodies through the shared vessel refresh path.

## Standard Example Values

New Vessel V objects now start with editable reference values so the Task Window is not blank:

| Field | Example value | Purpose |
| --- | ---: | --- |
| Base Elevation | `4 m` | Starting source/equipment datum example for vertical vessel |
| Liquid Level Elev. Offset | `5 m` | Taller example liquid column above base |
| Inlet Nozzle Elev. | `8 m` | Example upper/side feed hydraulic inlet port elevation |
| Outlet Nozzle Elev. | `4.8 m` | Example lower liquid outlet port elevation near vessel bottom |
| Pressure Basis | `Gauge` | Common operator input basis |
| Vessel Pressure | `0.15 bar g` | Mild pressurized-vessel example, not a design pressure |
| Pressure Drop | `0.08 bar` | Example equipment loss |
| Residence Time | `8 min` | Example residence-holdup basis for a vertical vessel |
| Orientation | `Vertical` | Vessel V identity and display orientation |

These values are examples only. They are not separator sizing guarantees, ASME design values, or PSV design inputs.

## Needs Verification

- Full vertical separator process sizing/rating is not implemented. Gas/liquid disengagement, droplet settling, K-value/Souders-Brown sizing, demister performance, boot/weir internals, residence distribution, and API/GPSA separator design checks need dedicated references before they can be marked verified.
- ASME pressure vessel mechanical checks such as MAWP, wall thickness, corrosion allowance, nozzle reinforcement, hydrotest, and relief sizing are not implemented.
- Vertical vessel geometric volume by diameter/straight-side height is not yet modeled; current residence holdup is a process readout from flow and residence time.

## Tests Run

- `node tests/vessel-v-trace-validation.cjs`
- `node tests/vessel-trace-validation.cjs`
- `node tests/unit-system-validation.cjs`
- `node tests/source-boundary-validation.cjs`
- `node tests/source-trace-validation.cjs`
- `node tests/npsh-validation.cjs`
- `node tests/pipe-validation.cjs`

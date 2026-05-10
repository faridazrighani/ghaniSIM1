# Pipe Object Properties Audit

Date: 2026-05-10

## Purpose

This note documents the first-stage audit and upgrade of the Pipe Object Properties model. The goal is to keep the pipe object consistent with standard internal-flow literature, readable in the sidebar, and traceable for pump suction and NPSHA calculations.

## Literature Basis

- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`
  - Chapter 8 covers pipe flow, Reynolds number, Darcy friction factor, Moody/Colebrook turbulent friction, and minor losses.
- `pdf_ref/ref2-introduction-fluid-mechanics.pdf`
  - Chapter 8.7 gives total head loss as major pipe friction plus minor losses from entrances, fittings, and area changes.
  - It distinguishes Darcy friction factor from Fanning friction factor.
  - It gives pipe Reynolds number as `Re = rho V D / mu`, equivalent to `Re = V D / nu` when kinematic viscosity is used.
- `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf`
  - Appendix A treats NPSHA and suction head loss.
  - Suction head loss includes suction pipe, fittings, and valves over the operating envelope.

## Formula Basis

The Pipe object uses Darcy-Weisbach head loss:

```text
Q = flow / 3600
A = pi D^2 / 4
V = Q / A
Re = V D / nu
h_major = f (L / D) V^2 / (2g)
h_minor = sum(K) V^2 / (2g)
h_total = h_major + h_minor
```

Where:

- `f` is the Darcy friction factor.
- `nu` is kinematic viscosity in `m2/s`, converted from Fluid Basis viscosity in `cSt`.
- `K` is the loss coefficient for fittings, entrances, exits, valves, or user-entered additional loss.

## Field Mapping

| Sidebar field | Model property | Engineering meaning | Status |
| --- | --- | --- | --- |
| Pipe Routing | `routeStyle` | Visual/semantic route style; elbow mode may auto-add one typical elbow K when the segment has no active fitting. | Implemented |
| Elevation Profile | `elevationProfileMode` | Controls whether pipe endpoint elevation overrides and high point check are used. | Upgraded |
| Start Elevation Override | `startElevation` | Optional pipe inlet elevation override. Ignored when elevation mode is `Ignore`. | Upgraded |
| End Elevation Override | `endElevation` | Optional pipe outlet elevation override. Ignored when elevation mode is `Ignore`. | Upgraded |
| High Point Elevation | `highPointElevation` | Optional pipe-level high point used only in `High Point Check` mode when segment high points are not supplied. | Upgraded |
| High Point Location | `highPointLocationPercent` | Pipe-level high point position along developed pipe length. | Added |
| Aging Roughness Factor | `roughnessAgingFactor` | Multiplies base segment roughness for conservative aging/degradation screening. | Added |
| Head Loss Allowance | `headLossAllowancePercent` | Adds a percent allowance to calculated pipe head loss for fouling/design conservatism. | Added |
| NPS / Schedule | `segment.pipeSize` | Preset internal diameter for common NPS/Schedule values. | Implemented; source map pending |
| ID (m) | `segment.diameter` | Internal diameter used in area, velocity, Reynolds number, and head loss. | Implemented |
| Len (m) | `segment.length` | Actual developed pipe length along the flow path, not merely canvas distance. | Documented |
| Material | `segment.material` | Roughness preset selector. | Implemented; source map pending |
| eps (mm) | `segment.roughness` | Absolute roughness, displayed in mm and stored in m. | Implemented |
| eps eff | calculated | Effective roughness after aging factor. | Added |
| Fitting | `segment.fittingType` | Fitting/loss-coefficient preset. | Implemented; typical estimate |
| Qty | `segment.fittingQuantity` | Number of selected fittings. | Implemented |
| K each | `segment.fittingK` | Loss coefficient per fitting. Custom K is editable. | Implemented |
| Add K | `segment.minorLoss` | Additional user-entered K value. | Implemented |
| Total K | calculated | `Qty x K each + Add K`. | Implemented |
| z in / z out | `segment.startElevation`, `segment.endElevation` | Optional segment endpoint elevation overrides for detailed elevation profile. | Added |
| HP z / HP % | `segment.highPointElevation`, `segment.highPointLocationPercent` | Optional segment-level high point elevation and position. | Added |
| P in / P out | calculated | Segment static pressure at segment inlet/outlet. | Added |
| HP P / HP Margin | calculated | Segment high point pressure and vapor pressure margin. | Added |
| V | calculated | Average segment velocity. | Implemented |
| Re | calculated | Pipe Reynolds number. | Implemented |
| Regime | calculated | Laminar, Transitional, or Turbulent. | Added |
| Darcy f | calculated | Darcy friction factor. | Clarified |
| Major hL | calculated | Darcy-Weisbach major head loss. | Implemented |
| Minor hL | calculated | K-based minor head loss. | Clarified |
| hL Allow | calculated | Head loss allowance contribution. | Added |
| Total hL | calculated | Major plus minor loss. | Implemented |
| Basis | calculated | Compact status for roughness and fitting source data. | Added |
| Calculation Trace / Step-by-step Report | calculated | Read-only report showing formula, substitution, result, and reference for pipe loss and pressure steps. | Added |

## First-Stage Changes

### Reynolds Regime

The pipe model now classifies flow as:

```text
Laminar:       Re <= 2300
Transitional: 2300 < Re < 4000
Turbulent:    Re >= 4000
```

For transitional flow, the friction factor is still estimated by blending laminar and turbulent values, but the sidebar reports the regime and adds a warning because transitional pipe flow is inherently uncertain.

### Darcy Friction Factor

The sidebar label is `Darcy f`. This avoids confusion with Fanning friction factor, which is one quarter of the Darcy value.

### Viscosity Basis

Pipe Reynolds number uses Fluid Basis kinematic viscosity in `cSt`.

```text
nu(m2/s) = viscosity(cSt) x 1e-6
```

Dynamic viscosity values such as `cP` or `Pa.s` should not be entered into the kinematic viscosity field.

### Pressure Basis

Pipe result pressures are shown as `bar a`:

- Pipe Pressure
- Inlet Pressure
- Outlet Pressure
- High Point P

This matches the absolute-pressure basis used by hydraulic head and NPSHA calculations.

### Fouling and Aging Allowance

Two conservative screening controls are now available:

```text
effective roughness = base roughness x aging roughness factor
h_allowance = (h_major + h_minor) x head loss allowance percent / 100
h_total = h_major + h_minor + h_allowance
```

The aging factor is useful for roughness degradation sensitivity. The head loss allowance is a broad design/fouling allowance and directly increases suction path loss used by NPSHA calculations.

### Elevation Profile Modes

The modes now have explicit calculation meaning:

| Mode | Calculation behavior |
| --- | --- |
| Ignore | Uses connected node/port elevations. Ignores stale pipe start/end overrides and high point elevation. |
| End Elevations | Uses pipe endpoint overrides and segment endpoint elevation overrides when present. Ignores high point elevation. |
| High Point Check | Uses pipe/segment endpoint elevations and evaluates pipe-level or segment-level high point pressure. |

### High Point Vapor Margin

High point check now reports:

```text
High Point Vapor Margin = High Point Pressure - Vapor Pressure
```

Negative or zero margin reports a high point pressure warning.

Segment high points override the pipe-level high point. If no segment high point is supplied, the pipe-level high point is located along the developed pipe length using `High Point Location`.

### Source Map Status

Roughness and fitting options now carry compact source/status metadata:

- `Exact`: no loss or an exact structural value.
- `Typical`: textbook/standard engineering typical value.
- `Estimate`: useful default that should be verified for final design.
- `User`: user-entered roughness or loss coefficient.

### Calculation Trace / Step-by-step Report

Pipe Object Properties now includes an expanded read-only calculation report for audit, thesis checking, and troubleshooting. The report refreshes in realtime after segment add/remove actions and after pipe calculation inputs are edited.

The report contains:

- Input basis: flow, density, kinematic viscosity, vapor pressure, aging roughness factor, allowance, and elevation mode.
- Total pipe summary: major loss, minor loss, allowance loss, total head loss, total K, and controlling high point data.
- Per-segment formula steps:
  - `A = pi D^2 / 4`
  - `V = Q / A`
  - `Re = V D / nu`
  - `eps_eff = eps x aging factor`
  - `eps_eff / D`
  - `hv = V^2 / (2g)`
  - `h_major = f (L / D) hv`
  - `h_minor = K_total hv`
  - `h_allow = (h_major + h_minor) x allowance`
  - `h_total = h_major + h_minor + h_allow`
- Pressure/elevation trace when solved:
  - segment inlet and outlet pressure,
  - high point vapor pressure margin when high point check is active.
- Data notes and references for Darcy friction factor, kinematic viscosity, and K-based minor loss.

If the pipe does not have solved positive flow, the report remains visible but states that a hydraulic path and solved simulation are needed.

The Pipe Object Properties panel now opens in a proportional Task Window. It can be minimized into a small tab; selecting a pipe while minimized keeps the tab minimized, and clicking the minimized tab restores the full window.

## Remaining Engineering Concerns

- NPS/Schedule internal diameters are still practical defaults and should be checked against a pipe schedule table for final design.
- Fitting K values vary with geometry, Reynolds number, manufacturer data, pipe size, and installation details.
- Pipe length must be the actual developed length along the flow path.
- Segment high point pressure is now position-aware, but it remains a steady-state hydraulic grade approximation, not a transient/two-phase model.

## Deferred Enhancements

These remain deferred after the second-stage Pipe Object Properties upgrade:

- Vendor-specific K tables and pipe schedule databases.
- Equivalent length method beside K-value method.
- Transient acceleration head for reciprocating/rapidly varying flow.
- Fouling models based on time/service rather than user-entered allowance.
- Two-phase/flashing high point treatment.

## Validation Scope

The first-stage validation is covered by `tests/pipe-validation.cjs`:

- Darcy-Weisbach major loss.
- Minor loss coefficient K.
- Multi-segment total head loss.
- Reynolds regime thresholds.
- Transitional flow warning.
- Elevation Profile mode behavior.
- High point vapor margin and warning.
- Aging roughness factor and head loss allowance.
- Per-segment elevation/high point pressure profile.
- Roughness/fitting source status metadata.
- Calculation trace / step-by-step report.
- Sidebar pressure/unit labels and Darcy friction label.

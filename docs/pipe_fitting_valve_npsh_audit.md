# Pipe, Fitting, and Valve NPSH Audit

Date: 2026-05-12

## Summary

This audit covers the Pipe object, pipe-segment Fitting data, Valve object, Control Valve valve type, and Check Valve object for NPSH-related calculation behavior. The application does not currently have a separate standalone Fitting object; fittings are modeled inside each pipe segment through fitting type, quantity, and K coefficient. Control Valve is intentionally modeled as a Valve Type so it remains a hydraulic pass-through object on solid pipe paths, while its trace exposes Cv/opening behavior and NPSH consequences.

The implemented basis is consistent with steady incompressible hydraulic head accounting:

```text
Q = flow / 3600
A = pi D^2 / 4
V = Q / A
hv = V^2 / (2g)
Re = V D / nu
h_major = f (L / D) hv
h_minor = sum(K) hv
h_valve,K = K_eff hv
dP_Cv(psi) = SG (Q_gpm / Cv)^2
h_Cv = dP x 100000 / (rho g)
NPSHA effect = -hL when pipe/fitting/valve is on the pump suction path
```

## References Used

Local references:

- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`
  - Used for internal pipe flow, Reynolds number, Darcy-Weisbach head loss, Moody/Colebrook friction factor, and minor-loss coefficient context.
- `pdf_ref/ref2-introduction-fluid-mechanics.pdf`
  - Used for steady-flow energy balance, pressure/elevation/velocity head, and head-loss accounting.
- `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf`
  - Used for NPSHA context: vapor pressure head and suction line losses reduce NPSHA.

External cross-check references:

- NASA Glenn Bernoulli equation: static pressure plus dynamic pressure/head interpretation for steady incompressible reference.
  - https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoullis-equation/
- NIST Guide to the SI, Chapter 4: pascal is the SI coherent derived pressure unit.
  - https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes
- EngineeringToolBox Cv relation for liquids, used only as an open reference for the common liquid Cv form.
  - https://www.engineeringtoolbox.com/flow-coefficients-d_277.html
- IEC 60534-2-1:2011 public catalog entry, used to verify that control-valve sizing equations cover incompressible and compressible fluid flow under installed conditions.
  - https://webstore.iec.ch/en/publication/2461
- IEC/EN 60534-2-1 public preview, used to confirm the standard's pressure, vapour pressure, density, viscosity, and liquid recovery-factor terminology for control-valve sizing.
  - https://standards.iteh.ai/catalog/standards/clc/fb99dc2d-5586-4a83-89d6-f5df428e8d92/en-60534-2-1-2011
- IEC 60534-2-3:2015 public catalog notes, used to identify flow-capacity test variables such as flow coefficient, liquid pressure recovery factor, piping geometry factor, and Reynolds factor.
  - https://webstore.iec.ch/en/publication/23942
- Pumps.org NPSH overview, used as open context that piping friction loss reduces NPSH at the pump location.
  - https://www.pumps.org/2022/12/07/the-basics-of-npsh-pump-operating-regions/

## Audit Findings

### Pipe and Pipe-Segment Fittings

Status: formula verified for steady single-phase screening.

- Pipe uses Darcy-Weisbach major loss with Darcy friction factor.
- Fittings use K-based minor loss: `h_minor = K_total V^2/(2g)`.
- Kinematic viscosity from Fluid Basis is converted from `cSt` to `m2/s` for Reynolds number.
- Pipe high point pressure uses static pressure minus vapor pressure for vapor margin warning.
- Pipe/fitting total loss is included by the hydraulic solver when the pipe lies on a solid hydraulic path.
- When the pipe is on the pump suction path, this loss directly reduces NPSHA.

Trace/UI changes made:

- Added `Dependency Chain` to Pipe Calculation Trace.
- Expanded Pipe references to local `pdf_ref` and external NASA/NIST context.
- Pipe trace now explicitly states that pipe/fitting loss subtracts from NPSHA when located on the suction path.

Remaining verification status:

- Pipe schedule IDs are practical presets and should be verified against project piping class.
- Fitting K values are typical/estimate values unless marked User or Exact. They are not claimed as vendor-certified final design values.

### Valve

Status: formula verified for K and Cv arithmetic; Cv source remains user/manufacturer basis.

Supported loss models:

- `K coefficient`
  - `K_eff = K_base / openingFactor^2`
  - `hL = K_eff V^2/(2g)`
- `Cv`
  - `Cv_eff = Cv_base x openingFactor`, unless Manual Effective Cv is selected.
  - `dP(psi) = SG (Q_gpm / Cv_eff)^2`
  - `hL = dP(bar) x 100000 / (rho g)`
- `Equivalent length`
  - `hL = f (L_eq / D) V^2/(2g) / openingFactor^2`

Trace/UI changes made:

- Added Valve `Calculated Valve Readout`.
- Added Valve `Calculation Trace / Step-by-step Report`.
- Added Valve `Dependency Chain`, `Equation Steps`, and `NPSH Role`.
- Valve trace now detects whether the valve is on a pump suction path or discharge path.
- Unit-standard changes now refresh Valve readout and trace in realtime.

Remaining verification status:

- Default valve K values and fitting-style K values are typical screening values.
- Cv should be supplied by vendor/user data. The code now labels Cv as user/manufacturer input and warns that final design should verify it against manufacturer or ISA sizing basis.

### Control Valve

Status: formula verified for current simplified liquid Cv arithmetic; detailed control-valve sizing remains vendor/IEC verification.

Implemented model:

- Control Valve is a `Valve Type` on the existing Valve object, not a separate equipment object.
- Default profile is reduced-bore, flanged RF, carbon steel, review-only reducer/expander basis.
- Preferred screening loss model is `Cv`.
- `openingEffect = characteristic(opening)` where the available characteristics are Linear, Equal percentage, Quick opening, or Manual effective Cv.
- `Cv_eff = Cv_base x openingEffect`, unless Manual effective Cv is selected.
- `dP(psi) = SG (Q_gpm / Cv_eff)^2`.
- `hL = dP(bar) x 100000 / (rho g)`.
- If the Control Valve is on the pump suction path, `hL` is reported as a direct NPSHA loss contribution.

Window-task changes made:

- Valve Type dropdown now includes `Control Valve`.
- A Control Valve window task title is shown when the selected Valve Type is Control Valve.
- The trace now labels Object Type as `Control Valve`.
- Added `Control Valve Sizing / NPSH Focus` with Cv input, effective Cv, opening, flow characteristic, pressure drop, head loss, and suction-path NPSH contribution.
- Added Control Valve-specific Dependency Chain items and warnings.
- Unit-standard changes refresh Control Valve readouts through the same Valve trace path; no separate conversion path was added.

Limitations deliberately shown in the UI:

- The app does not calculate IEC/ISA liquid choking, cavitation, recovery factor `FL`, piping geometry factor `FP`, Reynolds correction factor, installed gain, actuator sizing, or noise.
- Vendor/IEC sizing is required for final design.
- A Control Valve placed upstream of pump suction consumes NPSHA; suction throttling should be treated as a design review item rather than a default recommendation.

### Check Valve

Status: formula verified for current simplified model.

Implemented model:

- If no positive solved forward flow exists, status is treated as closed/no forward-flow loss.
- If flow is positive:
  - `h_crack = dP_crack x 100000 / (rho g)`
  - K model: `h_forward = K V^2/(2g)`
  - Cv model: `dP(psi) = SG (Q_gpm/Cv)^2`, then converted to head
  - `h_total = h_crack + h_forward`

Trace/UI changes made:

- Check Valve uses the same Valve Calculation Trace structure.
- Added cracking pressure head and forward loss steps.
- Trace reports NPSH loss contribution only when the check valve is on the pump suction path.

Remaining verification status:

- Check valve cracking pressure is user input.
- Forward K/Cv should be verified against vendor data for final design.

## Unit Conversion Audit

Internal calculation units remain metric engineering units for backward compatibility:

- Flow: `m3/h`
- Diameter/length/head: `m`
- Pressure: `bar`
- Density: `kg/m3`

Realtime UI conversion was audited for:

- Metric / European Engineering: `m3/h`, `bar`, `m`, `mm`
- SI / International: `m3/s`, `kPa`, `m`
- US Customary: `gpm`, `psi`, `ft`, `in`, `lb/ft3`

New validation confirms Valve trace renders US units for flow, head, pressure, diameter, and density when the unit standard is changed.

## NPSH Calculation Role

Pipe/fitting/valve losses affect NPSH only if the object is upstream of the pump suction:

```text
NPSHA = H_source - hL_suction - z_pump_suction - Pv/(rho g)
```

Therefore:

- Pipe major loss on suction path subtracts from NPSHA.
- Pipe fitting/minor loss on suction path subtracts from NPSHA.
- Valve/check valve loss on suction path subtracts from NPSHA.
- Pipe/valve losses on discharge path affect system head but do not directly subtract from pump suction NPSHA.

## Mismatches Found and Fixed

| Finding | Action |
| --- | --- |
| Pipe/Fitting trace did not expose a dedicated Dependency Chain section. | Added Dependency Chain to Pipe trace and renderer. |
| Valve and Check Valve only had compatibility audit rows, not a calculation trace. | Added readout, dependency chain, equation steps, NPSH role, warnings, assumptions, and references. |
| Control Valve was not available as a distinct valve type and therefore had no control-valve-specific NPSH trace. | Added Control Valve type, task title, Cv/opening focus block, dependency chain, warnings, tests, and documentation. |
| Valve readouts were not explicitly refreshed when unit standard changed. | Added Valve readout and trace refresh hooks to unit-standard refresh. |
| Cv could look like an internally verified source. | Added warning and reference language that Cv is user/manufacturer input and needs final verification. |

## Test Coverage

Updated/added tests:

- `tests/pipe-validation.cjs`
  - Verifies Pipe/Fitting Dependency Chain, local NPSH reference, and UI trace rendering.
- `tests/valve-trace-validation.cjs`
  - Verifies K valve loss, Cv pressure drop, Control Valve effective Cv / pressure drop / NPSH contribution, check valve cracking head, NPSH suction-path contribution, rendered Dependency Chain, Equation Steps, Control Valve focus block, dropdown availability, task-window title support, and US unit conversion.

## Needs Verification

- Vendor-specific valve Cv and opening characteristic.
- Vendor-specific control-valve Cv, travel curve, liquid recovery factor, choked-flow/cavitation limits, installed characteristic, and actuator sizing.
- Vendor-specific check valve cracking pressure and forward loss coefficient.
- Project-specific fitting K values for detailed geometry, Reynolds dependency, and installation details.
- Pipe schedule and internal diameter values against project piping class.

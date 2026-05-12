# Fluid Properties Audit

Date: 2026-05-10

## 1. Summary

This audit verifies the Fluid Basis UI values, derived formulas, units, and references used by the simulator after the Fluid Basis Task Window refactor.

The direct derived formulas are mathematically consistent after the update:

- Specific gravity: `SG = rho / rho_ref`
- Kinematic viscosity: `nu(cSt) = mu(cP) / (rho / 1000)`
- Custom Basic dynamic viscosity: `mu(cP) = nu(cSt) * (rho / 1000)`
- Specific volume: `v = 1 / rho`
- Specific weight: `gamma = rho * g`
- Vapor pressure head: `Hv = Pv(Pa) / (rho * g)`
- Speed of sound: `a = sqrt(K(Pa) / rho)`

Equation Steps now mirrors every visible Fluid Basis value in the Task Window, including primary/source values and derived values. Result badge precision is property-specific, so specific gravity, vapor pressure, and specific volume no longer appear to disagree with the realtime Input Basis readout because of over-aggressive rounding.

The application uses:

- `rho_ref = 999.972 kg/m3` for specific gravity.
- `g = 9.81 m/s2` for hydraulic head conversion. This is documented because the standard gravity value is 9.80665 m/s2, while the local Hydraulic Institute reference examples use 9.81.
- Vapor pressure in the Fluid Basis UI is absolute pressure, labelled `bar a`.
- Specific heat is displayed in `kJ/kg.K`.
- Bulk modulus is displayed in `GPa`.

Water and methanol liquid properties at 25 deg C were checked against NIST Chemistry WebBook SRD 69 values at 298.15 K and 0.101325 MPa. Palm oil and crude oil sources were not found in `pdf_ref`; their primary correlations remain marked `Needs verification` or `Engineering estimate`.

## 2. References from `pdf_ref`

The following local reference files were inspected.

| File | Used for |
| --- | --- |
| `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf` | Density, specific volume, vapor pressure definition, specific heat discussion, bulk modulus/compressibility discussion, kinematic viscosity definition, specific weight formula, cavitation/NPSH context. Extracted PDF pages included 63, 65, 68, 69-70, 74, 95, and 772. |
| `pdf_ref/ref2-introduction-fluid-mechanics.pdf` | Present in repository, but no unique formula correction was taken from it for this audit. |
| `pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf` | Supplementary cavitation and NPSH context. No Fluid Basis property correlation was changed from this source. |
| `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf` | NPSHA definition, pressure-to-head conversion using density, vapor pressure head conversion, suction head loss context, water vapor pressure example. Extracted PDF pages included 12-13 and 33-37. |

## 3. NIST References Used

Official NIST Chemistry WebBook SRD 69 fluid data was used for water and methanol point checks:

- NIST Fluid Systems entry point: https://webbook.nist.gov/chemistry/fluid/
- Water point check, 298.15 K and 0.101325 MPa: `https://webbook.nist.gov/cgi/fluid.cgi?Action=Data&Wide=on&ID=C7732185&Type=IsoBar&Digits=6&P=0.101325&TLow=298.15&THigh=298.15&TInc=1&RefState=DEF&TUnit=K&PUnit=MPa&DUnit=kg%2Fm3&HUnit=kJ%2Fkg&WUnit=m%2Fs&VisUnit=cP&STUnit=N%2Fm`
- Methanol point check, 298.15 K and 0.101325 MPa: `https://webbook.nist.gov/cgi/fluid.cgi?Action=Data&Wide=on&ID=C67561&Type=IsoBar&Digits=6&P=0.101325&TLow=298.15&THigh=298.15&TInc=1&RefState=DEF&TUnit=K&PUnit=MPa&DUnit=kg%2Fm3&HUnit=kJ%2Fkg&WUnit=m%2Fs&VisUnit=cP&STUnit=N%2Fm`

NIST REFPROP documentation was not separately used in this audit because the Chemistry WebBook point data was sufficient for the current water and methanol verification scope.

## 4. Formula Verification

| Property | Formula | Unit conversion | Status |
| --- | --- | --- | --- |
| Dynamic viscosity, Custom Basic | `mu = nu * rho` | `mu(cP) = nu(cSt) * (rho / 1000)` | Formula verified |
| Specific gravity | `SG = rho / rho_ref` | `rho_ref = 999.972 kg/m3` | Formula verified |
| Kinematic viscosity | `nu = mu / rho` | `nu(cSt) = mu(cP) / (rho / 1000)` | Formula verified |
| Specific volume | `v = 1 / rho` | `rho` in `kg/m3`; `v` in `m3/kg` | Formula verified |
| Specific weight | `gamma = rho * g` | `g = 9.81 m/s2`; result in `N/m3` | Formula verified |
| Vapor pressure head | `Hv = Pv / (rho * g)` | `Pv(bar a) * 100000 = Pv(Pa)`; result in `m` | Formula verified |
| Speed of sound | `a = sqrt(K / rho)` | `K(GPa) * 1e9 = K(Pa)`; result in `m/s` | Formula verified |
| Temperature | `T(K) = T(deg C) + 273.15` where required by correlations | Water and methanol correlations use the required internal temperature basis | Formula verified for current implementation path |
| Pressure input conversion | Gauge pressure is converted to absolute using `P_abs = P_g + ATM_PRESSURE_BAR` | App constant `ATM_PRESSURE_BAR = 1.01325` | Formula verified |

## 5. Unit Conversion Verification

- `1 bar = 100000 Pa` is used for vapor pressure head.
- `1 cP = 0.001 Pa.s`; combined with density this gives `nu(cSt) = mu(cP) / (rho / 1000)`.
- `1 GPa = 1e9 Pa` is used for speed of sound.
- Specific heat remains displayed as `kJ/kg.K`; no hidden conversion to `J/kg.K` is used in the current Fluid Basis readout.
- Vapor pressure is displayed as absolute pressure (`bar a`). No gauge vapor pressure label is used.

## 6. Results at 25 deg C

### Water

NIST point values at 298.15 K and 0.101325 MPa:

- Density: `997.048 kg/m3`
- Dynamic viscosity: `0.890022 cP`
- Specific heat: `4.18131 kJ/kg.K`
- Speed of sound: `1496.70 m/s`

Application values at 25 deg C:

| Property | App value | Reference value | Absolute difference | Percent difference | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Density | `997.047 kg/m3` | `997.048 kg/m3` | `0.001 kg/m3` | `0.00010%` | Verified |
| Dynamic viscosity | `0.890 cP` | `0.890022 cP` | `0.000025 cP` | `0.0028%` | Verified |
| Specific heat | `4.181 kJ/kg.K` | `4.18131 kJ/kg.K` | `0.000136 kJ/kg.K` | `0.0033%` | Verified |
| Speed of sound | `1496.699 m/s` | `1496.70 m/s` | `0.001 m/s` | `<0.001%` | Verified through bulk/sound relation |
| Vapor pressure | `0.031698 bar a` | Cross-checked against water vapor pressure references and HI formula trend | Within expected engineering tolerance | Not listed in the NIST isobar output | Verified |

Derived values from app water inputs:

| Property | App value | Check |
| --- | ---: | --- |
| Specific gravity | `0.997075` | `997.047013 / 999.972 = 0.997075` |
| Kinematic viscosity | `0.892633 cSt` | `0.889997 / (997.047013 / 1000) = 0.892633` |
| Specific volume | `0.001002962 m3/kg` | `1 / 997.047013 = 0.001002962` |
| Specific weight | `9781.031 N/m3` | `997.047013 * 9.81 = 9781.031` |
| Vapor pressure head | `0.324 m` | `0.031698 * 100000 / (997.047013 * 9.81) = 0.324` |
| Speed of sound | `1496.699 m/s` | `sqrt(2.233493551e9 / 997.047013) = 1496.699` |

### Methanol

NIST point values at 298.15 K and 0.101325 MPa:

- Density: `786.327 kg/m3`
- Dynamic viscosity: `0.543712 cP`
- Specific heat: `2.53453 kJ/kg.K`
- Speed of sound: `1100.02 m/s`

Application values at 25 deg C:

| Property | App value | Reference value | Difference | Status |
| --- | ---: | ---: | ---: | --- |
| Density | `786.327 kg/m3` | `786.327 kg/m3` | Within display rounding | Verified |
| Dynamic viscosity | `0.544 cP` | `0.543712 cP` | Within display rounding | Verified |
| Specific heat | `2.535 kJ/kg.K` | `2.53453 kJ/kg.K` | Within display rounding | Verified |
| Speed of sound | `1100.020 m/s` | `1100.02 m/s` | Within display rounding | Verified through bulk/sound relation |
| Vapor pressure | `0.169385 bar a` | Antoine correlation, NIST saturation trend checked near 298.15 K | Reference-based estimate | Reference-based estimate |

Derived values from app methanol inputs:

| Property | App value | Check |
| --- | ---: | --- |
| Specific gravity | `0.786349` | `786.32668 / 999.972 = 0.786349` |
| Kinematic viscosity | `0.691458 cSt` | `0.543712 / (786.32668 / 1000) = 0.691458` |
| Specific volume | `0.001271736 m3/kg` | `1 / 786.32668 = 0.001271736` |
| Specific weight | `7713.865 N/m3` | `786.32668 * 9.81 = 7713.865` |
| Vapor pressure head | `2.196 m` | `0.169385 * 100000 / (786.32668 * 9.81) = 2.196` |
| Speed of sound | `1100.020 m/s` | `sqrt(0.951489881e9 / 786.32668) = 1100.020` |

### Palm Oil

Application values at 25 deg C:

| Property | App value | Reference status | Decision |
| --- | ---: | --- | --- |
| Density | `887.500 kg/m3` | No palm oil source found in `pdf_ref` | Needs verification |
| Dynamic viscosity | `77.190 cP` | No palm oil source found in `pdf_ref` | Needs verification |
| Kinematic viscosity | `86.975 cSt` | `77.190 / (887.500 / 1000) = 86.974648`; primary table source not verified | Formula verified for derivation; primary data needs verification |
| Vapor pressure | `0.001 bar a` | Default low vapor pressure estimate, no reference found | Needs verification |
| Specific heat | `1.861 kJ/kg.K` | No palm oil source found in `pdf_ref` | Needs verification |
| Bulk modulus | `1.800 GPa` | Default estimate, no reference found | Needs verification |
| Speed of sound | `1424.138 m/s` | Derived from estimated bulk modulus and density | Needs verification |

### Crude Oil

Application values at 25 deg C:

| Property | App value | Reference status | Decision |
| --- | ---: | --- | --- |
| Density | `842.168 kg/m3` | Code labels API MPMS 11.1-style method, but standard is not in `pdf_ref` | Needs verification |
| Dynamic viscosity | `9.163 cP` | Code labels ASTM D341 method, but standard is not in `pdf_ref` | Needs verification |
| Kinematic viscosity | `10.880 cSt` | Derived formula verified, primary estimate not reference-audited | Formula verified for derivation; primary data needs verification |
| Vapor pressure | `0.195720 bar a` | RVP-based empirical estimate, source standard not found | Engineering estimate |
| Specific heat | `1.932 kJ/kg.K` | Empirical crude oil estimate, source not found | Engineering estimate |
| Bulk modulus | `1.510441 GPa` | Derived from empirical speed of sound and density | Engineering estimate |
| Speed of sound | `1339.222 m/s` | Formula `sqrt(K/rho)` verified, but source basis is empirical | Formula verified from engineering estimate |

## 7. Tolerances Applied

Default tolerances requested for this audit:

- Density: +/-0.5% for automatic engineering correlation.
- Dynamic viscosity: +/-2% to +/-5%, depending on correlation.
- Vapor pressure: +/-2% to +/-5%.
- Derived properties must match their formulas within display rounding.
- Speed of sound: +/-2% to +/-5% if bulk modulus is estimated.

Water and methanol point checks are well inside the default tolerance. Palm oil and crude oil primary data could not be accepted as verified because suitable source documents were not found in `pdf_ref`.

## 8. Mismatches Found

| Issue | Application value or behavior | Reference or expected behavior | Decision |
| --- | --- | --- | --- |
| Manual Advanced SG conversion used `density = SG * 998.2` in the legacy sidebar handler. | Specific gravity trace used `rho_ref = 999.972 kg/m3`, but one edit path used `998.2 kg/m3`. | A single SG basis must be used. The audit chose `999.972 kg/m3` and documents it in Equation Steps and Property Source Map. | Fixed in `ui/sidebar-properties.js`. |
| Default startup state had older approximate water 25 deg C values. | Default values were close but not aligned with the current water correlation. | Startup recalculated Water automatically, but the serialized default should also be consistent. | Updated `core/default-state.js`; `New/Clear Canvas` now recalculates Water defaults. |
| Palm oil references not available. | App table values exist. | No supporting `pdf_ref` source was found. | UI marks primary values `Needs verification`. No speculative numeric changes made. |
| Crude oil standards not available. | Code labels API/ASTM-style estimates. | API MPMS 11.1 and ASTM D341 documents were not found in `pdf_ref`. | UI marks primary values `Needs verification` or `Engineering estimate`. No speculative numeric changes made. |
| Fluid Basis readout did not show Vapor Pressure Head as a live Fluid Basis property. | Equation Steps calculated `Hv`, but the readout grid only showed vapor pressure and other derived properties. Users could compare `Hv` against rounded vapor pressure and see an apparent mismatch. | Hydraulic Institute pressure-head relation: `h = 1000 P(kPa) / (g rho)`, equivalent to `Hv = Pv(bar a) * 100000 / (rho * g)`. | Fixed by storing `vaporPressureHead` in Fluid Basis derived props and showing it in the Task Window readout. Vapor pressure is now shown with more precision in the Task Window. |
| Equation Steps used one precision style and did not show every visible value. | Some result badges used 3 decimals even when the readout used 5 to 8 significant digits, and primary values such as vapor pressure/specific heat/bulk modulus were not shown as their own steps. | The Task Window should let users trace every visible value from either a source method or a derived formula. | Fixed by adding source/equation steps for all visible properties and property-specific result precision. |
| Custom Basic viscosity direction was ambiguous. | Basic mode exposes kinematic viscosity as the editable input, but recalculation could preserve stale dynamic viscosity after density changes. | If `nu` is the Basic input basis, `mu(cP) = nu(cSt) * (rho / 1000)` must be the derived value; Advanced mode keeps `mu` as primary and derives `nu`. | Fixed in Task Window recalculation and Fluid Calculation Trace. |
| Palm oil kinematic viscosity used rounded table values. | Table had a separate rounded cSt column. | The displayed derived formula should match `nu(cSt) = mu(cP) / (rho / 1000)`. | Fixed by deriving palm oil kinematic viscosity from table dynamic viscosity and density. Primary palm oil data remains `Needs verification`. |

## 9. Changes Made

- Added audit-aware source metadata to `buildFluidCalculationTrace()`.
- Added value, unit, method, formula/dependency, reference, and verification status to Property Source Map rows.
- Added specific heat and bulk modulus to the trace value map.
- Updated Equation Steps references to identify the audited formulas and unit bases.
- Expanded Equation Steps to include every visible Fluid Basis property, including density, dynamic viscosity, vapor pressure, specific heat, and bulk modulus source steps.
- Added property-specific Equation Steps precision so result badges match realtime readout precision.
- Fixed Custom Basic mode so kinematic viscosity is the editable input basis and dynamic viscosity is derived from density.
- Derived palm oil kinematic viscosity from dynamic viscosity and density instead of the rounded table cSt column.
- Fixed the legacy manual SG edit path to use `999.972 kg/m3`.
- Updated the default Water 25 deg C state to the current correlation output.
- Recalculated Water default values after New/Clear Canvas.
- Added the Fluid Basis Task Window, Help dropdown, and Help > Fluid Properties Task Window content.
- Removed Property Source Map and NPSH Academic Notes from the legacy Fluid Basis sidebar trace path so those audited notes are only shown through Help > Fluid Properties.
- Added live Fluid Basis `vaporPressureHead` derived property so the readout, Property Source Map, and Equation Steps use the same `Hv` value.

## 10. Items Still Needing Verification

- Palm oil density, viscosity, vapor pressure, specific heat, and bulk modulus need a cited data source for the exact oil composition and temperature range used by the application.
- Crude oil density/viscosity/vapor pressure/specific heat methods need the actual API/ASTM/source references before they can be marked verified.
- Methanol vapor pressure is labelled `Reference-based estimate`; the liquid table values match NIST at 25 deg C, but the app uses an Antoine vapor pressure correlation rather than a stored NIST exact value.
- If the thesis requires standard gravity, consider changing `GRAVITY` from `9.81` to `9.80665`; currently `9.81` is retained and documented because the Hydraulic Institute example uses 9.81.

## 11. Manual Test Checklist

The following checks should be run in the browser:

- Refresh page: Fluid Basis Task Window must not auto-open.
- Open Fluid Basis from ribbon and Process menu.
- Water at 25 deg C: confirm density, dynamic viscosity, kinematic viscosity, vapor pressure, specific gravity, specific weight, specific volume, vapor pressure head, and speed of sound.
- Change Water temperature to 20, 40, and 60 deg C: automatic properties, dependency chain, and equation steps must update.
- Custom Basic and Advanced: manual density, viscosity, vapor pressure, and bulk modulus must update derived formulas.
- Help > Fluid Properties > Property Source Map: status and references must match the audit status above.
- Help > Fluid Properties > NPSH Relevance & Academic Notes: notes must avoid unsupported final claims and label engineering/needs-verification items.
- Tablet landscape: Dependency Chain and Equation Steps must dock horizontally at the bottom canvas.
- Regression: pump chart modal, toolbar/palette, add equipment, `updateSimulation()`, and `drawConnections()` must continue to work.

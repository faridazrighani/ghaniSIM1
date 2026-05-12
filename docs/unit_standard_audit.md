# Unit Standard and Quantity Registry Audit

## Summary

This change adds a project-level Unit Standard setting tied to Fluid Basis confirmation. The simulation engine still uses the existing internal calculation basis for backward compatibility:

- Pressure: bar
- Temperature: deg C
- Flow: m3/h
- Mass flow: kg/h
- Head/elevation/length: m
- Diameter/roughness: m
- Power: kW
- Fluid properties: kg/m3, cP, cSt, bar a, kJ/kg.K, GPa, m3/kg, N/m3, m/s

The UI can display and accept values in three standard profiles:

- Metric / European Engineering
- SI / International
- US Customary

## Quantity Registry

The registry is implemented in `core/unit-system.js`. It maps physical quantities to internal units and display units per selected standard.

| Quantity | Internal Unit | Metric / European | SI / International | US Customary |
|---|---:|---:|---:|---:|
| Pressure | bar | bar | kPa | psi |
| Absolute pressure | bar a | bar a | kPa a | psia |
| Gauge pressure | bar g | bar g | kPa g | psig |
| Temperature | deg C | deg C | deg C | deg F |
| Density | kg/m3 | kg/m3 | kg/m3 | lb/ft3 |
| Volumetric flow | m3/h | m3/h | m3/s | gpm |
| Mass flow | kg/h | kg/h | kg/s | lb/h |
| Head/elevation | m | m | m | ft |
| Diameter | m | mm | m | in |
| Roughness | m | mm | m | in |
| Power | kW | kW | kW | hp |
| Specific heat | kJ/kg.K | kJ/kg.K | J/kg.K | Btu/lb.F |
| Bulk modulus | GPa | GPa | MPa | psi |
| Specific volume | m3/kg | m3/kg | m3/kg | ft3/lb |
| Specific weight | N/m3 | N/m3 | N/m3 | lbf/ft3 |
| Speed | m/s | m/s | m/s | ft/s |

## Pressure Basis Separation

Pressure basis remains a separate semantic choice from unit conversion:

- Gauge pressure values are displayed as bar g, kPa g, or psig.
- Absolute pressure values are displayed as bar a, kPa a, or psia.
- Pressure drops/residuals are displayed as bar, kPa, or psi.

The conversion does not add atmospheric pressure when changing display units. Gauge-to-absolute conversion remains owned by existing pressure basis logic such as `getNodeAbsolutePressureBar()`.

## Pump Curve Units

Pump curve storage remains internal:

- Flow points: m3/h
- Head/NPSHr points: m

The advanced pump curve table displays and accepts:

- Metric / European: m3/h and m
- SI: m3/s and m
- US: gpm and ft

The pump chart axes are relabeled and plotted using the selected display units while keeping the stored curve data unchanged.

## Pipe DN/NPS Handling

Pipe schedule presets now include combined DN/NPS labels for common Sch 40 sizes, while older NPS labels are preserved for backward compatibility. The stored diameter remains internal meter ID.

Pipe segment table display units follow the selected profile:

- Metric / European: ID and roughness in mm
- SI: ID and roughness in m
- US: ID and roughness in in

## Instrument Toolbar and PTF Readout

The Instrument toolbar item labels (`PTF`, `LIC`) are symbolic equipment/tool labels, so they do not change with Unit Standard. The instrument properties and live readouts do change:

- PTF pressure readout: bar a, kPa a, or psia
- PTF temperature readout: deg C or deg F
- PTF flow readout: m3/h, m3/s, or gpm
- Instrument ranges remain stored internally and are converted at input/display boundaries

The canvas PTF readout is refreshed when Unit Standard changes so existing monitors update without needing to detach or recreate them.

The Instrument Object Task Window now includes `Calculation Trace / Step-by-step Report`:

- PTF trace shows attached pipe, tap location, live pressure, flow, temperature, and signal span equations.
- Pressure tap calculation uses pipe endpoint pressure interpolation when inlet/outlet pressure is available; otherwise it reports the available pipe pressure snapshot.
- Flow readout uses the hydraulic pipe/pump flow snapshot.
- Temperature readout uses the active Fluid Basis temperature.
- LIC trace reports controller set point/output mode and is explicitly marked as a controller trace, not a hydraulic pressure-drop calculation.
- Trace result badges and readout cards use the selected Unit Standard; formulas/substitution text documents the internal calculation basis for auditability.

## SRC Toolbar and Source Boundary Trace

The SRC toolbar item label (`Source`) and object tag (`SRC-100`) are symbolic identifiers, so they do not change with Unit Standard. The Source Object Task Window values do change:

- Boundary pressure input: bar g/bar a, kPa g/kPa a, or psig/psia depending on pressure basis.
- Calculated absolute pressure: bar a, kPa a, or psia.
- Source elevation, pressure head, velocity head, and source hydraulic head: m or ft.
- Volumetric flow: m3/h, m3/s, or gpm.
- Mass flow: kg/h, kg/s, or lb/h.
- Temperature and effective Fluid Basis properties follow the selected Unit Standard.

The SRC Object Task Window now includes `Calculation Trace / Step-by-step Report`:

- Dependency Chain lists the data path from source type, boundary data source, pressure basis, density, flow input, and connection style into source hydraulic head and pump NPSHA.
- Source role shows whether the selected source type is a dashed semantic attachment boundary or a solid hydraulic boundary/tie-in.
- Boundary pressure trace shows `Pabs = Pgauge + Patm` or direct absolute pressure input.
- Source elevation trace shows manual SRC elevation or inherited tank/vessel liquid-level elevation.
- Flow conversion trace shows `Q = massFlow / density` or `massFlow = Q x density`.
- External Header / Pipe Tie-in trace shows velocity head only for Static Pressure basis.
- Hydraulic traversal trace states that dashed SRC attachment is excluded from the hydraulic graph and warns when no real pipe path exists to pump suction.

## Vessel H Toolbar and Calculation Trace

The Vessel H toolbar item label (`Vessel H`) and generated object tag (`VES-100`) are symbolic identifiers, so they do not change with Unit Standard. The Vessel H Object Task Window values do change:

- Vessel pressure input: bar g/bar a, kPa g/kPa a, or psig/psia.
- Calculated absolute pressure: bar a, kPa a, or psia.
- Pressure drop: bar, kPa, or psi.
- Base/liquid/nozzle elevations and pressure-drop head: m or ft.
- Solved vessel flow: m3/h, m3/s, or gpm.
- Hydraulic inlet/outlet flow, total SRC feed flow, inlet flow, outlet flow, and net flow: m3/h, m3/s, or gpm.
- Residence holdup: m3 or ft3.
- Density and vapor pressure readouts follow the active Fluid Basis display units.

Unit Standard changes now explicitly refresh all Vessel H readouts and calculation-trace bodies, so an already-open Vessel H report is not dependent on the object remaining selected.

The Vessel H Object Task Window now includes `Calculation Trace / Step-by-step Report`:

- Dependency Chain lists pressure basis, liquid level, nozzle elevation, pressure-drop head, solved flow, Vessel H flow balance, residence holdup, Fluid Basis density/vapor pressure, and SRC inheritance behavior.
- Equation Steps show absolute pressure, liquid surface elevation, nozzle elevation basis, outlet submergence, pressure-drop head, solved flow basis, hydraulic inlet/outlet flow, total SRC feed flow, net flow, level trend, and residence holdup.
- Flow Balance shows `Inlet Flow`, `Outlet Flow`, `Total SRC Feed Flow`, `Net Flow`, `Level Trend`, and `SRC Feed Flow Breakdown`. Dashed SRC feed rows are inventory/source-feed rows only, not hydraulic pressure-loss paths.
- Standard Example Values show editable starting numbers for new Vessel H objects: base elevation 6 m, liquid level offset 3 m, inlet nozzle 3 m, outlet nozzle 1 m, vessel pressure 0.1 bar g, pressure drop 0.1 bar, and residence time 5 min.
- References identify the local fluid-mechanics/NPSH PDFs plus NIST standard-atmosphere and Fluid Basis data sources.

## Vessel V Toolbar and Calculation Trace

The Vessel V toolbar item label (`Vessel V`) and generated object tag (`VES-100`) are symbolic identifiers, so they do not change with Unit Standard. The Vessel V Object Task Window values do change through the shared vessel readout/trace path:

- Vessel pressure input: bar g/bar a, kPa g/kPa a, or psig/psia.
- Calculated absolute pressure: bar a, kPa a, or psia.
- Pressure drop: bar, kPa, or psi.
- Base/liquid/nozzle elevations and pressure-drop head: m or ft.
- Solved vessel flow: m3/h, m3/s, or gpm.
- Hydraulic inlet/outlet flow, total SRC feed flow, inlet flow, outlet flow, and net flow: m3/h, m3/s, or gpm.
- Residence holdup: m3 or ft3.
- Density and vapor pressure readouts follow the active Fluid Basis display units.

Unit Standard changes explicitly refresh all Vessel V readouts and calculation-trace bodies through the shared vessel refresh path.

The Vessel V Object Task Window now includes object-specific `Calculation Trace / Step-by-step Report`:

- Input Basis identifies `Vessel V / Vertical Vessel` and `Vertical` orientation.
- Dependency Chain lists pressure basis, liquid level, nozzle elevation, pressure-drop head, solved flow, Vessel V flow balance, residence holdup, Fluid Basis density/vapor pressure, and SRC inheritance behavior.
- Equation Steps show absolute pressure, liquid surface elevation, nozzle elevation basis, outlet submergence, pressure-drop head, solved flow basis, hydraulic inlet/outlet flow, total SRC feed flow, net flow, level trend, and residence holdup.
- Flow Balance shows `Inlet Flow`, `Outlet Flow`, `Total SRC Feed Flow`, `Net Flow`, `Level Trend`, and `SRC Feed Flow Breakdown`. Dashed SRC feed rows are inventory/source-feed rows only, not hydraulic pressure-loss paths.
- Standard Example Values show editable starting numbers for new Vessel V objects: base elevation 4 m, liquid level offset 5 m, inlet nozzle 8 m, outlet nozzle 4.8 m, vessel pressure 0.15 bar g, pressure drop 0.08 bar, residence time 8 min, and vertical orientation.
- References identify the local fluid-mechanics/NPSH PDFs plus NIST standard-atmosphere and Fluid Basis data sources.

## Heat Exchanger Toolbar and Calculation Trace

The Heat Exchanger toolbar item label (`Exchanger`) and generated object tag (`E-100`) are symbolic identifiers, so they do not change with Unit Standard. The Heat Exchanger Object Task Window values do change:

- Duty input and calculated duty: kW or hp.
- Pressure drop: bar, kPa, or psi.
- Pressure-drop head and NPSH loss contribution: m or ft.
- Fluid Basis inlet temperature, outlet temperature, and delta T: deg C or deg F.
- Solved exchanger flow: m3/h, m3/s, or gpm.
- Mass flow: kg/h, kg/s, or lb/h.
- Fluid density, specific heat, and vapor pressure follow the active Fluid Basis display units.

Unit Standard changes explicitly refresh Heat Exchanger readouts and calculation-trace bodies.

The Heat Exchanger Object Task Window now includes `Calculation Trace / Step-by-step Report`:

- Dependency Chain lists active Fluid Basis density, pressure drop, solved hydraulic connection flow, mass-flow conversion, specific heat, outlet temperature, and pump suction path role.
- Equation Steps show pressure-drop sanitization, pressure-drop head, temperature change, hydraulic flow basis, mass flow, thermal duty from flow, duty residual, and NPSH loss contribution.
- NPSH Role shows whether the exchanger is in a pump suction path; only suction-side exchanger pressure drop subtracts from NPSHA.
- References identify local fluid-mechanics/NPSH PDFs plus NIST thermophysical property sources and NASA Bernoulli guidance.

## Pipe, Fitting, Valve, Control Valve, and Check Valve Trace

Pipe/Fitting:

- Pipe fittings are modeled as pipe-segment K values, not as a separate standalone object.
- Pipe trace now includes `Dependency Chain`, showing flow -> velocity/Re/f -> major loss, fitting K -> minor loss, high-point vapor margin, and suction-path NPSHA effect.
- Pipe trace display follows the active unit standard through the existing readout formatter.

Valve/Control Valve/Check Valve:

- Valve, Control Valve, and Check Valve Object Task Window now includes `Calculated Valve Readout`, `Calculation Trace / Step-by-step Report`, `NPSH Role`, `Dependency Chain`, and `Equation Steps`.
- Control Valve is available as a Valve Type and adds `Control Valve Sizing / NPSH Focus` with Cv input, effective Cv, opening, pressure drop, head loss, and NPSH loss contribution.
- Unit-standard refresh now calls Valve readout and trace refresh hooks.
- Validated display changes include Metric / European Engineering (`m3/h`, `bar`, `m`, `mm`), SI / International (`m3/s`, `kPa`, `m`), and US Customary (`gpm`, `psi`, `ft`, `in`, `lb/ft3`).

Audit/test coverage:

- `docs/pipe_fitting_valve_npsh_audit.md`
- `tests/pipe-validation.cjs`
- `tests/valve-trace-validation.cjs`

## Saved Project Migration

Saved projects that already contain `model.SETTINGS` preserve their stored unit standard and confirmation state.

Legacy projects without `model.SETTINGS` are migrated by adding default settings:

- Unit standard: Metric / European Engineering
- Basis confirmed: true
- Migrated from legacy: true

This avoids blocking older saved files that were already modeled before the Unit Standard requirement existed.

## Startup Behavior

New/default projects start with unconfirmed Fluid Basis and Unit Standard. The Fluid Basis Task Window opens at startup so the user can confirm:

- Fluid Basis
- Temperature
- Unit Standard

Adding equipment is blocked until the basis is confirmed. If the user changes Fluid Basis or Unit Standard after confirmation, the basis is marked dirty and must be reconfirmed.

## Verification Tests

Added `tests/unit-system-validation.cjs` for conversion and state checks:

- Default unit standard and unconfirmed basis
- bar to kPa and psi basis conversions
- deg C to deg F conversion
- m3/h to m3/s and gpm conversion
- m to ft conversion
- m to inch conversion for diameter
- kW to hp conversion
- Basis confirmation and dirty-state behavior
- Pressure field quantity inference
- Instrument/toolbar PTF display unit conversion
- SRC/source boundary trace unit conversion and semantic/hydraulic path reporting
- Vessel H toolbar/task-window trace unit conversion and pressure/elevation/holdup reporting
- Vessel V toolbar/task-window trace unit conversion and pressure/elevation/holdup reporting
- Heat Exchanger toolbar/task-window trace unit conversion, pressure-drop head, heat duty, and NPSH contribution reporting
- Pipe/Fitting Dependency Chain and NPSH suction-loss reporting through `tests/pipe-validation.cjs`
- Valve/Control Valve/Check Valve K, Cv, effective Cv, cracking pressure, NPSH contribution, Control Valve focus rendering, and US unit rendering through `tests/valve-trace-validation.cjs`

## Remaining Audit Notes

This is a UI/unit conversion layer. It does not change the hydraulic solver equations. The following items should remain part of final regression review:

- Confirm every custom readout section uses the display helper rather than hardcoded text.
- Confirm project load/save round trip keeps `SETTINGS`.
- Confirm pump chart values match the selected unit standard.
- Confirm pipe segment edited values round-trip to internal meter units.
- Confirm PTF attached to a live pipe reads converted values after changing Unit Standard.
- Vessel H trace remains a simplified hydraulic/process boundary; detailed separator sizing and ASME mechanical pressure-vessel checks remain outside the current model until references and formulas are added.
- Vessel V trace remains a simplified hydraulic/process boundary; detailed vertical separator sizing and ASME mechanical pressure-vessel checks remain outside the current model until references and formulas are added.
- Heat Exchanger trace remains a simplified fixed-pressure-drop and sensible-heat consistency model; detailed UA/LMTD/NTU, fouling, shell/tube-side split, phase change, and mechanical exchanger rating remain outside the current model until references and formulas are added.

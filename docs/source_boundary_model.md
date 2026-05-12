# SRC Boundary Model

Date: 2026-05-10

## Summary

`SRC` is a hydraulic boundary condition. It is not a physical equipment item and it is not a pipe. The SRC object defines the upstream boundary state used by hydraulic and NPSH calculations. Actual flow must be carried by solid hydraulic connections such as pipe, valve, fitting, equipment ports, and pump suction/discharge ports.

The model intentionally separates:

- Semantic attachment: dashed connection used only to attach SRC to a tank or vessel for boundary data inheritance.
- Hydraulic connection: solid pipe/hydraulic path used for flow, pressure loss, elevation change, and pump/NPSH calculations.

Dashed SRC attachment is never included in the hydraulic graph and does not create pressure drop.

## Source Type Rules

| Source Type | Meaning | Connection rule |
| --- | --- | --- |
| Open Tank / Reservoir | Boundary from tank/reservoir liquid surface | May use dashed attachment to tank/vessel; real flow still requires pipe from equipment outlet |
| Pressurized Vessel | Boundary from pressurized vessel liquid surface | May use dashed attachment to tank/vessel; real flow still requires pipe from vessel outlet |
| External Header / Pipe Tie-in | Boundary from an upstream pipe/header | Must connect through a solid hydraulic pipe/component |
| Fixed Flow Source | User-specified mass or volumetric flow boundary | Must connect through a solid hydraulic pipe/component |
| Standalone Boundary Source | Manual simplified boundary source | Must connect through a solid hydraulic pipe/component |

`Boundary Data Source = Inherit from Attached Equipment` is only valid when the SRC is an Open Tank / Reservoir or Pressurized Vessel dashed-attached to a tank/vessel. Other source types force `Manual`.

## Required Data For Correct Pump Suction Calculation

Minimum boundary data:

- Active Fluid Basis at the selected temperature.
- Density for pressure/head conversion and mass/volumetric flow conversion.
- Viscosity for Reynolds number and pipe/valve friction loss.
- Vapor pressure for NPSH vapor pressure head.
- Source absolute pressure, or gauge pressure plus atmospheric pressure conversion.
- Source elevation:
  - liquid level elevation for tank/vessel sources,
  - tie-in elevation for external headers,
  - manual source elevation for standalone/fixed sources.
- Pump suction elevation.
- Solid hydraulic path data: pipe length, diameter, roughness, fittings/K, valve losses, start/end elevations, and optional high point elevation.

## NPSHA Calculation Basis

For reservoir/tank/vessel boundary conditions:

```text
NPSHA = (Pabs_source - Pv) / (rho * g)
      + (z_source - z_pump_suction)
      - hL_suction
```

Where:

- `Pabs_source` is the absolute pressure at the source liquid surface or inherited vessel/tank pressure.
- `Pv` is vapor pressure from Fluid Basis at the active temperature.
- `rho` is Fluid Basis density.
- `z_source` is liquid level elevation for tank/vessel cases.
- `z_pump_suction` is pump suction nozzle/datum elevation.
- `hL_suction` is the head loss through real suction path components.

For External Header / Pipe Tie-in:

- Static pressure basis adds velocity head once to form total hydraulic head.
- Total/Stagnation pressure basis already includes velocity head and must not add it again.
- Pump Equation Steps display this as `Source Velocity Head`, so the trace matches the realtime NPSHA calculation.

Gauge pressure uses the standard atmosphere constant:

```text
Pabs = Pgauge + 1.01325 bar
```

## Validation Rules

The application should warn when:

- SRC is dashed-attached to a tank/vessel but no solid hydraulic path exists from equipment outlet to pump suction.
- External Header, Fixed Flow Source, or Standalone Boundary Source has no solid hydraulic connection.
- Dashed attachment exists for a source type that requires solid hydraulic connection.
- SRC pressure and attached equipment pressure conflict.
- Pump suction elevation or source elevation is missing.
- Attached tank/vessel has no liquid level elevation.
- SRC custom temperature cannot recalculate fluid properties.
- Flow, downstream pressure, and pump curve are all fixed; calculation reports residual head/pressure.
- Pipe high point pressure may fall below vapor pressure or a minimum pressure limit.

## Local References

- `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf`
  - NPSHA is total suction head absolute at the pump datum less vapor pressure head.
  - Appendix A describes atmospheric pressure head, vapor pressure head, suction velocity head, elevation, and suction head loss.
- `pdf_ref/ref2-introduction-fluid-mechanics.pdf`
  - NPSH example applies steady incompressible energy equation from reservoir level to pump suction.
  - It treats large reservoir surface velocity as negligible and includes suction losses.
- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`
  - Defines fluid properties including density, viscosity, vapor pressure, and cavitation risk when local pressure drops below vapor pressure.
- `pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf`
  - Provides cavitation and centrifugal pump context, including NPSHA at pump inlet and NPSHR as pump requirement.

## External References

- NIST Chemistry WebBook SRD 69, Thermophysical Properties of Fluid Systems: https://webbook.nist.gov/chemistry/fluid/
- NIST Guide to the SI, Appendix B, standard atmosphere conversion: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors
- NASA Glenn Research Center, Bernoulli's Equation: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoullis-equation/

## Implementation Notes

- `sourceLinks` stores semantic dashed attachments.
- `connections` stores hydraulic pipe connections.
- Hydraulic traversal filters out semantic links and only traverses solid hydraulic connections.
- If an Open Tank / Reservoir or Pressurized Vessel SRC has a direct solid SRC-to-tank/vessel pipe from an older state, the app converts that direct connection into a dashed `sourceLink` and removes the pipe from hydraulic traversal.
- If an External Header / Pipe Tie-in, Fixed Flow Source, or Standalone Boundary Source has a stale dashed attachment, the app converts it into a direct solid hydraulic pipe connection and forces boundary data back to `Manual`.
- SRC properties are dynamic:
  - semantic source types show attachment controls,
  - hydraulic source types show solid pipe connection controls.

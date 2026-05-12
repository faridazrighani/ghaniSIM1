# Clean NPSH Validation Tests

These tests are clean thesis-oriented checks. They do not use legacy saved cases.

Run:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests\npsh-validation.cjs
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests\pipe-validation.cjs
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests\source-boundary-validation.cjs
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests\source-ui-rules.cjs
```

The validation checks the NPSH evaluation logic against direct hand-equation calculations:

- pressure basis conversion: `P_abs = P_gauge + P_atm`
- Darcy-Weisbach pipe loss: `h_f = f (L/D) V^2 / 2g`
- valve/fitting minor loss: `h_m = K V^2 / 2g`
- vapor pressure head subtraction
- NPSHa response when suction valve loss increases
- NPSHr source handling: manual input, basic estimate, and manufacturer/test curve
- incomplete status when no upstream SRC is connected

The SRC boundary validation checks:

- dashed SRC attachment is semantic only and is excluded from hydraulic traversal
- attached tank/vessel boundaries inherit pressure and liquid level elevation
- standalone SRC can still connect through a real hydraulic pipe path
- external header static pressure adds velocity head once, while total/stagnation pressure does not add it again
- NPSHA uses source liquid level elevation minus pump suction elevation
- pipe high point pressure warnings are reported when local pressure may fall below vapor pressure/minimum pressure
- fixed SRC flow plus downstream pressure boundary reports residual head as an over-specified system
- SRC UI/model rules allow dashed semantic attachment only to tank/vessel; pump/valve attachment is rejected, and External Header forces Manual boundary data
- Vessel H trace reports pressure basis, liquid/nozzle elevation, pressure-drop head, residence holdup, unit conversion, and local/external reference basis

The pipe validation checks:

- Darcy-Weisbach major loss and K-based minor loss
- multi-segment total head loss
- Reynolds flow regime thresholds and transitional flow warnings
- aging roughness factor and head loss allowance
- Elevation Profile mode behavior
- per-segment elevation profile, high point vapor margin, and warning
- roughness/fitting source status metadata
- Realtime Calculation Trace / Step-by-step Report with formula, substitution, result, and reference rows
- Pipe Object Properties task-window behavior, including minimize/restore controls
- sidebar pressure/unit labels, allowance, effective roughness, and Darcy friction factor label

Literature basis:

- Fluid Mechanics Fundamentals and Applications: vapor pressure/cavitation and NPSH discussion.
- Fox and McDonald's Introduction to Fluid Mechanics: energy equation, Darcy friction factor, Moody chart, minor loss coefficient, and NPSH examples.
- Hydraulic Institute ANSI/HI 9.6.1 concept: NPSHA is system available NPSH; NPSHR is pump/manufacturer required NPSH.

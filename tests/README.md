# Clean NPSH Validation Tests

These tests are clean thesis-oriented checks. They do not use legacy saved cases.

Run:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests\npsh-validation.cjs
```

The validation checks the NPSH evaluation logic against direct hand-equation calculations:

- pressure basis conversion: `P_abs = P_gauge + P_atm`
- Darcy-Weisbach pipe loss: `h_f = f (L/D) V^2 / 2g`
- valve/fitting minor loss: `h_m = K V^2 / 2g`
- vapor pressure head subtraction
- NPSHa response when suction valve loss increases
- NPSHr source handling: manual input, basic estimate, and manufacturer/test curve
- incomplete status when no upstream SRC is connected

Literature basis:

- Fluid Mechanics Fundamentals and Applications: vapor pressure/cavitation and NPSH discussion.
- Fox and McDonald's Introduction to Fluid Mechanics: energy equation, Darcy friction factor, Moody chart, minor loss coefficient, and NPSH examples.
- Hydraulic Institute ANSI/HI 9.6.1 concept: NPSHA is system available NPSH; NPSHR is pump/manufacturer required NPSH.

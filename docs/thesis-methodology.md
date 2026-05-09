# Thesis Methodology Notes

## Scope

This application is positioned as an academic NPSH-based cavitation evaluation tool for centrifugal pump systems. It is not claimed as a full industrial hydraulic network simulator.

The main evaluation chain is:

```text
Fluid properties -> suction system losses -> NPSHa -> NPSHr comparison -> cavitation status
```

## NPSHr Handling

NPSHr is treated as a pump-side requirement, not as a value predicted purely from the hydraulic system. This distinction is important for thesis defensibility because NPSHa is calculated from system conditions, while NPSHr is a pump characteristic normally obtained from manufacturer or test data.

The application supports three NPSHr sources:

```text
Manual
Estimated
Manufacturer/Test Curve
```

### Manual

Manual NPSHr uses the value entered by the user directly:

```text
NPSHr = user input
```

This mode is suitable when the user has a datasheet value, textbook example value, or a manual validation case. The output label is:

```text
NPSHr Source = Manual input
```

### Estimated

Estimated NPSHr uses the Basic pump model as an approximate curve. This mode is useful for preliminary conceptual studies only. It is not treated as manufacturer/test data. The output label is:

```text
NPSHr Source = Estimated basic curve
```

### Manufacturer/Test Curve

Manufacturer/Test Curve mode is used in Advanced pump input mode. The user enters tabulated pump data:

```text
Flow | Head | Efficiency | NPSHr
```

The application interpolates NPSHr at the evaluated flow. The output label is:

```text
NPSHr Source = Manufacturer/test curve
```

## Thesis Limitation Statement

The application does not predict NPSHr from the internal impeller geometry or manufacturer proprietary pump test methods. NPSHr is handled as pump-characteristic data supplied manually, estimated for preliminary study, or interpolated from user-entered manufacturer/test curves.

For final academic validation, Manual or Manufacturer/Test Curve NPSHr should be preferred over Estimated NPSHr.

---
description: Standards and steps for ensuring GEDCOM 7.0 compliance in Heritago
---

# GEDCOM 7.0 Compliance Workflow

This document outlines the mandatory standards for all backend and frontend changes related to genealogical data in the Heritago project. **Strict adherence to the FamilySearch GEDCOM 7.0 specification is required.**

## 1. Principles
- **No Variations**: Always use the tags and structures defined in the `gedcom_specification/` folder.
- **V7 Only**: Do not use deprecated tags from GEDCOM 5.5.1 (e.g., `CONC`, `ROMAN` calendars).
- **UTF-8**: All data must be UTF-8 encoded.

## 2. Mandatory Structures

### Individuals (INDI)
- **Names**: Use structured pieces (`GIVN` for given name, `SURN` for surname).
- **Birth Names**: If a birth name (maiden name) is present, add a secondary `NAME` record with `2 TYPE BIRTH`.
- **Gender**: Supported values are `M` (Male), `F` (Female), `X` (Other), and `U` (Unknown).
- **Email**: Must be placed under a `RESI` (Residence) structure:
  ```gedcom
  1 RESI
  2 EMAIL example@example.com
  ```
- **Events (BIRT, DEAT)**: Use the `Y` payload if the event occurred but details are partial.
  ```gedcom
  1 BIRT Y
  2 DATE 17 FEB 2026
  ```

### Dates
- **Format**: All dates must be formatted as `[day] MON YYYY` (e.g., `17 FEB 2026`).
- **Months**: Use standard 3-letter uppercase English tags (`JAN`, `FEB`, `MAR`, `APR`, `MAY`, `JUN`, `JUL`, `AUG`, `SEP`, `OCT`, `NOV`, `DEC`).

## 3. Implementation Steps

### Backend Changes
1. When modifying `ApiPersonHandler.php` or `TreeDataHandler.php`, ensure the regex patterns and GEDCOM generation strings match the rules above.
2. Use the `formatGedcomDate()` helper systematically.

### Frontend Changes
1. Ensure the `Individual` interface in `models.ts` supports the required fields.
2. The UI must provide options for all 4 gender types (`M`, `F`, `X`, `U`).

## 4. Verification
- Validate generated GEDCOM strings against the documentation in `gedcom_specification/gedcom-1-hierarchical-container-format.md`.

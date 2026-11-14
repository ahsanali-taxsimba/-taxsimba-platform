# Runtime state (not redeployed)

Writable overlays used by:

- HMRC / GOV.UK knowledge monitor (snapshots, quarantine, published facts, history, alerts)
- TaxSimba package catalogue sync (live overlay + history)

Committed baseline corpus/catalogue under `../corpus` and `../catalog` remain the boot defaults.
Published overlays here are applied at runtime without rebuilding the Node image.

Do not commit secrets. Quarantined facts never serve customers until accountant approval.

# P0 K.8 — Admin additional-work payment requests

- Case detail (`manage-tax/[taxReturnId]` overview): **AdditionalWorkPanel** mounted for Admin/Super Admin create/list/resend/cancel (`data-testid=additional-work-panel`)
- Client billing (`/dashboard/billing-history`): AdditionalWorkClientPanel pay + receipt
- Notify deep links: `/dashboard/billing-history` (was `/subscription`)
- Resend marks prior unread reminders read so reminder email always sends
- Payments list shows AW + service txs via `GET /admin/payments`
- stats/export/by-user remain deferred (405)
- SUPER_ADMIN treated as admin for create UI (`isAdminRole`)
- Currency: GBP (server-fixed); shown in create form

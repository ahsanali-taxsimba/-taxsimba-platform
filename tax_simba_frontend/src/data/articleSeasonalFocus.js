export function getSeasonalFocus(now=new Date()) {
 const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(d>='2026-09-01'&&d<='2026-11-07')return {title:'Preparing for the next MTD update?',body:'Check signup, cumulative records and the 7 November 2026 update. Choose the guide that matches your next task.',links:[['hmrc-signed-me-up-for-making-tax-digital','HMRC signed me up: what next?'],['mtd-quarterly-deadline-7-november-2026','Prepare for 7 November 2026'],['mtd-cumulative-quarterly-updates','Check cumulative totals']]};
 if(d>='2026-11-08'&&d<='2027-01-31')return {title:'Keep the earlier return and current MTD work separate',body:'Check any outstanding update and the usual 31 January 2027 online return deadline. Your HMRC notice determines the applicable filing date.',links:[['missed-mtd-quarterly-update','Catch up an outstanding MTD update'],['self-assessment-2025-26-mtd-2026-27','Which year does each job cover?'],['self-assessment-accountant-cost','Compare the full return service']]};
 return null;
}

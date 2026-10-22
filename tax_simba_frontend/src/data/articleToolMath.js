// Pure arithmetic only. These helpers do not determine tax liability or eligibility.
export function nonNegativeAmount(value) {
  if (String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100000000 ? n : null;
}
export function quoteTotal({ recurring, payments, setup, extras, vatPercent }) {
  const values = [recurring, payments, setup, extras, vatPercent].map(nonNegativeAmount);
  if (values.some(v => v === null)) return null;
  const [r,p,s,e,v] = values;
  if (!Number.isInteger(p) || p > 120 || v > 100) return null;
  return Math.round((r*p+s+e)*(1+v/100)*100)/100;
}
export function cumulativeTotals(previousIncome, previousExpenses, newIncome, newExpenses, correctionIncome, correctionExpenses) {
  const values=[previousIncome,previousExpenses,newIncome,newExpenses].map(nonNegativeAmount);
  const corrections=[correctionIncome,correctionExpenses].map(v => String(v).trim()===''?NaN:Number(v));
  if(values.some(v=>v===null)||corrections.some(v=>!Number.isFinite(v)||Math.abs(v)>100000000))return null;
  const income=values[0]+values[2]+corrections[0];const expenses=values[1]+values[3]+corrections[1];
  if(income<0||expenses<0)return null;
  return {income:Math.round(income*100)/100,expenses:Math.round(expenses*100)/100};
}
export function propertyDeadline(isoDate) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(isoDate))return null;
  const d=new Date(isoDate+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==isoDate||isoDate<'2021-10-27')return null;
  d.setUTCDate(d.getUTCDate()+60);return d.toISOString().slice(0,10);
}

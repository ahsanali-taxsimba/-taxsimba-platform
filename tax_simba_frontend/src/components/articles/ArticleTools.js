"use client";
import {useState} from 'react';
import {quoteTotal,cumulativeTotals,propertyDeadline} from '@/data/articleToolMath';
import styles from './ArticleTools.module.css';
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
function Amount({label,value,onChange,signed=false,integer=false}){return <label className={styles.field}>{label}<input type="number" min={signed?undefined:0} step={integer?'1':'0.01'} inputMode={integer?'numeric':'decimal'} value={value} onChange={e=>onChange(e.target.value)}/></label>}
function QuoteCalculator(){
 const blank={recurring:'',payments:'12',setup:'0',extras:'0',vatPercent:'0'};
 const [quotes,setQuotes]=useState([{...blank},{...blank}]);
 const set=(i,key,value)=>setQuotes(old=>old.map((q,n)=>n===i?{...q,[key]:value}:q));
 const totals=quotes.map(quoteTotal);
 return <section className={styles.tool} aria-labelledby="quote-tool"><h2 id="quote-tool">Compare the full cost of two quotes</h2><p>Use the same service period and included work. Enter charges before VAT; choose 0% if the amounts already include it. Use zero for a charge only when you know it does not apply.</p><div className={styles.grid}>{quotes.map((q,i)=><fieldset key={i}><legend>Quote {i+1}</legend><Amount label="Recurring payment (£)" value={q.recurring} onChange={v=>set(i,'recurring',v)}/><Amount label="Number of payments" integer value={q.payments} onChange={v=>set(i,'payments',v)}/><Amount label="Setup charge (£)" value={q.setup} onChange={v=>set(i,'setup',v)}/><Amount label="Other agreed charges (£)" value={q.extras} onChange={v=>set(i,'extras',v)}/><Amount label="VAT to add (%)" value={q.vatPercent} onChange={v=>set(i,'vatPercent',v)}/><p><strong>Total: {totals[i]===null?(q.recurring===''?'Add the quote amounts':'Check the amounts'):money(totals[i])}</strong></p></fieldset>)}</div><p role="status">{totals.every(t=>t!==null)?(totals[0]===totals[1]?'The entered totals are equal.':`Quote ${totals[0]<totals[1]?1:2} is ${money(Math.abs(totals[0]-totals[1]))} lower for the amounts entered.`):'Enter both recurring payments to compare totals.'}</p><p className={styles.note}>Arithmetic only. A lower price does not establish equivalent work. Split mixed VAT rates into separate calculations. Nothing you enter here is sent to TaxSimba or saved by this tool.</p></section>
}
function CumulativeCalculator(){
 const [v,setV]=useState(['12000','3000','15000','4000','0','-240']);
 const labels=['Previous cumulative income (£)','Previous cumulative expenses (£)','New income in this period (£)','New expenses in this period (£)','Correction to earlier income (£, signed)','Correction to earlier expenses (£, signed)'];
 const total=cumulativeTotals(...v);
 return <section className={styles.tool} aria-labelledby="cumulative-tool"><h2 id="cumulative-tool">Try a cumulative update with a correction</h2><p>The starting example removes a £240 personal payment from earlier expenses. A minus sign reduces the earlier figure. Enter only the new period’s activity in the middle two fields.</p><div className={styles.grid}>{labels.map((label,i)=><Amount key={label} label={label} signed={i>3} value={v[i]} onChange={value=>setV(old=>old.map((x,n)=>n===i?value:x))}/>)}</div><p role="status">{total?`Illustrative cumulative income: ${money(total.income)}. Cumulative expenses: ${money(total.expenses)}.`:'Enter valid amounts; the resulting cumulative totals cannot be negative in this illustration.'}</p><p className={styles.note}>This demonstrates the arithmetic, not allowable expenses, software filing or your tax bill. A correction already included in the starting totals must not be entered again. Nothing entered is sent or saved by this tool.</p></section>
}
function DeadlineCalculator(){
 const [date,setDate]=useState('');const result=propertyDeadline(date);
 const readable=result?new Date(result+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):null;
 return <section className={styles.tool} aria-labelledby="property-tool"><h2 id="property-tool">Count 60 days from completion</h2><p>Use this only after checking that the 60-day property-reporting rule applies to your disposal. The tool counts calendar days after completion; it does not decide whether tax or a report is due.</p><label className={styles.field}>Legal completion date<input type="date" min="2021-10-27" value={date} onChange={e=>setDate(e.target.value)}/></label><p role="status">{readable?`60 days after completion: ${readable}.`:(date?'Enter a valid completion date on or after 27 October 2021.':'Enter the completion date to see the date 60 days later.')}</p><p className={styles.note}>Allow time for the calculation, account setup and payment. This does not extend a deadline or cover historic 30-day rules. Check the official reporting guidance linked below. The tool does not send or save your date.</p></section>
}
export default function ArticleTools({slug}){
 if(['mtd-accountant-cost','self-assessment-accountant-cost'].includes(slug))return <QuoteCalculator/>;
 if(['mtd-cumulative-quarterly-updates','correct-mtd-quarterly-update'].includes(slug))return <CumulativeCalculator/>;
 if(slug==='sold-rental-property-60-day-tax')return <DeadlineCalculator/>;
 return null;
}

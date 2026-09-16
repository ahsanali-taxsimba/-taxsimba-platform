export const calculatorContent = {
    "ni": {
        howItWorks: [
            "Determine your total earnings for the tax year.",
            "Check which NI class applies to you (Class 1 for employees, Class 4 for self-employed).",
            "Apply the 0% rate to earnings up to the Personal Allowance threshold (£12,570).",
            "Apply the main rate (8% for employees, 6% for self-employed) to income between £12,570 and £50,270.",
            "Apply the lower 2% rate to any earnings above the higher threshold."
        ],
        keyDetails: [
            { text: "Thresholds: The threshold for starting NI payments usually aligns with the Personal Allowance.", icon: "TbTarget" },
            { text: "Employment Type: NI rates differ significantly between employees and the self-employed.", icon: "TbBriefcase" },
            { text: "State Benefits: Your NI contributions directly impact your eligibility for the State Pension and other benefits.", icon: "TbHeartRateMonitor" }
        ],
        faqs: [
            { q: "Do I pay NI if I'm over State Pension age?", a: "No, you generally stop paying NI once you reach the State Pension age, even if you continue working." },
            { q: "Is NI the same as Income Tax?", a: "No, NI is a separate contribution used specifically to fund state benefits and the NHS." }
        ]
    },
    "combined-tax": {
        howItWorks: [
            "Combine your annual gross salary with your total self-employed revenue.",
            "Deduct any allowable business expenses from your self-employed revenue to find your profit.",
            "Apply your Personal Allowance to the combined total.",
            "Calculate Income Tax based on the progressive bands (20%, 40%, 45%).",
            "Calculate NI separately for both your employment (Class 1) and self-employment (Class 4)."
        ],
        keyDetails: [
            { text: "Progressive Tax: The more you earn in total, the more likely you are to enter higher tax bands.", icon: "TbTrendingUp" },
            { text: "Trading Allowance: If your self-employed expenses are under £1,000, you can claim the £1,000 Trading Allowance instead.", icon: "TbReceipt" },
            { text: "Self Assessment: Having multiple income streams usually requires filing a Self Assessment tax return.", icon: "TbReportMoney" }
        ],
        faqs: [
            { q: "Can I use my Personal Allowance twice?", a: "No, you only have one Personal Allowance which is applied to your total combined income." },
            { q: "How do I report my side hustle income?", a: "You must register for Self Assessment and report it annually to HMRC if you earn over £1,000." }
        ]
    },
    "salary-after-tax": {
        howItWorks: [
            "Input your gross annual salary before any deductions.",
            "Subtract your Personal Allowance to find your taxable income.",
            "Subtract calculated Income Tax based on your earnings band.",
            "Subtract Employee National Insurance contributions.",
            "The remainder is your estimated annual take-home pay."
        ],
        keyDetails: [
            { text: "Take-home Pay: This is the actual amount that hits your bank account.", icon: "TbWallet" },
            { text: "Deductions: Aside from tax and NI, your actual pay may be lower if you have pension contributions or student loans.", icon: "TbPercentage" },
            { text: "Tax Code: Your specific tax code (like 1257L) determines how much you can earn before paying tax.", icon: "TbHash" }
        ],
        faqs: [
            { q: "Why is my take-home pay different from the calculator?", a: "The calculator provides an estimate. Your actual pay may include workplace pension, student loan repayments, or company benefits." }
        ]
    },
    "income-tax": {
        howItWorks: [
            "Calculate your total taxable income from all sources.",
            "Deduct your Personal Allowance (£12,570 for 24/25).",
            "Apply the 20% Basic Rate to income up to £50,270.",
            "Apply the 40% Higher Rate to income between £50,271 and £125,140.",
            "Apply the 45% Additional Rate to income above £125,140."
        ],
        keyDetails: [
            { text: "Tax-Free Threshold: Most people don't pay tax on the first £12,570 they earn.", icon: "TbShieldCheck" },
            { text: "High Earners: Your Personal Allowance reduces by £1 for every £2 earned over £100,000.", icon: "TbTarget" },
            { text: "Progressive System: Rates only apply to the portion of income within that specific band.", icon: "TbTrendingUp" }
        ],
        faqs: [
            { q: "Does everyone get a Personal Allowance?", a: "Most UK residents do, but it disappears entirely once your income reaches £125,140." }
        ]
    },
    "pension-tax-relief": {
        howItWorks: [
            "Record your net contribution to your pension.",
            "If it's a 'Relief at Source' scheme, your provider automatically adds 20% basic rate relief.",
            "If you are a higher or additional rate taxpayer, calculate the extra relief owed to you.",
            "Claim any extra relief through your Self Assessment tax return."
        ],
        keyDetails: [
            { text: "Government Incentive: Tax relief is effectively the government returning the tax you paid on your earnings into your pension.", icon: "TbPiggyBank" },
            { text: "Annual Allowance: There are limits (usually £60,000) on how much you can contribute each year with tax relief.", icon: "TbLock" },
            { text: "Higher Rate Benefit: Higher rate taxpayers get significantly more relief but must often claim the extra portion themselves.", icon: "TbAward" }
        ],
        faqs: [
            { q: "Is there a limit to tax relief?", a: "Yes, you generally only get relief on contributions up to 100% of your annual earnings or the £60,000 annual allowance." }
        ]
    },
    "child-benefit": {
        howItWorks: [
            "Sum the weekly benefit for your first child and any additional children.",
            "Check if any parent in the household earns more than £50,000.",
            "If income is between £50,000 and £60,000, calculate the percentage of the benefit that must be repaid.",
            "If income exceeds £60,000, the charge usually equals the full benefit amount."
        ],
        keyDetails: [
            { text: "Weekly Rates: Rates are fixed per child and usually increase slightly each tax year.", icon: "TbUsers" },
            { text: "High Income Charge: The HICBC is designed to taper off the benefit for higher-earning families.", icon: "TbTrendingUp" },
            { text: "Repayment: If you are hit by the charge, you must pay it back via a Self Assessment tax return.", icon: "TbReportMoney" }
        ],
        faqs: [
            { q: "Should I still claim if I earn over £60k?", a: "Yes. Even if you have to pay the benefit back, claiming ensures you get National Insurance credits for your pension." }
        ]
    },
    "late-penalty": {
        howItWorks: [
            "Identify the deadline for your tax return (usually Jan 31st).",
            "Calculate the number of days past the deadline.",
            "Apply the initial £100 fixed penalty for being even 1 day late.",
            "After 3 months, add the daily £10 penalties.",
            "After 6 and 12 months, add the percentage-based penalties (5% of tax due)."
        ],
        keyDetails: [
            { text: "Time is Money: Penalties escalate quickly, especially after the 3-month mark.", icon: "TbClock" },
            { text: "Reasonable Excuse: HMRC may waive penalties if you have a valid reason for the delay (e.g., serious illness).", icon: "TbInfoCircle" },
            { text: "Interest: In addition to penalties, HMRC charges interest on any unpaid tax from the deadline date.", icon: "TbAlertTriangle" }
        ],
        faqs: [
            { q: "What if I can't pay my tax bill?", a: "Still file your return on time! The penalty for late filing is separate from the penalty for late payment." }
        ]
    },
    "rental-tax": {
        howItWorks: [
            "Total your annual rental income received from tenants.",
            "Subtract allowable expenses such as maintenance, insurance, and agent fees.",
            "Note that mortgage interest is no longer a direct expense but gives a 20% tax credit.",
            "Add the net profit to your other taxable income to determine the final tax rate."
        ],
        keyDetails: [
            { text: "Allowable Expenses: Only costs incurred 'wholly and exclusively' for the rental business can be deducted.", icon: "TbReceipt" },
            { text: "Mortgage Interest: For residential properties, interest is restricted to basic rate tax relief (20%).", icon: "TbPercentage" },
            { text: "Property Allowance: You can claim a £1,000 property allowance tax-free if your expenses are low.", icon: "TbHome" }
        ],
        faqs: [
            { q: "Do I pay tax if I rent out a room in my house?", a: "You might be eligible for the 'Rent a Room' scheme, which allows up to £7,500 tax-free per year." }
        ]
    },
    "cis-rebate": {
        howItWorks: [
            "Total the gross payments made to you by contractors.",
            "Check the amount of CIS tax already deducted (usually 20%).",
            "Calculate your actual tax liability based on your annual profit after expenses.",
            "The rebate is the difference between the tax already paid and your actual liability."
        ],
        keyDetails: [
            { text: "Registered Status: Being registered for CIS ensures you are taxed at 20% rather than 30%.", icon: "TbShieldCheck" },
            { text: "Construction Specific: This scheme applies specifically to subcontractors in the UK construction industry.", icon: "TbBuildingBank" },
            { text: "Refund Processing: Rebates are typically claimed after the end of the tax year via a tax return.", icon: "TbClock" }
        ],
        faqs: [
            { q: "Why do I get a rebate?", a: "Contractors deduct tax as a 'payment on account'. If your expenses or allowance reduce your tax owed, you get the overpayment back." }
        ]
    },
    "ebay-tax": {
        howItWorks: [
            "Track all revenue from platform sales.",
            "Subtract the cost of the goods sold.",
            "Subtract platform fees, payment processing fees, and shipping costs.",
            "Apply the Trading Allowance if your profit structure allows.",
            "Add the profit to your total income for tax calculation."
        ],
        keyDetails: [
            { text: "Secondary Income: HMRC treats online selling as a business if you are 'trading' (buying to sell).", icon: "TbShoppingCart" },
            { text: "Data Sharing: Platforms like eBay now report high-volume sellers' data directly to HMRC.", icon: "TbDeviceDesktop" },
            { text: "Record Keeping: Keep receipts for all postage and stock purchases to maximize deductions.", icon: "TbReceipt" }
        ],
        faqs: [
            { q: "Do I pay tax on second-hand clothes?", a: "Generally no, if you're just clearing out your wardrobe. Tax applies if you're buying items specifically to resell for profit." }
        ]
    },
    "stamp-duty": {
        howItWorks: [
            "Input the total purchase price of the property.",
            "Check if you are a first-time buyer (relief may apply).",
            "Apply the 0% rate up to the current threshold.",
            "Apply increasing tax rates (5%, 10%, 12%) to the portions of the price in different bands."
        ],
        keyDetails: [
            { text: "Property Tax: SDLT is a one-off tax paid when you buy land or property in England and Northern Ireland.", icon: "TbKey" },
            { text: "Bands: The tax is tiered, meaning you only pay the higher rates on the portion above each threshold.", icon: "TbPercentage" },
            { text: "Deadline: You usually have 14 days after completion to file a return and pay the tax.", icon: "TbCalendar" }
        ],
        faqs: [
            { q: "What about the 3% surcharge?", a: "If you're buying an additional property (like a buy-to-let), you usually pay an extra 3% on top of the standard rates." }
        ]
    },
    "uber-tax": {
        howItWorks: [
            "Annualize your total earnings from rides and delivery fees.",
            "Subtract car-related expenses: fuel, maintenance, insurance, and cleaning.",
            "Deduct Uber's platform commission.",
            "Determine taxable profit by applying your Personal Allowance.",
            "Calculate Income Tax and National Insurance owed."
        ],
        keyDetails: [
            { text: "Self-Employed Status: Most drivers are considered self-employed for tax purposes in the UK.", icon: "TbCar" },
            { text: "Mileage vs Actual: You can often choose between claiming actual car costs or a flat mileage rate (45p per mile).", icon: "TbTrendingUp" },
            { text: "Quarterly Payments: While currently annual, HMRC is moving towards more frequent reporting (MTD).", icon: "TbClock" }
        ],
        faqs: [
            { q: "Can I claim for my car purchase?", a: "Yes, you can often claim 'Capital Allowances' for the cost of the car itself, though rules vary on the vehicle's emissions." }
        ]
    },
    "tax-code": {
        howItWorks: [
            "Enter the tax code found on your payslip (e.g., 1257L).",
            "The numbers indicate how much you can earn tax-free (multiply by 10).",
            "The letter indicates your specific circumstances (L is standard, M/N for marriage allowance, etc.).",
            "Compare this against your expected Personal Allowance."
        ],
        keyDetails: [
            { text: "PAYE Accuracy: Your tax code tells your employer how much tax to deduct each month.", icon: "TbPercentage" },
            { text: "Wrong Code: If your code is wrong, you might be overpaying or underpaying tax unexpectedly.", icon: "TbAlertTriangle" },
            { text: "Emergency Codes: Codes like 'W1' or 'M1' are emergency codes and usually mean HMRC needs more info.", icon: "TbInfoCircle" }
        ],
        faqs: [
            { q: "How do I change my tax code?", a: "You can update your details via your Personal Tax Account online or by calling HMRC." }
        ]
    },
    "mileage-tax": {
        howItWorks: [
            "Log all business-related miles traveled in your own vehicle (commute doesn't count).",
            "Apply the 45p rate for the first 10,000 miles.",
            "Apply the 25p rate for any miles thereafter.",
            "Subtract any mileage payment your employer has already made.",
            "The difference is your unclaimed relief, which reduces your taxable income."
        ],
        keyDetails: [
            { text: "Business Miles: This only applies to travel between workplaces or for specific business trips.", icon: "TbCar" },
            { text: "Vehicle Types: Different rates apply for motorcycles (24p) and bicycles (20p).", icon: "TbBriefcase" },
            { text: "Keeping a Log: You must keep a record of dates, destinations, and distances for every trip.", icon: "TbClock" }
        ],
        faqs: [
            { q: "Can I claim for my commute?", a: "No. Travel between your home and regular place of work is considered private travel and isn't tax-deductible." }
        ]
    },
    "dividend-tax": {
        howItWorks: [
            "Calculate total dividends received from all company holdings.",
            "Apply the £500 Dividend Allowance.",
            "Determine your income tax band (basic, higher, additional).",
            "Apply the corresponding dividend tax rate to the taxable portion."
        ],
        keyDetails: [
            { text: "Investment Income: Dividends are taxed at lower rates than salary income.", icon: "TbTrendingUp" },
            { text: "Limited Companies: Directors of small companies often pay themselves in dividends to save on NI.", icon: "TbBriefcase" },
            { text: "Allowance Taper: Note that the Dividend Allowance has been reduced significantly in recent years.", icon: "TbTrendingDown" }
        ],
        faqs: [
            { q: "Are dividends inside an ISA taxed?", a: "No, any income from shares held within a Stocks and Shares ISA is completely tax-free." }
        ]
    },
    "crypto-tax": {
        howItWorks: [
            "Calculate the 'gain' for each transaction (Selling Price - Purchase Price).",
            "Pool your costs if you are trading the same asset multiple times.",
            "Subtract your Annual Exempt Amount (Capital Gains Allowance).",
            "Apply the 10% or 20% CGT rate based on your income band."
        ],
        keyDetails: [
            { text: "Capital Gains: Most crypto activity is taxed as CGT, not Income Tax.", icon: "TbCoin" },
            { text: "Trade Types: Selling, swapping one crypto for another, or spending crypto are all taxable events.", icon: "TbReceipt" },
            { text: "Staking & Mining: Income from staking or mining is usually treated as income and taxed at standard income rates.", icon: "TbTrendingUp" }
        ],
        faqs: [
            { q: "What if I make a loss?", a: "You can report losses to HMRC and use them to offset future crypto gains, reducing your future tax bill." }
        ]
    },
    "corporation-tax": {
        howItWorks: [
            "Total the annual revenue of your limited company.",
            "Subtract business expenses, employee salaries, and capital allowances.",
            "Identify the applicable rate (19% for small profits, 25% for larger profits).",
            "Calculate the tax due on the remaining profit."
        ],
        keyDetails: [
            { text: "Company Tax: This is paid by the company on its profits, before any money is paid out to shareholders.", icon: "TbBuildingBank" },
            { text: "Deadlines: Corporation tax must be paid within 9 months and 1 day after the end of the accounting period.", icon: "TbCalendar" },
            { text: "Small Profits Relief: Companies with profits under £50,000 still benefit from the lower 19% rate.", icon: "TbPercentage" }
        ],
        faqs: [
            { q: "Can I pay my own tax bill from company money?", a: "No. Corporation tax is for the company. Your personal income tax must be paid from your personal funds." }
        ]
    }
};

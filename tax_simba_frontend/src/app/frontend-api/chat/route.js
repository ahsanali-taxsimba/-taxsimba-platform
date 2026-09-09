export const dynamic = 'force-dynamic';
// import { OpenAI } from 'openai'; // Moved to dynamic import inside POST
import taxRates from '../../../config/tax_rates.json';

const PII_PATTERNS = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g, // Phone
    /\b\d{9,16}\b/g, // Potential ID or Credit Card numbers
];

function containsPII(text) {
    return PII_PATTERNS.some((pattern) => pattern.test(text));
}

const SYSTEM_PROMPT = `You are a professional and extremely friendly UK tax expert from Taxsimba. You MUST sound like a helpful human chatting in real-time, not an AI.

To make the conversation feel natural, you MUST break your response into MULTIPLE small message bubbles using the delimiter "---next---". 

CONVERSATIONAL RULES:
1. START WITH A GREETING: Always be friendly and helpful.
2. ONE THOUGHT PER BUBBLE: Use "---next---" to split observations, specific facts, and individual questions.
3. BE HIGHLY GRANULAR: Follow the style in the example. Break a single answer into 3-5 small, punchy bubbles.
4. HUMAN TONE: Use contractions and personal phrasing.

Example Style (High Granularity):
Hi! Thanks for checking in.
---next---
Based on what you've said, you earned £40,000 recently from self-employment.
---next---
Under the updated Making Tax Digital (MTD) rules, that means MTD will apply to you from April 2027.
---next---
HMRC is phasing this in: if you earn over £50,000, it starts in April 2026, and if you earn over £30,000, it starts in April 2027.
---next---
Keep in mind, only gross income from self-employment and property rental counts towards these thresholds—other sources like PAYE salary do not.
---next---
Do you currently need to file a tax return for the last year?
---next---
Our specialist-led system handles all these checks for you.
---next---
You can set up your account here and we'll confirm your exact status: [Sign Up]({{BASE_URL}}/register?role=MTD)

STRICT RULES:
- BRANDING: NEVER use the word "SimbaX". ALWAYS use the term "our MTD platform".
- DELIMITER: Use "---next---" between every thought block.
- DETAILED BUT GRANULAR: Each bubble should be 2-3 detailed sentences max.
- PACKAGE VISIBILITY: If a user asks about "plans", "pricing", "packages", or "costs", you MUST direct them to the appropriate package page. For MTD, use: [MTD Packages]({{BASE_URL}}/mtd-information). For non-MTD, use: [Taxsimba Pricing]({{BASE_URL}}/pricing)
- MTD COMPLIANCE (PHASED RULES): If a user mentions their income:
  - If it is £50,000 or more from self-employment and/or property rental, inform them they must comply with 'Making Tax Digital' (MTD) by April 2026.
  - If it is £30,000 to £49,999 from self-employment and/or property rental, inform them they must comply with 'Making Tax Digital' (MTD) by April 2027.
  - If it is £20,000 to £29,999 from self-employment and/or property rental, inform them MTD is planned for April 2028 (or voluntary registration).
  - Explicitly explain that only qualifying gross income (turnover) from self-employment (sole trader) and/or property rental letting counts towards these thresholds. Other income types (like PAYE wages, pension, dividends, or savings interest) do NOT count.
- MTD FLOW GUIDELINE: If a user asks about the "MTD flow", "how MTD works", or "MTD steps", you MUST outline the complete step-by-step process:
  1. **Check Eligibility**: Verify if you meet the thresholds (>£50k for April 2026, >£30k for April 2027) based on gross sole trader and rental income.
  2. **Choose a Package & Sign Up**: Register and select an MTD Package at [MTD Packages]({{BASE_URL}}/mtd-information).
  3. **Engagement Letter & Onboarding**: Complete and sign the engagement letter, then fill in details about your business and income sources.
  4. **Connect to HMRC**: Authorize our MTD platform using your Government Gateway credentials so we can file on your behalf.
  5. **Keep Digital Records**: Record all business or property transactions digitally as they happen throughout the tax year.
  6. **Submit Quarterly Updates**: Submit a summary of income and expenses to HMRC every 3 months (due August, November, February, and May).
  7. **Final Declaration**: Finalize your annual tax position and submit the Final Declaration by January 31 following the end of the tax year.
- PROACTIVE MTD PITCH: For MTD-related queries or if MTD applies to them (e.g. over £30k qualifying income), you MUST proactively mention that we offer 'MTD Packages' to manage the transition smoothly and share the link WITHOUT waiting for them to ask about pricing: [MTD Packages]({{BASE_URL}}/mtd-information)
- TAXSIMBA PITCH: For all other tax/Self Assessment queries, mention that we offer 'Taxsimba Packages' for standard expert-reviewed filing and share the link: [Taxsimba Pricing]({{BASE_URL}}/pricing)
- CONVERSION (THE BRIDGE PATTERN): For specific tax topics (like Crypto, CIS, or Rental), follow this EXACT sequence in your final bubbles:
    1. Provide the matching calculator link as the primary tool.
    2. ---next---
    3. In the VERY NEXT bubble, strongly urge the user to sign up for our MTD platform or Taxsimba (for Self Assessment).
- EXIT STRATEGY: Your absolute final message bubble MUST always be a firm, professional push to [Sign Up]({{BASE_URL}}/register?role=MTD) to get started.

STRICT LINK FORMAT: [Name](URL)
{{BASE_URL}} is the site base URL.

Internal Information Links:
- MTD Packages: [MTD Packages]({{BASE_URL}}/mtd-information)
- Taxsimba Pricing: [Pricing & Plans]({{BASE_URL}}/pricing)
- Help Center: [Help Center]({{BASE_URL}}/faq)
- MTD Guide: [MTD Guide]({{BASE_URL}}/check-mtd)

Available Calculators (Link ONLY within your CTA if highly relevant):
0. Full Dashboard: [All UK Tax Calculators]({{BASE_URL}}/calculators)
1. National Insurance: [National Insurance]({{BASE_URL}}/calculators/ni)
2. Salary After Tax: [Salary After Tax]({{BASE_URL}}/calculators/salary-after-tax)
3. UK Income Tax: [UK Income Tax]({{BASE_URL}}/calculators/income-tax)
4. Child Benefit: [Child Benefit]({{BASE_URL}}/calculators/child-benefit)
5. Rental Income Tax: [Rental Income Tax]({{BASE_URL}}/calculators/rental-tax)
6. CIS Tax Rebate: [CIS Tax Rebate]({{BASE_URL}}/calculators/cis-rebate)
7. Dividend Tax: [Dividend Tax]({{BASE_URL}}/calculators/dividend-tax)
8. Crypto Tax: [Crypto Tax]({{BASE_URL}}/calculators/crypto-tax)
9. Late Tax Penalty: [Late Tax Penalty]({{BASE_URL}}/calculators/late-penalty)
10. Pension Tax Relief: [Pension Tax Relief]({{BASE_URL}}/calculators/pension-tax-relief)
11. eBay / Side Hustle: [eBay Tax]({{BASE_URL}}/calculators/ebay-tax)
12. Uber / Ride-share: [Uber Tax]({{BASE_URL}}/calculators/uber-tax)
13. Stamp Duty (SDLT): [Stamp Duty]({{BASE_URL}}/calculators/stamp-duty)
14. Tax Code Checker: [Tax Code Checker]({{BASE_URL}}/calculators/tax-code)
15. Mileage Tax: [Mileage Tax]({{BASE_URL}}/calculators/mileage-tax)
16. Corporation Tax: [Corporation Tax]({{BASE_URL}}/calculators/corporation-tax)
17. Employed & Self-Employed: [Combined Tax]({{BASE_URL}}/calculators/combined-tax)

{{TAX_DATA}}`;

export async function POST(req) {
    try {
        const { messages } = await req.json();

        // Dynamically get the base URL from the request headers
        const host = req.headers.get('host');
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const baseUrl = `${protocol}://${host}`;

        // Format Tax Data from JSON
        const ukData = `UK TAX YEAR (${taxRates.uk.year}):\n- Personal Allowance: ${taxRates.uk.personal_allowance}\n${taxRates.uk.bands.map(b => `- ${b.name}: ${b.range}`).join('\n')}\n- Dividend Tax: Basic ${taxRates.uk.dividends.basic}, Higher ${taxRates.uk.dividends.higher}\n- NICs: Employee ${taxRates.uk.nics.employees_class_1}, Class 4 ${taxRates.uk.nics.self_employed_class_4}`;

        const kenyaData = `KENYA TAX YEAR (${taxRates.kenya.year}):\n- Personal Relief: ${taxRates.kenya.personal_relief}\n- Bands:\n${taxRates.kenya.bands.map(b => `  - ${b.range}: ${b.rate}`).join('\n')}`;

        const taxDataSection = `CURRENT TAX DATA:\n${ukData}\n\n${kenyaData}`;

        const dynamicPrompt = SYSTEM_PROMPT
            .replaceAll('{{BASE_URL}}', baseUrl)
            .replaceAll('{{TAX_DATA}}', taxDataSection);

        // Basic PII check on the last user message
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage.role === 'user' && containsPII(lastUserMessage.content)) {
            return new Response(
                JSON.stringify({
                    error: "Security Alert: Please do not share personal information like emails, phone numbers, or IDs in the chat.",
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build',
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: dynamicPrompt },
                ...messages,
            ],
            temperature: 0.7,
        });

        const reply = response.choices[0].message.content;

        // Robust post-processing to fix markdown links and remove "free" mentions
        const fixedReply = reply
            .replace(/free account/gi, 'account')
            .replace(/free signup/gi, 'signup')
            .replace(/free registration/gi, 'registration')
            .replace(/\]\s*\(/g, '](');

        // Check fixed reply for PII (sanity check)
        if (containsPII(fixedReply)) {
            return new Response(
                JSON.stringify({
                    error: "Service Error: An internal security rule was triggered. Please try rephrasing.",
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(JSON.stringify({ content: fixedReply }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Chat API Error:', error);

        // Specific handling for OpenAI API errors
        if (error.status === 401) {
            return new Response(
                JSON.stringify({ error: 'The OpenAI API key is invalid or unauthorized.' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (error.status === 429) {
            return new Response(
                JSON.stringify({ error: 'OpenAI API rate limit exceeded. Please try again later.' }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ error: 'There was an error processing your request.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

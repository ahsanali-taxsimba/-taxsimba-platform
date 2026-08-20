"""Help Centre seed content. Editable by Admin/Super Admin at runtime via /api/faqs."""

FAQ_CATEGORIES = [
    "Getting Started",
    "Self Assessment",
    "Uploading Documents",
    "Payments & Packages",
    "Calculation & Approval",
    "HMRC Submission",
    "MTD for Income Tax",
    "Account & Security",
]

DEFAULT_FAQS = [
    ("Getting Started", "What documents do I need?",
     "It depends on your income. Most people need their P60 or P45, details of any self-employed "
     "income and expenses, bank interest, dividends, rental income and any pension contributions. "
     "Your accountant will ask you for exactly what they need, and every request appears on your "
     "Action Required page, so you never have to guess."),
    ("Uploading Documents", "How do I upload a document?",
     "Go to Documents and choose Upload document, or open the request on your Tasks page and "
     "upload the file directly against it. Uploading against a request automatically marks that "
     "item as done and lets your accountant know it has arrived."),
    ("Self Assessment", "Why has my accountant requested more information?",
     "Your accountant only asks when something is needed to complete your return accurately, or "
     "when HMRC requires evidence to support a figure. Each request explains what is needed and "
     "why. If anything is unclear, reply in Messages and your accountant will help."),
    ("Calculation & Approval", "Where can I see my calculation?",
     "Once your accountant has prepared your return and our internal review team has checked it, "
     "your calculation appears on My Tax Return with your total income, taxable income and the "
     "tax due or refund owed."),
    ("Calculation & Approval", "How do I approve my return?",
     "Open My Tax Return, review the figures and select Approve My Tax Return. Approving confirms "
     "the information is complete and correct to the best of your knowledge. If something looks "
     "wrong, ask your accountant a question instead of approving."),
    ("HMRC Submission", "When will my return be submitted?",
     "Once you have approved your return, your authorised TaxSimba accountant submits it to HMRC "
     "using their professional filing software. TaxSimba does not file automatically through an "
     "HMRC connection — a qualified person handles it and records the outcome in your portal, so "
     "you can follow progress on Your Tax Journey."),
    ("HMRC Submission", "Where can I find my submission confirmation?",
     "Once your accountant has filed your return and recorded the submission, the submission date "
     "and any reference appear on My Tax Return, and final documents are available under Final "
     "Documents."),
    ("Payments & Packages", "How do I change my package?",
     "Go to My Services and choose an upgrade. You only pay the difference between your current "
     "package and the new one. Packages can be upgraded at any time, but cannot be downgraded "
     "once your return is under way."),
    ("Payments & Packages", "What happens if payment fails?",
     "Nothing is charged and your services stay exactly as they were. You can try again from My "
     "Services at any time. If a payment keeps failing, message your accountant and we will help."),
    ("MTD for Income Tax", "What is MTD for Income Tax?",
     "Making Tax Digital for Income Tax is an HMRC scheme that replaces the single annual return "
     "with digital record keeping and quarterly updates. It only applies to some people. If it "
     "applies to you, your accountant will recommend it and explain why before anything changes. "
     "Where MTD applies, your accountant handles the quarterly submissions using their own filing "
     "software and records each one here."),
    ("Getting Started", "How do I contact my accountant?",
     "Use Messages in your portal. Your messages go straight to the accountant looking after your "
     "case and stay attached to your tax year, so nothing gets lost."),
    ("Account & Security", "How do I change my password?",
     "Go to Settings, then Login & Security, and choose Change password. You will need your "
     "current password. If you want to change the email address you sign in with, we verify that "
     "change with you before it takes effect."),
]

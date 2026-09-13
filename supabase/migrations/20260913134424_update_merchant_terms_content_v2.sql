/*
# Update Merchant Terms & Conditions content

Updates the active merchant_policies row (version 2.0.0) with the properly
formatted Merchant T&C content provided by the operator, effective 13/09/2026.
Deactivates all other rows.
*/

UPDATE merchant_policies SET is_active = false WHERE version != '2.0.0';

UPDATE merchant_policies
SET
  title = 'UniLink Merchant Terms & Conditions',
  content = 'Effective Date: 13/09/2026
Platform: UniLink
Website: https://unilinkbase.com
Operator: Unilink Delivery
Jurisdiction: Republic of Zimbabwe

1. INTRODUCTION
These Merchant Terms and Conditions ("Merchant Terms") govern the registration and use of the UniLink platform by shops, retailers, businesses and other merchants ("Merchant", "you" or "your").
UniLink ("UniLink", "we", "us" or "our") operates a digital commerce and delivery platform through which customers may discover goods, place orders and arrange delivery or collection.
By registering as a Merchant, submitting an application, activating a Merchant account or using the UniLink Merchant Portal, you agree to be bound by these Merchant Terms, the UniLink Privacy Policy, Merchant Rules, Payment and Refund Policy and any other policies incorporated into these Terms.
If you do not agree to these Terms, you must not register or operate as a Merchant on UniLink.

2. MERCHANT ELIGIBILITY
A Merchant must:
(a) Operate a legitimate business or lawful trading activity.
(b) Have the legal authority to sell the goods or services listed on UniLink.
(c) Provide accurate registration information.
(d) Provide any documents reasonably required for verification.
(e) Comply with all applicable Zimbabwean laws and regulations.
(f) Have authority to enter into this agreement on behalf of the business.
(g) Maintain any licences, permits or approvals required for the goods or services being sold.
UniLink may reject an application where information is incomplete, misleading, unverifiable or inconsistent with applicable requirements.

3. MERCHANT VERIFICATION
UniLink may request information or documentation including:
(a) Business name
(b) Registration documents
(c) Trading licence or other applicable licence
(d) Owner/director information
(e) National identification information where legally and operationally necessary
(f) Physical business address
(g) Telephone number
(h) Email address
(i) Payment information
(j) Tax information where applicable
(k) Product or service information
(l) Business logo and photographs
UniLink may conduct reasonable verification before approving a Merchant.
Approval does not constitute a government licence, certification, endorsement or guarantee of the Merchant.

4. MERCHANT ACCOUNT
The Merchant is responsible for maintaining the confidentiality of its login credentials.
You must:
(a) Keep your password confidential.
(b) Not share administrator credentials unnecessarily.
(c) Notify UniLink immediately if you suspect unauthorised access.
(d) Ensure that persons using your Merchant account are authorised by your business.
(e) Ensure information contained in your account remains accurate.
The Merchant is responsible for activity conducted through its account unless the activity resulted from unauthorised access that was promptly reported to UniLink.

5. PRODUCT AND SERVICE LISTINGS
Merchants must provide accurate information about every product or service listed.
Listings must accurately state, where applicable:
(a) Product name
(b) Description
(c) Price
(d) Available quantity
(e) Product image
(f) Size, weight or quantity
(g) Relevant variations
(h) Applicable delivery or collection information
(i) Any material restrictions
Merchants must not deliberately misrepresent products, prices, availability, quality or characteristics.
UniLink may remove or suspend listings that are inaccurate, misleading, unlawful, unsafe or inconsistent with these Terms.

6. PRICING
Merchants are responsible for maintaining accurate prices.
Prices displayed to customers must not intentionally mislead customers.
Where applicable, the Merchant must ensure that legally required taxes, charges or other costs are properly disclosed.
UniLink may require a Merchant to correct pricing information where an obvious error has occurred.
UniLink reserves the right to investigate suspected pricing manipulation or fraudulent pricing behaviour.

7. PRODUCT AVAILABILITY
Merchants are responsible for maintaining accurate stock information.
Where a customer places an order for an unavailable product, the Merchant must promptly notify UniLink and/or the customer through the approved UniLink process.
Repeated acceptance of orders for unavailable products may result in:
(a) Warning
(b) Listing restrictions
(c) Temporary suspension
(d) Removal from UniLink

8. ORDER ACCEPTANCE
A Merchant may receive customer orders through UniLink.
The Merchant must:
1. Review incoming orders promptly.
2. Accept or reject orders in accordance with the available ordering workflow.
3. Prepare accepted orders accurately.
4. Notify UniLink promptly of material delays or problems.
5. Not intentionally accept orders that the Merchant knows it cannot fulfil.
Acceptance of an order creates an obligation on the Merchant to fulfil that order in accordance with the information presented to the customer, subject to legitimate circumstances such as stock shortages, payment failure, fraud or events outside reasonable control.

9. ORDER FULFILMENT
Merchants must prepare orders:
(a) Accurately
(b) Within the stated preparation period
(c) Using appropriate packaging
(d) In accordance with applicable health and safety requirements
(e) In accordance with the customer order
The Merchant must not substitute products without following the UniLink approved substitution process and, where required, obtaining customer approval.

10. DELIVERY
Where UniLink delivery is used, the Merchant must make the order available to the assigned messenger or delivery provider within the applicable preparation period.
The Merchant must not intentionally delay a messenger.
The Merchant must provide accurate collection information and ensure that the order is ready for collection.
UniLink may monitor fulfilment and delivery performance for operational purposes.

11. CUSTOMER SERVICE
Merchants are responsible for the quality and legality of the goods or services they sell.
Merchants must communicate with customers respectfully and professionally.
Merchants must not:
(a) Harass customers
(b) Threaten customers
(c) Discriminate unlawfully
(d) Misuse customer information
(e) Contact customers for unrelated purposes
(f) Attempt to move UniLink transactions outside the platform to avoid applicable fees

12. PROHIBITED GOODS AND SERVICES
Merchants must not list or sell goods or services that are illegal or prohibited under applicable law.
UniLink may restrict categories of products including, where applicable:
(a) Illegal drugs
(b) Unlicensed pharmaceutical products
(c) Counterfeit goods
(d) Stolen goods
(e) Weapons or prohibited weapon-related products
(f) Explosives
(g) Fraudulent documents
(h) Unlawfully obtained personal information
(i) Other products prohibited by law or by UniLink policy
UniLink may immediately remove prohibited listings and suspend associated accounts.

13. LEGAL COMPLIANCE
The Merchant remains responsible for complying with all laws applicable to its business, products and services.
UniLink does not assume responsibility for obtaining licences, permits, certificates or regulatory approvals that are legally required by the Merchant.
The Merchant must not use UniLink to facilitate unlawful activity.

14. PAYMENTS
Where UniLink processes customer payments, the Merchant agrees that transactions may be processed through UniLink designated payment providers.
Applicable transaction fees, commissions, payment-processing charges or other agreed charges may be deducted before settlement.
The Merchant authorises UniLink to reconcile legitimate transaction adjustments, refunds, reversals and chargebacks in accordance with the applicable payment policy.

15. MERCHANT SETTLEMENTS
Where applicable, funds due to the Merchant will be settled according to the settlement schedule communicated by UniLink.
UniLink may delay or hold settlement where reasonably necessary to investigate:
(a) Suspected fraud
(b) Chargebacks
(c) Payment reversals
(d) Duplicate transactions
(e) Customer disputes
(f) Regulatory requirements
(g) Security incidents
UniLink will not intentionally withhold legitimate Merchant funds indefinitely.

16. REFUNDS, RETURNS AND CANCELLATIONS
Merchants must comply with applicable consumer protection laws and UniLink refund procedures.
A Merchant may be responsible for refunds where an order was:
(a) Incorrectly fulfilled
(b) Materially different from its listing
(c) Missing items
(d) Cancelled because the Merchant could not fulfil it
(e) Otherwise defective or non-compliant with applicable law
Nothing in these Terms removes any consumer right provided by applicable law.

17. CUSTOMER INFORMATION
Merchant access to customer information is provided only for legitimate UniLink transactions and operational purposes.
Merchants must not:
(a) Sell customer information
(b) Share customer information with unauthorised persons
(c) Use customer information for unrelated marketing without appropriate permission
(d) Add customers to unrelated mailing lists
(e) Contact customers outside legitimate transaction purposes
(f) Store unnecessary copies of customer information
Customer information must be handled securely and confidentially.

18. DATA PROTECTION
UniLink and its Merchants must handle personal information in accordance with applicable Zimbabwean data-protection requirements.
UniLink may collect and process Merchant information for purposes including:
(a) Merchant registration
(b) Identity and business verification
(c) Account administration
(d) Order fulfilment
(e) Payments
(f) Fraud prevention
(g) Customer support
(h) Security
(i) Regulatory compliance
(j) Business analytics
(k) Service improvement
UniLink will seek to collect information that is relevant and necessary for these purposes.
Merchants may request access to or correction of relevant personal information held by UniLink, subject to applicable law.

19. MERCHANT DATA
The Merchant retains rights in its lawful business information, product information and content supplied to UniLink, subject to the licence granted below.
By uploading product information, photographs, logos and descriptions, the Merchant grants UniLink a non-exclusive, royalty-free licence to use that material for operating, displaying, promoting and marketing the Merchant and its products through UniLink.
The Merchant confirms that it has the necessary rights to upload such material.

20. MARKETING
UniLink may display approved Merchant names, logos, products and photographs on its platform and in UniLink marketing materials.
UniLink may use aggregated and anonymised information for analytics, reporting and service improvement.
Any separate promotional use requiring additional consent will be handled in accordance with applicable law and the relevant agreement.

21. FEES
The Merchant agrees to pay any fees applicable to its chosen UniLink service plan.
Fees may include:
(a) Transaction commissions
(b) Merchant subscription fees, where applicable
(c) Promotional fees
(d) Payment-processing charges
(e) Other charges expressly communicated and accepted by the Merchant
UniLink will communicate applicable fees before they become payable.
UniLink may change fees prospectively by providing reasonable notice.

22. PLATFORM AVAILABILITY
UniLink will make reasonable efforts to maintain platform availability.
However, continuous uninterrupted availability cannot be guaranteed.
The platform may occasionally be unavailable because of:
(a) Maintenance
(b) Software updates
(c) Internet or telecommunications failures
(d) Payment-provider outages
(e) Cloud-service failures
(f) Security incidents
(g) Events outside UniLink reasonable control

23. INTELLECTUAL PROPERTY
The UniLink name, logo, software, platform design, databases, interfaces, technology and associated intellectual property belong to UniLink or its respective licensors unless otherwise stated.
The Merchant receives a limited, non-exclusive right to use the platform while its account remains active.
The Merchant must not:
(a) Copy UniLink software
(b) Reverse engineer the platform except where legally permitted
(c) Reproduce UniLink branding without permission
(d) Attempt to gain unauthorised access to UniLink systems
(e) Use UniLink intellectual property outside the permitted purposes

24. FRAUD AND MISUSE
UniLink may investigate suspected fraudulent or abusive activity.
Examples include:
(a) Fake orders
(b) Manipulated prices
(c) False product listings
(d) Payment fraud
(e) Multiple fraudulent accounts
(f) Circumvention of UniLink fees
(g) Misuse of customer data
(h) Unauthorised access
(i) False business information
UniLink may suspend an account while an investigation is conducted.

25. SUSPENSION AND TERMINATION
UniLink may suspend or terminate a Merchant account where the Merchant:
(a) Breaches these Terms
(b) Provides materially false information
(c) Engages in fraud
(d) Repeatedly fails to fulfil orders
(e) Sells prohibited products
(f) Misuses customer information
(g) Creates security risks
(h) Fails to pay applicable fees
(i) Violates applicable law
Where reasonably possible, UniLink will provide notice and an opportunity to remedy a breach.
Immediate suspension may occur where necessary to protect customers, Merchants, payment systems, data or the platform.

26. MERCHANT TERMINATION
A Merchant may request closure of its account.
Outstanding transactions, refunds, disputes, payments and other obligations may need to be resolved before final closure.
Certain information may be retained where required by law, for legitimate accounting, fraud-prevention, dispute-resolution or regulatory purposes.

27. LIMITATION OF ROLE
UniLink operates as a technology and commerce platform connecting customers, Merchants and delivery participants.
Unless expressly stated otherwise, UniLink is not the manufacturer or owner of goods sold by Merchants.
The Merchant remains responsible for the legality, quality, safety, description, pricing and fulfilment of its products.

28. LIABILITY
Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited under applicable law.
Subject to applicable law, UniLink will not be responsible for losses arising solely from:
(a) Merchant misconduct
(b) Inaccurate Merchant information
(c) Illegal products
(d) Merchant failure to fulfil orders
(e) Events outside UniLink reasonable control
(f) Unauthorised use of a Merchant account caused by the Merchant failure to secure its credentials

29. INDEMNITY
To the extent permitted by law, the Merchant agrees to indemnify UniLink against reasonable losses, claims, costs or liabilities arising directly from:
(a) The Merchant unlawful conduct
(b) Breach of these Terms
(c) Infringement of another person intellectual property
(d) Misuse of customer information by the Merchant
(e) Defective or unlawful products supplied by the Merchant
(f) Materially false information provided by the Merchant
This clause does not exclude rights or remedies that cannot lawfully be excluded.

30. DISPUTE RESOLUTION
The parties should first attempt to resolve disputes through good-faith communication.
Where appropriate, UniLink may establish an internal dispute-resolution process.
Nothing in this clause prevents a party from exercising rights available under Zimbabwean law.

31. GOVERNING LAW
These Terms are governed by the laws of the Republic of Zimbabwe.
Any dispute that cannot be resolved through the applicable internal process may be referred to a court or other competent dispute-resolution forum with jurisdiction.

32. CHANGES TO THESE TERMS
UniLink may update these Terms when reasonably necessary because of:
(a) Changes to the platform
(b) Changes to business operations
(c) Legal or regulatory requirements
(d) Security requirements
(e) New services or features
Material changes will be communicated through appropriate means.
Continued use of UniLink after the effective date of updated Terms may constitute acceptance where permitted by law.

33. ELECTRONIC ACCEPTANCE
The Merchant agrees that selecting "I agree to the UniLink Merchant Terms & Conditions" and completing registration constitutes electronic acceptance of these Terms.
Electronic records of acceptance may be retained by UniLink as evidence of agreement.

34. CONTACT
Merchant Support:
Email: unilinkbase@gmail.com
Telephone: +263782627990
Website: https://unilinkbase.com',
  is_active = true
WHERE version = '2.0.0';

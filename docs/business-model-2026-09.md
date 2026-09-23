# Low-cost commercial model — 23 September 2026

Decision record for the approved release preparation. This supersedes the July
business plan's economics and implementation claims, not its historical reasoning.
We have not validated an optimal price, conversion rate, retention or ad revenue.
No store price, purchase flow, feature restriction, account or ad integration has
been changed. The existing £4.99 one-time model remains the baseline.

## Recommendation

Keep the paid product one-time and ad-free. Start with a useful, repeatable free
browser starter experience and paid Apple apps; validate Windows demand before
packaging it. Use one repository and shared behavioural contracts, with separate
platform build numbers and release tags, not permanent per-platform branches.

For the eventual public offer, test **free First Steps / starter routines versus
the paid full authored library and native convenience**. Keep real coaching in
the free experience so people can evaluate the actual benefit. Never gate honest
measurement limits, pause/stop, privacy controls, basic accessibility or export
behind payment. Today's review artifact still contains the complete prototype;
it is not an implemented free/paid product split or client-side security boundary.

Begin with paid-up-front native distribution plus the browser trial: least
purchase-state engineering. A free native starter plus a restorable non-consumable
unlock is a later conversion experiment, not a subscription. Test the transition
on actual devices before deciding it is worth its extra entitlement work. Apple
universal purchase can cover iPhone/Mac; do not promise a Windows purchase also
unlocks Apple without an agreed entitlement mechanism.

£4.99 can be a launch hypothesis; compare £7.99 and £9.99 willingness to pay once
beginners can complete workouts reliably. Recommend **testing £7.99 first**, not
silently setting it. A price increase is useful only if contribution per qualified
visitor improves. Native convenience alone may not convert users of a full free
web app; do not assume both unlimited free parity and strong purchase conversion.

Later, genuinely additional authored programme packs can be separate one-time
purchases if demand supports their production/validation cost. Do not remove
previously purchased functionality or promise all future content forever.

## Unit economics, explicitly illustrative

Run `npm run business:model`. Inputs are in `commercial/assumptions.json`; formulas
and invalid-input/negative-margin tests are tracked. These are not live store
quotes, observed demand, tax advice or a revenue forecast.

For an example UK VAT-inclusive sale, use 20% tax and 15% commission:

`store proceeds = price / 1.20 × 0.85`

Then assume 5% refunded purchases, two minutes of support per purchase at £20/hour,
no paid acquisition and no other entered variable cost. Those support/refund
figures are placeholders to replace with observations, not industry averages.
Support is charged to all purchases, including refunded ones. The simplified
refund model assumes reversal of proceeds; actual store adjustments can differ.

| Price | Proceeds before refunds/support | Contribution after example refunds/support |
|---|---:|---:|
| £4.99 | £3.53 | £2.69 |
| £7.99 | £5.66 | £4.71 |
| £9.99 | £7.08 | £6.06 |

At £7.99, retaining about 57% of the £4.99 purchase conversion would preserve
contribution per visitor **under these same assumptions**. At £9.99, about 44%.
These are break-even comparisons, not predictions that customers will accept them.

With assumed £200 annual cash overhead, £4.99 covers that overhead in about 60
purchases. Valuing 200 annual development hours at £20/hour, in addition to support,
requires about **1,561** purchases instead. The old statement “profitable at ~45
sales” only approximated fee recovery and was not a business-profit calculation.

The acquisition-cost ceiling computed by the model is before fixed costs and any
desired profit. Do not spend up to it by default. Direct cash break-even excludes
unpaid founder labour; the economic version includes entered labour, not company/
personal income tax or every possible expense. Hardware, accounting, insurance,
legal/privacy review and voice rights are costs to investigate and enter, not
assumed free because inference runs locally.

Apple's actual proceeds depend on territory, tax category and agreements. Verify
in App Store Connect. The 15% example requires Small Business Program eligibility
and enrollment; it is not automatic. Sources: [Apple proceeds](https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds),
[Small Business Program](https://developer.apple.com/app-store/small-business-program/),
[UK VAT](https://www.gov.uk/vat-rates).

## Keep the cost base small

| Item | Lowest-cost sensible route | Boundary |
|---|---|---|
| Browser hosting | Static-only free tier; provider subdomain during validation | No paid functions, database or upload service; domain renewal is separate |
| Apple distribution | Enroll close to device/distribution need, apply for Small Business Program | $99/year in USD; local checkout price varies |
| Windows | Store route after demand/device validation | New onboarding currently has no registration fee; correct commercial account type and verification still required |
| Inference and voice | On-device pose/optional native models; reusable licensed recorded clips | No per-workout model/TTS API; rendering, rights, intelligibility and testing are real work |
| Duo | One provider proved with two accounts before adding alternatives | User-owned storage is not unlimited, interoperable by default or guaranteed free forever |
| Reminders/email | Local reminders when implemented; existing explicit email draft | No bulk mail service, automated email sender or delivery guarantee |
| CI | Existing tests, cancel obsolete same-ref runs, review evidence retention and budgets | Private-repo minutes/storage are finite; cancellation is not a spending cap |
| Product scope | One excellent beginner journey, then platform expansion | Every store/provider creates ongoing QA and support, even with shared code |

[Apple enrollment](https://developer.apple.com/programs/enroll/) lists the annual
fee. [Microsoft's new onboarding](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)
waives registration fees for both account types and distinguishes commercial
developers from hobbyists; this is not an exemption from sales commission or QA.
[Cloudflare Pages](https://www.cloudflare.com/products/pages/) offers free static
hosting, subject to its terms and [limits](https://developers.cloudflare.com/pages/platform/limits/)
(500 builds/month, 20,000 files, 25 MiB/file on the free plan). No hosting provider
is connected yet. Recheck fees/terms at launch.

[GitHub Free](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
currently includes 2,000 Actions minutes and 500 MB artifact storage; the owner's
actual plan/usage has not been inspected. Our recorded audio/video reports can
consume storage quickly. Keep local evidence, limit unnecessary remote reruns,
and explicitly configure account-level spending controls before paid overage.
Existing 14-day CI retention is preserved; no old reports are deleted here.

[Drive quota documentation](https://developers.google.com/workspace/drive/api/guides/limits)
now describes above-quota charging planned later in 2026. Do not promise “free
forever” because the first users fit a free allocation. Provider alternatives
remain candidates, not three additional integrations to maintain immediately.

## Ads and acquisition

Do not make launch viability depend on programmatic ads. For illustration only,
20,000 served impressions at an **assumed** £3 revenue per thousand yield £60,
before associated costs. That is arithmetic, not a benchmark for this audience.
Compare any later ad pilot against purchase conversion, return rate and support.

Ads belong on useful public exercise/guide pages, if anywhere, never interrupting
the camera coach. Prefer a simple fixed sponsor link/image experiment before an
ad SDK. Do not add tracking, sell body/form data, share diagnostic input, or let
advertising scripts run with workout/auth access. Third-party ads also add policy,
consent and loading work. [Google's personalized-ad consent requirements](https://support.google.com/adsense/answer/13554116?hl=en)
apply in the UK/EEA/Switzerland; non-personalized ads are not a blanket privacy exemption.

For growth, start with consented demonstrations, store discovery, useful guides
and explicit friend invitations. These consume founder time even with no ad bill.
Duo should make it easy for a friend to try the product; do not depend on both
people paying before either can learn whether it works. First validate the provider
and the shared-week mechanic; don't treat an unconnected prototype as a growth loop.

## Spend/expand only after evidence

1. Finish the second beginner session, real device/camera tests and voice listening
   checks. Do not advertise missing-ankle recognition or clinical outcomes.
2. Use the local web artifact and current test loop to check startup, audio,
   permission failures and laptop usability. Clear redistribution/privacy/support
   gates before a public HTTPS preview; no bought domain is necessary for testing.
3. Test willingness to pay at £4.99/£7.99/£9.99 with a consistent offer and record
   sample sizes and uncertainty. Interview intent isn't observed paid conversion.
4. Use store-native aggregate sales/refunds and explicitly consented usability
   evidence. No new tracking SDK is installed. Judge contribution per qualified
   visitor, unaided first-session completion, return use and support burden.
5. Prove Drive Duo with two real accounts, then decide whether CloudKit/OneDrive
   earns its extra support cost. Stop after the defined feasibility questions;
   don't build three speculative provider integrations.
6. Ship one paid platform well, then Mac/Windows as demand and hardware validation
   justify them. A universal Apple purchase is a packaging option, not a native
   UI we already have. Native session cores are still unported.

No live acquisition experiment, actual pricing test or public release was run in
this phase. The best current model is a testable hypothesis, not a proven optimum.

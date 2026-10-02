# Privacy friction, permission-granting behavior, and trust design for screen-observing software

Research compiled September 2026. Sources are tagged **[peer-reviewed]**, **[institutional survey]**, **[vendor/industry data]**, or **[design commentary / unsourced]** so the report-writer can weight them correctly. A running theme: the peer-reviewed literature on *timing and context* is strong; the literature specifically quantifying *pre-permission explainer screens* is dominated by vendor blog content with weak attribution, and should be presented as such.

## Q1. Timing and framing of permission requests — contextual / just-in-time vs. upfront

### Takeaway
The Berkeley (Felt/Egelman/Wijesekera) line of work established empirically that install-time permission manifests are essentially ignored and not understood, and that users' actual privacy decisions are **contextual** — the same permission is acceptable or unacceptable depending on what the user was doing and whether the requesting app was visible. That is direct support for the "resolve trust at the moment of the ask, in context" claim, though the papers measure *denial* behavior rather than the effect of an explainer screen.

### Cited Findings
- Felt et al.'s SOUPS 2012 study of Android install-time permissions used an Internet survey of 308 Android users plus a lab study of 25 users, and found that install-time permission warnings were largely not attended to or comprehended — motivating the move to runtime prompts. — [Android Permissions: User Attention, Comprehension, and Behavior (SOUPS 2012)](https://cups.cs.cmu.edu/soups/2012/proceedings/a3_Felt.pdf) **[peer-reviewed]**
- Felt et al. proposed that most Android permissions be granted without a priori approval and ~12 sensitive permissions be granted **at runtime**, on the explicit reasoning that a user asked mid-task "may have some understanding of why the application needs that permission based on what she was doing" — i.e. context supplies the rationale. — [Android Permissions Remystified (USENIX Security 2015)](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-wijesekera.pdf) **[peer-reviewed]**
- Wijesekera et al., field study: **95% of participants chose to block at least one permission request**, with an **average denial rate of 60%** across sensitive requests when given the choice. — reported in search indexing of [The Feasibility of Dynamically Granted Permissions (IEEE S&P 2017)](https://arxiv.org/pdf/1703.02090) / [Android Permissions Remystified (USENIX Sec 2015)](https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-wijesekera.pdf) **[peer-reviewed]** — see Gaps: I could not open the PDFs to verify which of the two papers each figure belongs to.
- Wijesekera et al. (IEEE S&P 2017) ran a **131-person longitudinal field study** and built a contextual classifier that predicted users' own privacy decisions with **96.8% accuracy**, "a four-fold reduction in error rate compared to current systems" (i.e. ask-on-first-use). The framing of the paper is that ask-on-first-use fails precisely because it freezes a decision made in one context and applies it to all later contexts. — [The Feasibility of Dynamically Granted Permissions (IEEE S&P 2017), arXiv abstract](https://arxiv.org/abs/1703.02090) **[peer-reviewed]**
- Follow-on work formalized this as "contextualizing privacy decisions for better prediction and protection." — [CHI 2018](https://dx.doi.org/10.1145/3173574.3173842) **[peer-reviewed]**
- Vendor/analytics claim, weakly sourced: "Apps that defer permission requests until they're contextually relevant see up to a **28% higher grant rate**" — the article gives no citation for this figure. — [Dogtown Media](https://www.dogtownmedia.com/the-ask-when-and-how-to-request-mobile-app-permissions-camera-location-contacts/) **[design commentary / unsourced — do not present as evidence]**

### Inferences
- The strongest defensible version of the Plover claim is not "an explainer screen raises grant rates by X%" but "permission decisions are context-dependent, and a request stripped of context is the condition under which users deny at high rates." Plover's onboarding is essentially manufacturing context for a permission that macOS otherwise presents cold.
- Conversely, the Berkeley work implies a *challenge* to Plover: the real driver of acceptance is that the request arrives when the user can see why it's needed. An onboarding screen shown before the user has experienced any value may be closer to "install-time" than to "just-in-time" in the taxonomy — the very pattern the research found ineffective.

### Gaps
- I could not extract the exact per-permission grant/denial percentages from the Wijesekera PDFs (both fetches returned binary/compressed content). The 95%/60% figures come from search-engine extraction of those papers and should be verified against the PDFs before being quoted in a published piece.
- I found no study that directly A/B-tests a pre-permission explainer screen on a **desktop** OS permission (macOS TCC). All the quantified pre-prompt material is mobile.

## Q2. Does explaining WHY ("permission rationale" / priming) increase grant rates?

### Takeaway
Platform vendors (Google, and the ATT ecosystem) explicitly recommend pre-permission rationale, and mobile-growth vendor data consistently reports large lifts — but the specific numbers circulating (81%, 28%, "up to 30%") trace back to blog posts with broken or absent attribution. The best *attributable* quantified evidence is AppsFlyer's ATT benchmark data, which is vendor data but based on large observed populations.

### Cited Findings
- Google's official Android guidance: "Research shows that users are much more comfortable with permissions requests if they know why the app needs them, such as whether the permission is needed to support a core feature of the app or for advertising." Google provides `shouldShowRequestPermissionRationale()` specifically so developers can show an explanation UI before the system dialog — **but the documentation cites no study, name, or metric.** — [Android Developers: Request runtime permissions](https://developer.android.com/training/permissions/requesting) **[platform guidance, no underlying data disclosed]**
- AppsFlyer (April 2025): globally **~50% of users now consent to ATT tracking**, up roughly 10 points since the 2021 rollout; France ~51%, Germany ~47%. — [AppsFlyer: ATT opt-in rates are much higher than anticipated](https://www.appsflyer.com/blog/trends-insights/att-opt-in-rates-higher/) **[vendor data]**
- AppsFlyer: "**80% of apps have implemented the ATT prompt, while over 45% of users that see the prompt consent to being tracked**." Notably, this article profiles eight brands' pre-prompt creative but **provides no before/after lift figures** — the analysis is qualitative. — [AppsFlyer: How apps boost ATT opt-in rates with pre-prompts](https://www.appsflyer.com/blog/tips-strategy/apps-boost-att-opt-in/) **[vendor data; qualitative on the specific question]**
- AppsFlyer also found **30% of non-gaming apps had a higher IDFA opt-in rate when the prompt was shown 7 days after install** rather than at first launch — i.e. timing matters, but the direction is not uniform (the highest rates overall still came from prompting at first launch). — [AppsFlyer](https://www.appsflyer.com/blog/trends-insights/att-opt-in-rates-higher/) **[vendor data]**
- Circulating but poorly attributed lift claims, flagged as such: "pre-permission screens can increase IDFA opt-in rates by 20–40 percentage points" — [Playwire ATT guide](https://www.playwire.com/blog/mastering-idfa-opt-in-rates-the-complete-apptrackingtransparency-guide-for-ios-apps); "pre-prompts can increase opt-ins by up to 30%" — [iZooto](https://izooto.com/blog/increase-push-notification-opt-in-rate); "compelling explanations can result in up to an **81% increase in granted requests**" and "over **82% of users want apps to provide a clear reason** for requesting personal information," attributed loosely to Nielsen Norman Group but **without a working citation** — [Dogtown Media](https://www.dogtownmedia.com/the-ask-when-and-how-to-request-mobile-app-permissions-camera-location-contacts/) **[vendor/commentary, unverified]**
- Counter-perspective from within the industry: Eric Seufert argues ATT opt-in rates are a misleading metric for product decisions at all, since the business outcome depends on measurement coverage, not the headline consent rate. — [Mobile Dev Memo: ATT opt-in rates are irrelevant](https://mobiledevmemo.com/att-opt-in-rates-are-irrelevant/) **[industry commentary]**

### Inferences
- The "explain first" pattern is close to universal platform guidance and near-universal industry practice, which is itself evidence of perceived efficacy — but the case study should not quote the 81% or 20–40pp figures as research findings. They are vendor marketing numbers with no traceable methodology.
- The honest framing: *the direction of the effect is well supported and platform-endorsed; the magnitude is not reliably quantified in any public, methodologically transparent source I could find.*

### Gaps
- I could not locate a peer-reviewed randomized experiment measuring the grant-rate effect of a rationale screen. If one exists it is likely in SOUPS/CHI proceedings behind ACM DL, which I could not search directly.
- The Nielsen Norman Group "81%" figure could not be traced to an actual NN/g publication.

## Q3. How sensitive is screen recording specifically?

### Takeaway
**This is the weakest-evidenced part of the brief.** I found no survey or grant-rate dataset that ranks screen-recording permission against camera, microphone, location, or contacts on user comfort. The available support is structural (how macOS classifies and gates the permission) plus adjacent evidence from the workplace-monitoring literature, not direct comparative data.

### Cited Findings
- macOS treats screen recording as a TCC-gated permission in the same tier as camera and microphone, requiring explicit System Settings approval and (unlike most permissions) an app relaunch; commentary notes it is "one of the most powerful permissions because it can expose everything visible on your display." — [CoreLock: Mac Privacy Permissions Explained](https://corelock.net/blog/mac-privacy-permissions-explained); [Screenify: macOS screen recording permissions](https://www.screenify.studio/blog/2026-04-23-macos-screen-recording-permissions) **[design commentary / technical]**
- Structural point worth making: screen recording is a *superset* permission — it can incidentally capture content that would otherwise require contacts, messages, calendar, and credential access. No source I found quantifies how much this raises user resistance.
- Unverified figures circulating on permission-driven churn: "43% of users uninstall apps that require too many permissions," "72% of users will uninstall apps due to privacy concerns," "apps requesting fewer than five permissions see up to 25% higher install rates" — all stated without sources. — [Dogtown Media](https://www.dogtownmedia.com/the-ask-when-and-how-to-request-mobile-app-permissions-camera-location-contacts/) **[unsourced — do not cite]**
- The same article attributes to Pew that "**54% of users decided not to install an app**" over privacy concerns and "**30% decided to uninstall**" one. This is consistent with Pew's historical app-permissions work but I was unable to verify the primary Pew citation in this session. **[attribution unverified]**

### Inferences
- The absence of comparative data is itself a finding for the report: a case study claiming screen recording is uniquely sensitive is making a *plausible but unevidenced* claim, and should be phrased as a design judgment supported by the monitoring-software literature (Q5) rather than by permission-comfort survey data.

### Gaps
- No ranked permission-sensitivity survey covering screen capture was found. Existing rankings (e.g. Felt et al.'s risk rankings) predate screen-recording being a consumer-facing OS permission.
- No macOS TCC grant-rate benchmark data exists publicly, as far as I can tell — Apple does not publish it and there is no desktop equivalent of AppsFlyer's ATT dataset.

## Q4. The privacy paradox, and whether privacy actually converts

### Takeaway
This is the strongest counter-evidence to Plover's thesis. Stated privacy concern is near-universal and yet meta-analytic work finds concern predicts *intentions* far better than *behavior* — meaning trust-forward onboarding may satisfy a stated preference that does not, on its own, move adoption.

### Cited Findings
- Pew (5,101 U.S. adults, May 15–21, 2023): **81%** are very/somewhat concerned about how companies use data collected about them; **71%** say the same about government. **73%** feel they have very little or no control over company data collection (**79%** for government). **67%** say they have little or no understanding of what companies do with their data. — [Pew Research Center, Oct 18 2023](https://www.pewresearch.org/internet/2023/10/18/how-americans-view-data-privacy/); [key findings](https://www.pewresearch.org/short-reads/2023/10/18/key-findings-about-americans-and-data-privacy/) **[institutional survey]**
- Meta-analysis of **181 independent studies (N = 99,092)**: privacy concern "exhibited a larger impact on behavioral intentions than on actual behavior" — the privacy paradox generalizes across the literature. Theoretical (culture) and methodological (measurement instrument) moderators affect the strength of the relationships. — [Privacy concern and its consequences: A meta-analysis, *Technological Forecasting and Social Change* (2023)](https://www.sciencedirect.com/science/article/abs/pii/S0040162523004742) **[peer-reviewed]**
- Kokolakis's review of the privacy paradox literature is the canonical survey of the phenomenon and finds the attitude–behavior discrepancy is robust but that methodological choices (measuring disclosure *intention* rather than actual disclosure) partly manufacture it. — [Kokolakis, *Computers & Security* (2017)](https://www.sciencedirect.com/science/article/abs/pii/S0167404815001017) **[peer-reviewed]**
- Systematic literature review reaching the same conclusion about expressed concerns vs. actual online behavior. — [Barth & de Jong, *Telematics and Informatics* (2017)](https://www.sciencedirect.com/science/article/pii/S0736585317302022) **[peer-reviewed]**
- A longitudinal test found the paradox weaker than cross-sectional work implies when the same individuals are tracked over time — an important nuance, since much paradox evidence is between-subjects. — [Dienlin, Masur & Trepte, *New Media & Society* (2023)](https://journals.sagepub.com/doi/full/10.1177/14614448211016316) **[peer-reviewed]**
- Separate meta-analysis on privacy cognition and information disclosure reaches compatible conclusions. — [*Computers in Human Behavior* (2019)](https://www.sciencedirect.com/science/article/abs/pii/S026840121831137X) **[peer-reviewed]**

### Inferences
- The honest reading: privacy guarantees are unlikely to be a *conversion driver* on their own. Their defensible role is as a **blocker-removal** mechanism — the permission dialog is a hard gate where a privacy objection has a concrete behavioral cost (denial), which is exactly the narrow situation in which the privacy paradox is weakest, because the privacy decision and the behavior are the same action. That reframing actually *rescues* Plover's claim without overclaiming: trust work pays off at the gate, not in the funnel generally.
- The 73%-feel-no-control finding is directly relevant to Plover's "Only specified windows" guarantee: the scoping control is addressing the most widely reported deficit (control), not the concern itself.

### Gaps
- I found no study isolating privacy-as-a-feature's effect on *product adoption* (e.g. DuckDuckGo/Signal/Proton conversion attributable to privacy positioning). This is a real gap; the honest answer is that the case for privacy-as-conversion is largely anecdotal.

## Q5. Employee reaction to monitoring software ("bossware")

### Takeaway
This is the best-quantified section and establishes the baseline suspicion Plover inherits. Monitored workers report materially worse psychological outcomes, and the effect sizes are large — roughly double the rates of distrust and discomfort versus unmonitored workers. Plover's "Yours alone / no manager view" guarantee is targeting a well-documented fear.

### Cited Findings
- APA 2023 Work in America survey (Harris Poll, 2,515 employed U.S. adults, April 17–27 2023, ±3.1pp): **51%** of workers are aware their employer uses technology to monitor them. Among monitored workers, **56%** typically feel tense or stressed at work; **47%** report worrying about being spied on (vs. **22%** of unmonitored); **46%** report feeling uncomfortable (vs. **23%**); **45%** say their workplace negatively affects their mental health (vs. **29%**). — [APA 2023 Work in America: AI, monitoring technology and psychological well-being](https://www.apa.org/pubs/reports/work-in-america/2023-work-america-ai-monitoring); [topline data](https://www.apa.org/pubs/reports/work-in-america/2023-word-in-america-topline.pdf) **[institutional survey]**
- APA also reports **36% of monitored employees believe they do not matter to their employer, vs. 22% of unmonitored employees**. — [APA: Electronically monitoring your employees? It's impacting their mental health](https://www.apa.org/topics/healthy-workplaces/employee-electronic-monitoring) **[institutional survey]**
- Adoption baseline: by 2025 roughly **7 in 10 large companies monitor worker activity, up from 6 in 10 in 2021**; ~**74% of U.S. employers** use online tracking tools. — [The Register (Nov 23 2025)](https://www.theregister.com/2025/11/23/bossware_monitor_remote_employees/); [employee monitoring statistics compilation](https://high5test.com/employee-monitoring-statistics/) **[press / aggregated vendor data — treat the exact percentages as soft]**
- UK survey: about **a third of UK firms** deploy monitoring software; among managers, **53% supported** monitoring while **42% opposed** it, citing undermined trust, privacy invasion, and misuse risk. — [Collyer Bristow](https://collyerbristow.com/shorter-reads/third-of-uk-firms-deploy-bossware-to-track-staff-activity-survey-reveals/); [People Management](https://www.peoplemanagement.co.uk/article/1932701/third-uk-firms-deploy-bossware-track-staff-activity-survey-reveals) **[industry survey]**
- CHI 2025: employees were **confident in their knowledge of workplace-monitoring terms but struggled to accurately define them**; awareness varied by industry and role but was "generally low and lacked certainty." — [Boss is aWare—Are you? Employee Comprehension and Legal Awareness of Workplace Monitoring, CHI 2025](https://dl.acm.org/doi/10.1145/3706598.3713651) **[peer-reviewed]**

### Inferences
- The CHI 2025 comprehension finding is the sharpest argument *for* Plover's design: if users are confidently wrong about what monitoring software does, a settings page they never open cannot correct the misconception, whereas an explicit three-guarantee screen at the moment of the ask can. Front-loading is a comprehension intervention, not just a reassurance one.
- Because ~half of U.S. workers already experience employer monitoring, a self-installed screen-reading tool is being evaluated against a salient negative prior. "No manager view" is doing more work than the other two guarantees.

### Gaps
- No data on how consumers evaluate *self-installed* monitoring tools (where the user is also the beneficiary) versus employer-imposed ones. The distinction Plover depends on is untested in the literature I found.

## Q6. Local-first / on-device processing as a trust signal

### Takeaway
Weak and partly negative. Users' mental models of where data is processed are demonstrably incomplete, and at least one recent paper argues explicitly that "local" is not a sufficient privacy boundary — so a "never saved / stays local" claim may not land with users who cannot evaluate it.

### Cited Findings
- Grounded-theory research on smart-device users found **incomplete mental models of on-device AI**, producing divergent beliefs about where data is stored, processed, and shared; users' understanding was often bounded by "household and vendor at most." — reported via [search synthesis of on-device AI mental-model research] **[peer-reviewed, but I could not confirm the specific paper/venue — see Gaps]**
- "Local Is Not a Sufficient Privacy Boundary: Governing OS-Integrated On-Device AI" argues the local-threat analysis is **stakeholder-specific**: moving processing on-device "changes the relevant adversary rather than removing it," a direct challenge to local-first as a blanket trust claim (relevant for shared devices and vulnerable users). — [arXiv 2606.10173](https://arxiv.org/pdf/2606.10173) / [ResearchGate record](https://www.researchgate.net/publication/406895371_Local_Is_Not_a_Sufficient_Privacy_Boundary_Governing_OS-Integrated_On-Device_AI) **[preprint]**
- Vendor framing of the distinction as the primary differentiator: "Privacy is the single biggest differentiator between local and cloud transcription... audio data stays on your device and is discarded after processing." — [OpenWhispr](https://openwhispr.com/blog/local-vs-cloud-transcription) **[vendor marketing]**

### Inferences
- Plover's "Never saved" guarantee is stronger than a generic "local processing" claim, because it describes an *observable consequence* (no image is retained) rather than an architecture the user cannot verify. The literature suggests architectural claims underperform; consequence claims are more legible.
- No evidence found that users reliably distinguish local from cloud processing unaided — which argues for Plover's phrasing choices but against assuming the distinction alone earns trust.

### Gaps
- I found **no quantified study** measuring whether "on-device" messaging increases willingness to grant a permission or adopt a product. Apple's on-device marketing is extensively deployed but Apple publishes no efficacy data.

## Q7. Onboarding flows that front-load trust — A/B evidence

### Takeaway
I found **no credible, methodologically transparent A/B data** on adding a pre-permission explainer screen to an onboarding flow and its effect on completion rates. Everything available is vendor content with unattributed numbers. This should be stated plainly in the report rather than papered over.

### Cited Findings
- Practitioner consensus (not data): showing a custom in-app screen explaining the value before triggering the native OS dialog produces "meaningfully higher" opt-in than hitting users with the system prompt cold; the mechanism cited is that a pre-prompt is *retryable* whereas the OS prompt is one-shot and a denial is close to permanent. — [AdExchanger: Perfect your iOS 14 opt-in strategy with pre-permission prompts built with context and trust](https://www.adexchanger.com/data-driven-thinking/perfect-your-iOS-14-opt-in-strategy-with-pre-permission-prompts-built-with-context-and-trust/) **[industry commentary]** *(note: URL casing — canonical link is the AdExchanger data-driven-thinking post of the same title)*
- Google's platform guidance operationalizes the same idea via `shouldShowRequestPermissionRationale()` and additionally recommends real-time notifications and privacy indicators during sensitive-data access "to maintain user trust." — [Android Developers](https://developer.android.com/training/permissions/requesting); [App permissions best practices](https://developer.android.com/training/permissions/usage-notes) **[platform guidance]**
- AppsFlyer's timing data cuts both ways: the **highest** opt-in rates came from prompting at first launch, even though 30% of non-gaming apps did better at day 7 — so "wait until the user has experienced value" is not a universally winning strategy. — [AppsFlyer](https://www.appsflyer.com/blog/trends-insights/att-opt-in-rates-higher/) **[vendor data]**

### Inferences
- The one-shot nature of the OS dialog is the most rigorous argument available for Plover's design, and it is a *mechanical* argument rather than an empirical one: on macOS, a denied screen-recording permission requires a trip to System Settings plus an app relaunch to reverse, so the expected cost of an uninformed denial is very high. A pre-permission screen converts an irreversible one-shot into a reversible conversation. This is defensible without any grant-rate statistic.
- The counter-argument the case study should confront: the Berkeley research favors *just-in-time* requests tied to a specific user action, while Plover's design front-loads all three guarantees during onboarding — before the user has any experienced need for progress inference. An onboarding screen is closer to install-time framing, and the strongest evidence in Q1 is that install-time framing fails.

### Gaps
- No public onboarding A/B dataset (Amplitude, Mixpanel, Appcues, Reforge, etc.) with an explainer-screen arm was located in this session.
- No desktop-app onboarding benchmarks at all; the entire quantified literature is mobile.

## Cross-cutting notes for the report-writer

- **Verify before quoting:** the 95%-blocked / 60%-denial figures (Q1) came from search-engine extraction of PDFs I could not parse. The PDFs were saved locally during fetching but not re-read.
- **Do not quote as research:** the 81% grant-rate lift, 28% contextual lift, 72%/43% uninstall figures, and the 20–40pp pre-prompt lift. All are vendor or commentary numbers with no traceable methodology.
- **Strongest supporting evidence for Plover's thesis:** contextual-integrity research (Q1), the CHI 2025 finding that workers are confidently wrong about monitoring (Q5), the APA monitoring-harm data (Q5), and the mechanical one-shot argument (Q7).
- **Strongest challenges to Plover's thesis:** the privacy-paradox meta-analysis (Q4), the absence of any evidence that on-device messaging converts (Q6), AppsFlyer's finding that first-launch prompting often wins (Q7), and the Berkeley distinction between just-in-time and upfront — under which an onboarding screen may be the wrong side of the line (Q1, Q7).

# Gajendra LinkedIn launch post

- **Status:** final draft for owner review — repository gate satisfied; not published
- **Primary image:** [`evidence/launch/gajendra-hero.png`](../evidence/launch/gajendra-hero.png)
- **Publish:** **Thursday, 20 August 2026 at 5:00 PM IST**. If manual final review is not complete
  by 4:45 PM, use **Friday, 21 August 2026 at 3:00 PM IST**.
- **Repository gate:** [PR #21](https://github.com/siddath/Gajendra/pull/21) is merged; its pull-request
  checks and the merged-main [CI run 32244790765](https://github.com/siddath/Gajendra/actions/runs/32244790765)
  both passed the plugin/browser/audit and macOS companion jobs.
- **Availability boundary:** source is public and buildable; there is no signed/notarized download

## Why this time

Buffer's 2026 analysis of 4.8 million LinkedIn posts places Thursday's strongest slot at 5:00 PM
and Friday's at 3:00 PM in the audience's local timezone. Treat this as a first experiment, not a
guarantee, and prefer your own profile analytics once there is enough history:
[Buffer's 2026 LinkedIn timing analysis](https://buffer.com/resources/best-time-to-post-on-linkedin/).

Post manually and keep the following hour free for real replies. LinkedIn says its feed is reducing
generic content, engagement bait, automated comments, and engagement pods in favor of authentic
professional conversation:
[LinkedIn's 2026 feed update](https://news.linkedin.com/2026/ImprovingTheFeed).

## Ready-to-paste post

I was not losing my AI work.

I was losing the decision about what to return to next.

A build could still be running in Codex. A draft could be waiting in Claude. A finished result
could need my review. Everything was open, but nothing gave me one clear picture of what needed my
attention.

So I built a small macOS side project called **Gajendra**.

🎯 **NOW** keeps one thread unmistakably current.

🏃 **Running** shows the work the provider says is still active.

👀 **Ready for Review** separates finished work that needs a human decision.

🔗 **Open** takes me back to the owning tool instead of copying the conversation into another app.

The idea is simple:

**One NOW. One short queue. One click back to the exact thread.**

I built it local-first. Gajendra remembers my priorities, while Codex, Claude, Cursor, and Grok keep
owning their sessions, prompts, transcripts, and credentials.

I also used a multi-agent development approach—but with clear ownership rather than an open-ended
swarm. Separate lanes handled the native experience and provider logic, an adversarial reviewer
tried to break the result, and I integrated the final decisions. That process found problems a
happy-path demo would never show, while keeping the app self-contained.

The source is public and buildable today. A signed and notarized download comes later, and the
mobile companion is still a plan—not a shipped feature.

Repository: https://github.com/siddath/Gajendra

What is the smallest layer you wish existed above your AI tools?

#BuildInPublic #LocalFirst #AIEngineering #macOS

## Suggested alt text

Gajendra macOS utility with synthetic demo data. The screen shows one NOW task, two Focus tasks, two
Important tasks, two Running tasks, and one Ready for Review item across Codex, Claude, and an
explicitly labeled demo review feed.

## Publication checklist

- Attach `gajendra-hero.png` as the first image.
- Paste the suggested alt text.
- Confirm the updated README and hero are visible on `main` immediately before posting.
- Publish manually at the suggested time and reply in your own voice.
- Do not add a download CTA until Developer ID, notarization, Gatekeeper, archive, and clean-Mac
  gates are complete.

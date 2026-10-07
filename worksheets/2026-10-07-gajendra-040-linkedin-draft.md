# LinkedIn draft — Gajendra 0.4.0

Prepared for Sid; not posted to LinkedIn. Suggested image: [`gajendra-hero.png`](../evidence/launch/gajendra-hero.png).

---

🐘 A quick update on Gajendra, the small widget I've been building to keep track of work across my AI tools. I've released v0.4.0 with a few improvements to how it works day to day.

The main issue was the wait every time I refreshed it or changed a priority. Repeated provider listing turned out to be the bottleneck. Cutting out unnecessary scans and keeping metadata ready in a local cache brought refresh latency down by over 90%, which has made the widget much more usable.

⚡ Across three runs in my local backend tests, median refresh time came down from 15.05 seconds to 0.80 seconds—a 94.7% reduction. Local changes went from 15.92 seconds to 0.11 seconds. These are backend timings on my setup, including the CLI process overhead.

I've also made it easier to review a response, undo that action, finish or reopen work, and carry it into another chat without losing track of the earlier one. There are some smaller changes to the widget too, including smoother hover and click feedback.

🧩 I've developed a Codex plugin for Gajendra as well. It shares the same local backend and priorities as the widget, so I can use it from either place. I'm planning to submit the plugin to OpenAI for approval.

🔒 Gajendra still keeps its priorities and cached metadata local. The providers still own the conversations and transcripts; Gajendra doesn't copy those into its own store.

🔗 The latest source and release notes are here:
https://github.com/siddath/Gajendra/releases/tag/v0.4.0

Repository:
https://github.com/siddath/Gajendra

If you use a lot of AI tools, where do you lose track most often—choosing what to work on, reviewing what's finished, or picking it up again in another chat? I'd like to hear what would help.

#BuildInPublic #DeveloperTools #OpenSource #ArtificialIntelligence #macOSDevelopment

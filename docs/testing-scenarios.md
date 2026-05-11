# Tester scenarios — Paleo Presto

Thanks for helping us shake out the platform. Please run through these
scenarios in order. After each one, jot down:

- The **time** you started the scenario (your local clock is fine).
- Any **errors, blank screens, or hangs** longer than ~30 seconds.
- Anything that **looked weird** even if it eventually worked.

Send your notes back in whatever form is easiest (email, Slack, a text
file). The wall-clock times are the most important thing — we use them
to correlate against server-side metrics.

---

## Scenario 1 — First-time visit, archived compilation (5 min)

The simplest path. Tests that the orchestrator can serve forms and
dispatch a reconstruction without any user-side data wrangling.

1. Open https://custom.paleopresto.com/ in a fresh browser window
   (or incognito mode).
2. Click through to the **LMR** reconstruction.
3. On the query page, choose **Archived compilation** (the lighter
   path).
4. Pick any compilation from the dropdown (any will do).
5. Submit the reconstruction.
6. You should land on a confirmation page or be taken to the editor.
   **Stop here** — don't wait for the reconstruction itself to finish.

**Note**: Time started ▢▢:▢▢, anything weird? ____________

---

## Scenario 2 — Filtered query with data cleaning (10 min)

The heavier path, with a Python-side analysis step. This is the path
most likely to stress the proxy-analysis container.

1. From the home page, start a new LMR reconstruction.
2. Choose **Filtered query** instead of archived.
3. On the query page, set:
   - Latitude range: -30 to 30
   - Time range: 0 to 2000 yr BP
   - Archive types: leave defaults
4. Submit the query.
5. On the data-cleaning page that follows, **click "Continue"** without
   making any manual edits — this triggers the analysis.
6. Wait for the analysis to finish (can take 30–90 s). If it hangs
   longer than 3 min, note the time and reload.
7. Confirm and proceed to the editor.

**Note**: Time started ▢▢:▢▢, analysis time ____ s, anything weird? ____

---

## Scenario 3 — Concurrent submission (multi-tester, 5 min)

Run this only **if multiple testers are on at the same time** and we
explicitly call for it. The point is to fire off submissions
simultaneously to see how the platform handles a burst.

1. When the run leader says "go", everyone clicks Submit on a
   reconstruction that's already configured.
2. Note your submission time and what you saw afterward.

**Note**: Time of "go" ▢▢:▢▢, response received? ____________

---

## Scenario 4 — Browse without submitting (5 min)

Light load, but lots of clicks. Catches issues with template caching
and static asset serving.

1. From the home page, click into 3 different reconstruction types
   (LMR, Holocene DA, Temp12k).
2. On each, open the query page but don't submit.
3. Hit the back button and return home between each.

**Note**: Time started ▢▢:▢▢, anything weird? ____________

---

## Scenario 5 — Reuse an existing reconstruction (5 min)

If you have run a reconstruction before, this re-runs it from saved
artifacts. Tests the `/reuse` route.

1. Go to https://custom.paleopresto.com/reuse
2. Pick a previous reconstruction.
3. Step through to the editor without changing anything.

**Note**: Time started ▢▢:▢▢, anything weird? ____________

---

## What to send back

A short message like:

> Did all 5 scenarios. Started Scenario 2 at 14:07; the cleaning page
> sat blank for ~2 min before the spinner appeared, then finished
> quickly. Scenario 5 worked fine. Otherwise nothing weird.

That's enough — we have server-side metrics that will fill in the
rest.

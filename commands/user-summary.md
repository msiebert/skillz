---
description: Generate a summary of an end user from a Mixpanel customer's project
allowed-tools: Bash(mp:*), Read, Grep, Glob
---

# User Summary

Generate a concise, insight-driven summary of an end user in a Mixpanel
project using the `mp` CLI tool (`mixpanel_data`). This is for understanding
users of a Mixpanel customer's product (e.g., a user of McDonald's app, a
player in a gaming app, a shopper on an e-commerce site).

## Input

The user will provide a **distinct_id** as the argument: $ARGUMENTS

If no distinct_id is provided, use AskUserQuestion to ask for one.

## Prerequisites

1. Verify `mp` is installed: run `mp --version`. If not found, tell the user
   to install it:
   ```
   pip install git+https://github.com/jaredmcfarland/mixpanel_data.git
   ```
2. Verify auth is configured: run `mp auth show`. If not configured, tell the
   user to run `mp auth add` and stop.

**Important:** The current repo's `.python-version` may conflict with the
Python version `mp` was installed under. If `mp` fails with a pyenv error,
prefix all `mp` commands with `PYENV_VERSION=3.11.7` to override the local
Python version (e.g., `PYENV_VERSION=3.11.7 mp inspect events`).

## Step 1: Discover the Project's Schema

Before fetching user data, understand what events and properties exist in this
project. This context is essential since every Mixpanel customer tracks
different events and properties.

```bash
mp inspect events
```

Note: `mp inspect properties` requires an `-e/--event` flag (there is no
`--type user` option). Skip user property inspection here — user properties
will be visible in the profile fetch in Step 2.

Note the event names — these tell you what the product is and what actions
users can take.

## Step 2: Fetch User Profile

```bash
mp fetch profiles --distinct-id "$DISTINCT_ID" --stdout --format json
```

Extract all available identity and account information from their profile
properties. The specific properties will vary by customer — look for patterns
like name, email, plan, signup date, location, account type, subscription
status, etc.

## Step 3: Fetch Recent Events for Analysis

Try matching on `$user_id` first (most common for logged-in users). If the
fetch returns 0 rows, retry with `$distinct_id` instead:

```bash
mp fetch events user_events --from <30 days ago> --to <today> \
  --where 'properties["$user_id"] == "$DISTINCT_ID"' \
  --replace
```

If that returns 0 rows:

```bash
mp fetch events user_events --from <30 days ago> --to <today> \
  --where 'properties["$distinct_id"] == "$DISTINCT_ID"' \
  --replace
```

Then run these queries to build a picture of the user's behavior.

**Important — SQL quoting rules for `mp query sql`:**
- Use double-quoted shell strings for the outer wrapper.
- Escape `$` characters with `\$` to prevent shell variable expansion
  (e.g., `\$mp_click`, `\$user_id`).
- Use single quotes normally inside double-quoted strings for SQL string
  literals.
- Example:
  ```bash
  mp query sql "SELECT event_name, COUNT(*) as count FROM user_events WHERE event_name <> '\$mp_click' GROUP BY 1 ORDER BY count DESC LIMIT 10"
  ```

**Overall stats:**

```bash
mp query sql 'SELECT COUNT(DISTINCT event_name) as unique_events, COUNT(*) as total_events, COUNT(DISTINCT DATE(event_time)) as active_days FROM user_events'
```

**Top actions by frequency:**

```bash
mp query sql 'SELECT event_name, COUNT(*) as count FROM user_events GROUP BY 1 ORDER BY count DESC LIMIT 20'
```

**Daily activity pattern:**

```bash
mp query sql 'SELECT DATE(event_time) as day, COUNT(*) as events, COUNT(DISTINCT event_name) as unique_events FROM user_events GROUP BY 1 ORDER BY 1 DESC LIMIT 30'
```

**First and last event (tenure and recency):**

```bash
mp query sql 'SELECT MIN(event_time) as first_event, MAX(event_time) as last_event FROM user_events'
```

**Additional drill-down queries:** After reviewing the top-level results,
run additional GROUP BY queries to explore feature-area usage. Filter out
noisy autocapture/performance events (those starting with `$mp_`,
`$experiment`, `[ui-perf]`, `Browser API`) to focus on meaningful product
actions. Example:

```bash
mp query sql "SELECT event_name, COUNT(*) as count FROM user_events WHERE event_name NOT LIKE '[ui-perf]%' AND event_name NOT LIKE '\$mp_%' AND event_name NOT LIKE '\$experiment%' AND event_name NOT LIKE 'Browser API%' GROUP BY 1 ORDER BY count DESC LIMIT 30"
```

If any step fails (e.g., no events found, date range issues), note it and
continue with whatever data is available.

## Step 4: Synthesize Summary

Use the schema from Step 1 to interpret events in the context of the specific
product. For example, if the project tracks "Add to Cart" and "Purchase",
this is likely an e-commerce app. If it tracks "Level Complete" and
"In-App Purchase", it's likely a game. Let the events tell you what the
product is and frame the summary accordingly.

Combine all gathered data into a summary with these sections:

```
# User Summary: [name or distinct_id]
**Product context:** [Brief description of what this product appears to be,
inferred from the event names and properties]

## Identity
- All available profile properties: name, email, distinct_id, etc.
- Account age, last seen
- Location, timezone (if available)
- Any segmentation-relevant properties (plan tier, account type,
  subscription status, cohort, etc.)

## Engagement
- Characterize how active this user is qualitatively (e.g., "daily active
  user", "visits a few times a week", "sporadic usage")
- Active days in last 30 days as context, but lead with the characterization
- Describe the activity trend (ramping up, winding down, steady, erratic)
  and note any notable shifts or patterns (e.g., "consistent weekday user",
  "bursts of activity followed by quiet periods")

## Top Actions (Last 30 Days)
- Group events into feature areas and describe what the user is doing
  qualitatively (e.g., "heavily uses reporting features", "explores the
  settings area occasionally")
- Note which features are used broadly vs deeply
- Highlight notable workflows — sequences of related actions that suggest
  a goal or routine
- Use relative frequency (e.g., "heavy", "moderate", "light") rather
  than exact event counts

## Intent & Context
Based on the patterns in their data, infer what this user is likely
trying to accomplish. Use these signals:

- **Event sequences**: What do their actions in close succession suggest?
  e.g., Search → View Item → Add to Cart → Checkout = purchase intent
- **Feature breadth vs depth**: Many features used shallowly = exploring
  or evaluating. Few features used heavily = habitual user with a defined
  workflow.
- **Recency patterns**: Sudden spike after quiet = re-engaging. Steady
  daily usage = embedded in routine. Declining = at risk of churning.
- **Session clusters**: What do bursts of activity around the same feature
  suggest about what the user is trying to get done?

Classify their likely intent as one or more of:
- Exploring/Evaluating — broad, shallow usage across many features
- Core workflow — repetitive, consistent patterns on same features
- Goal-directed — focused sequence of actions toward a clear outcome
- Re-engaging — gap in activity followed by a burst
- At risk — declining activity or long gaps between sessions
- New user / Onboarding — early in their journey, trying things out
- Power user — high frequency, high breadth, deep engagement

Write 2-3 sentences explaining what you think this user is trying to do
and why, grounded in specific data points.

## Recommended Actions
Based on the user's engagement level, intent, and behavior patterns,
suggest 3-5 specific actions the product team or customer success team
could take to increase this user's engagement. These should be concrete
and actionable, grounded in what the data shows. Examples of the kind
of recommendations to consider:

- If the user is exploring but hasn't adopted a core feature → suggest
  targeted onboarding or a nudge toward that feature
- If the user is highly active but hasn't tried a complementary feature →
  suggest a cross-sell or feature discovery prompt
- If the user's activity is declining → suggest a re-engagement campaign,
  personalized email, or check-in
- If the user is blocked or repeating failed actions → suggest a support
  intervention or UX improvement
- If the user is a power user → suggest referral programs, beta access,
  or community involvement
- If the user is new → suggest onboarding flow improvements based on
  where they dropped off or what they haven't discovered yet
- If the user has a specific goal (e.g., purchase intent but no
  conversion) → suggest removing friction in that flow

Frame recommendations in terms of what would help THIS specific user
based on THEIR data, not generic best practices.

## Notes
- Anything unusual or noteworthy
- Data quality observations (e.g., sparse data, missing properties)
```

Keep the summary concise and factual. Ground every inference in specific
data points. If a section has no data, say so briefly rather than omitting it.

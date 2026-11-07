# Style

How you talk and how your reports look. These are the org's preferences, not rules of the job. Only admins change them, with "preference:" (see `AGENTS.md` → Learning from feedback). Read this file at the start of every session. If a line here conflicts with `AGENTS.md`, `AGENTS.md` wins.

## How you talk

- Keep replies short and plain: no filler, no hype.
- Ask at most one clarifying question, at the end.
- Say what you did and what you found, nothing more. No opinions ("much clearer", "solid article"), no explaining why something matters, no summing up, no lead-ins ("Here's what I found"), no closing offers ("Let me know if..."). If you don't know something, say so in one line. Before posting, delete any sentence that isn't a fact or a question you need answered.
- No emoji beyond the ack reaction and the status circles (see Status circles).
- In everything you write (Slack replies, PR titles and descriptions, new entries in your files), never use em dashes or en dashes, and don't replace them with a spaced hyphen or a double hyphen. Use a period, comma, colon or parentheses instead. This includes the cards and the status labels.

## How your reports look

`AGENTS.md` → Reporting says what each report contains. This section says how it looks.

### Status circles

| Status | Circle |
| --- | --- |
| Error | :red_circle: |
| In review | :large_yellow_circle: |
| Needs draft | :large_orange_circle: |
| Declined | :black_circle: |
| Skipped | :white_circle: |
| Published | :large_blue_circle: |
| Passes | :large_green_circle: |

### Cards

Layout, top to bottom:

1. A section with one mrkdwn line: "*KA*-`<article number>` *· <title>*", so KA and the title are bold and the number is code, with no status emoji.
2. A section with one text block on two lines: "*Score*: " and the score line, then "*Failed*: " (Failed in bold) and the failed rules on the next line. Score line shape: "5/9, *falls short*" or "9/9, *passes*". Omit the "*Failed*:" line when nothing failed.
3. A section with the status on one line: the status circle, then "*Status*", a colon and the status label (plain, not bold), for example ":large_yellow_circle: *Status*: In review". A Skipped card's reason, an Error card's `parsed_error` and the "Tried twice. Needs a human." line each go on their own line right under the status line (plain text).
4. A section with "*Article:* <link|Open article>   *Draft:* <link|Open draft>" (draft link or "none").

Failed rules are separated by commas. When several cards go in one reply, put a divider block ({"type":"divider"}) between them.

Example, as sent: article line "*KA*-`0001234` *· How do I update my direct deposit?*"; Score line "Score: 5/9, falls short" and next line "*Failed*: G2 Answer first, G4 Numbered steps, G6 Tables as lists"; Status line ":large_yellow_circle: *Status*: In review"; links line "Article: Open article   Draft: Open draft". Error card, status line ":red_circle: *Status*: Error", then under it "{{agent.name}}'s Salesforce connection isn't allowed to create drafts. Ask your admin to check the connector's permissions."

### Summary

Same style as the cards. Layout, top to bottom:

1. A header block: "Article review run".
2. Right after the header, one context block with one mrkdwn element on two lines, with a line break (\n) between them. Line 1: the run time as a Slack date token, so each reader sees their own time zone: `<!date^<unix time of the run start>^{date_short_pretty} at {time}|<YYYY-MM-DD HH:MM> UTC>`, then " · ", then the link `<Setup → Salesforce list of knowledge articles URL|All knowledge articles in Salesforce>`. Line 2, only when Articles Activity has at least one article: "Details for each changed article are in the thread." When Articles Activity says "No changes", the context block has only line 1.
3. A section "*Statuses*", then one line per status: the status circle, the status label in bold, a colon and the count. Example: ":large_yellow_circle: *In review*: 2".
4. A divider block ({"type":"divider"}).
5. A section "*Articles Activity*". Each group is one bold line "*<old status> → <new status>*", then one line per article: "`<article number>` · <title>" (number as code, " · ", the title; no KA prefix, no bold). Put one empty line between groups and none after the last. Example: "*In review → Declined*\n`000001005` · Troubleshooting sync errors\n\n*In review → Passes*\n`000001003` · Updating your billing information".
6. Only if an article errored, a section "*Errors*", then one line per errored article: ":red_circle: `<article number>` · <title>: failed at step <step number> <step name>".

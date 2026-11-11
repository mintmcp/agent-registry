# Knowledge

This file holds the agent's data and admin settings (how you talk and how your reports look are in `style.md`): Setup, Rule titles, Decisions, Never do, Pending suggestions, Scheduled runs (Actions and Run state) and Article object. Read it at the start of every session. New lessons go under Taught instructions until they are moved to `AGENTS.md`.

## Taught instructions

None.

## Setup

Set by an admin, with the date and who. Only an admin changes these, by saying so.

- Admins: {{setup.admins}}. Only admins change Setup, Scheduled runs → Actions, Rule titles and your rules. (set {{install.date}}, {{install.by}})
- Reviewers: {{setup.reviewers}}. Admins and reviewers can decline, redo and retry. (set {{install.date}}, {{install.by}})
- Guideline: `guideline.md` in my folder (`{{agent.slug}}/guideline.md`). (set {{install.date}}, {{install.by}})
- Max articles per run: {{setup.max_articles_per_run}}. Applies to every action (review, draft or both). (set {{install.date}}, {{install.by}})
- Article scope: {{setup.article_scope}}. (set {{install.date}}, {{install.by}})
- Run channel: {{setup.run_channel}}. (set {{install.date}}, {{install.by}})
- Salesforce host for article links: `{{setup.salesforce_host}}`. Article link = host + `/lightning/r/Knowledge__kav/<Id>/view`. (set {{install.date}}, {{install.by}})
- Progress updates in Slack runs: {{setup.progress_updates}}. "no" means ack with one reaction and post only the final reply. (set {{install.date}}, {{install.by}})
- Post summary when nothing changed: {{setup.post_when_no_changes}}. Applies to scheduled runs. (set {{install.date}}, {{install.by}})
- Handoff contacts: [{{setup.handoff_contacts}}]. Tag them when you hand off to a human or point someone to an admin. If the list is empty ([]), tag no one. (set {{install.date}}, {{install.by}})
- Salesforce list of knowledge articles URL: `{{setup.salesforce_host}}/lightning/o/Knowledge__kav/list?filterName=__Recent` (host + `/lightning/o/Knowledge__kav/list?filterName=__Recent`). Used in the summary's context block (see `AGENTS.md` → Reporting → Summary), built from Setup → Salesforce host. (set {{install.date}}, {{install.by}})

## Rule titles

Short titles of the rules in `guideline.md`, one line per rule. Only an admin changes this section, except rewriting it from `guideline.md` (see `AGENTS.md` → Guideline and scoring). When `guideline.md` changes, rewrite this section from it.

None yet. Write them from `guideline.md` once an admin has filled it in.

## Decisions

Preferences from admins, one line each: "YYYY-MM-DD: <decision>. Why: <reason>. From: <name>". Apply them from now on.

None yet.

## Never do

Rules from admins and reviewers, one line each: "YYYY-MM-DD: <rule>. Why: <reason>. From: <name>". Check every draft against this section before saving it.

None yet.

## Pending suggestions

One line each: "YYYY-MM-DD: <suggestion>. Why: <reason>. From: <name>".

None.

## Scheduled runs
Set {{install.date}} by {{install.by}}. Only an admin changes this section.

### Actions
Actions: {{setup.scheduled_actions}}
Each scheduled run, in order:

1. Status: check your pending drafts in reviews.csv against Salesforce.
2. Pick: from Setup → Article scope, in this order, up to Setup → Max articles per run: articles in Error (attempts under 2), then articles published again since you scored them, then articles not in reviews.csv yet.
3. Score: against guideline.md (the file named in Setup → Guideline), read fresh.
4. Draft (only if Actions includes draft): the ones that fall short, up to Setup → Max articles per run. Check each against Never do and evals/ first if these sections exist. If Actions is review only, and the articles falls short, the status is "Needs draft".
5. Report: one summary at the top level of Setup → Run channel, with a card in its thread for every article whose status changed since the last scheduled run's summary, in the same order as "Articles Activity" (see `AGENTS.md` → Reporting → Summary). When nothing changed, post the summary only if Setup → Post summary when nothing changed is "yes".
6. Save: the run time under Run state, then copy each row's status into last_run_status.

### Run state
Last scheduled run: none yet. Step 6 of Actions saves the run time (UTC) here, then copies each row's status into last_run_status.

## Article object

Not checked yet. Find it before the first run (see `AGENTS.md` → Salesforce connection and querying) and write here: the object name, its body fields, the other fields used in reviews, the languages and the record types. Re-check with `describe_object` if a query fails; never guess.

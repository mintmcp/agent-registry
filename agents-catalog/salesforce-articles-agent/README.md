# Salesforce Articles Agent

Makes Salesforce Knowledge articles AI-ready. It scores each article against your guideline and, when one falls short, saves a rewrite as a Salesforce draft. A person reviews and publishes every draft. The agent never publishes, archives or deletes an article.

It runs on a daily schedule and posts a summary to a Slack channel. People can also tag it in Slack to review, score or draft specific articles, check coverage, or decline, redo and retry drafts.

## What you need

- The Salesforce connector, connected as a user with Manage Articles.
- Your AI-ready guideline, with rules and a scoring section. The agent asks an admin for it on first use.
- A Slack channel for the run summary, and the people who act as admins and reviewers.

## Make it yours

How it talks and how its cards and run summary look live in `style.md`, separate from its instructions. The install form sets three of them (progress updates, posting a summary when nothing changed, who to tag on handoffs). Admins change the rest in Slack with "preference: ...".

## What it learns

Admins teach it in Slack. "preference: ..." is saved as a Decision. "instruction fix: ..." opens a pull request on its own instructions. Reasons reviewers give when declining drafts can become "Never do" rules.

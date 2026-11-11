# Install

For an agent or a person installing this template through the `mintmcp` admin connector.

1. Check that the org has the Salesforce connector installed. If not, install it first: the agent can't work without it.
2. Ask the user for the admins and the reviewers. Pass their Slack user IDs.
3. Ask for the run channel. Pass its Slack channel ID.
4. Ask for the Salesforce Lightning host, for example `https://yourorg.lightning.force.com`, without a trailing slash.
5. Confirm or change the defaults: max articles per run (5), article scope (published, en_US, all record types) and scheduled run actions (review and draft).
6. Ask about style: progress updates in Slack (default off), post the summary when nothing changed (default on), and who to tag on handoffs (default no one, pass Slack user IDs).
7. Create the agent with `create_coworker_agent_from_template`, then give the user every `nextSteps` link it returns (connector credential, model credential, access).
8. Tell the user to paste their guideline in Slack and ask an admin to save it. The agent won't score anything until `guideline.md` has rules and a scoring section.
9. Tell the user that tone, emoji, punctuation and the card and summary layout are in `style.md`, and that admins change them in Slack with "preference: ...".

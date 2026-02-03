# Project State

## Vision
Provide a unified ticketing and collaboration platform integrated with Microsoft Teams to manage tasks, communications, and resources in one place. Each ticket is a living workspace with conversation threads, status updates, and attachments.

## Current Features

- **Tickets** – Manage tasks or issues within the system.
- **Teams Chat per Ticket** – For each ticket, there is a dedicated Microsoft Teams group chat for real-time discussion.
- **My Tickets** – A personalized view showing tickets assigned to the user.
- **Locations** – Manage or view information grouped by physical or logical locations (e.g., offices, sites).

## Architecture

- **Frontend** – Placeholder for the current front‑end stack.
- **Backend** – Placeholder for the current back‑end stack handling business logic, authentication, and integrations.
- **Auth** – Placeholder for OAuth / Azure Active Directory configuration.
- **Data Store** – Placeholder for the database and storage technologies used.
- **Hosting** – Placeholder for hosting platforms (Render, Vercel, Azure).

## Environments

- **Local** – Information on how to run and configure the app locally.
- **Render** – Deployment configuration and environment variables for Render.
- **Vercel** – Deployment configuration and environment variables for Vercel.
- **Azure Dependencies** – List of Azure resources (e.g., App registrations, Functions) and any required configuration.

## In‑Progress

List any features currently under development. For example:

- Integrate help‑desk knowledge base.
- Implement AI-driven summarization for chat discussions.

## Feature Backlog / Ideas

This section captures feature ideas to consider:

- **AI‑Driven Summarization** – Automatically summarize chat conversations and extract action items.
- **Predictive Analytics** – Use historical ticket data to forecast delays, identify resource bottlenecks, and suggest priorities.
- **Hybrid Methodology Support** – Provide both Kanban/Scrum views and flexible workflows.
- **ESG Metrics** – Tag tickets with sustainability metrics and track progress.
- **Remote Team Support** – Introduce asynchronous check‑ins and time‑zone awareness features.
- **Knowledge Base Integration** – Suggest relevant articles when a ticket is created.

## Rules

- One ticket corresponds to exactly one Teams group chat.
- No silent architecture changes; all changes require approval.
- New features or major changes must be approved by the product owner (the Director).
- Agents (AI or otherwise) may suggest new features but cannot implement or merge changes without approval.

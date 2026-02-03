# Project State

## Vision
Provide a unified ticketing and collaboration platform integrated with Microsoft Teams to manage tasks, communications, and resources in one place. Each ticket is a living workspace with conversation threads, status updates, and attachments.

## Current Features

- **Tickets** – Manage tasks or issues within the system.
- **Teams Chat per Ticket** – For each ticket, there is a dedicated Microsoft Teams group chat for real-time discussion.
- **My Tickets** – A personalized view showing tickets assigned to the user.
- **Locations** – Manage or view information grouped by physical or logical locations (e.g., offices, sites).

## Architecture
- **Frontend** – A React + Vite app located in the `src` folder. It uses Node 22 for development and build. The compiled output lives in the `dist` folder and is served via Nginx (see `Dockerfile`). Tailwind CSS and PostCSS are used for styling.
- **Backend** – Serverless functions in the `functions` directory written in TypeScript for the Deno runtime. These functions use the Base44 SDK to read and write `Ticket`, `User` and other entities and integrate with external services like Microsoft Teams, Planning Center, and ClickUp.
- **Auth** – OAuth tokens for Microsoft, ClickUp and Planning Center are stored on the `User` entity (e.g., `microsoft_access_token`, `clickup_access_token`, `pco_access_token`). Microsoft Graph API is used for Teams chat and email integration.
- **Data store** – Base44 entities (e.g., `Ticket`, `User`) serve as the primary data store accessed via the Base44 SDK. No separate database is required. External data is fetched from ClickUp, Planning Center, and other services as needed.
- - **osting** – The frontend is built and served via Nginx using the provided Dockerfile. Serverless functions are deployed separately as Deno functions on Render or Vercel (Edge Functions) with appropriate environment variables.Render or Vercel (Edge Functions) with appropriate environment variables.
## Environments

- *- **Local** – Run `npm install` and `npm run dev` to start the Vite development server for the frontend. Run the serverless functions locally with the Deno runtime (for example, `deno task dev`) and load environment variables from a `.env` file. You need Base44 credentials and Microsoft/ClickUp keys for authentication.
- **Render** – The Dockerfile builds the frontend into a static site served via Nginx. Deploy the built `dist` directory to Render and set environment variables for Base44, Microsoft, Planning Center and ClickUp in the Render dashboard. Functions can be deployed separately as Deno functions on Render.
- **Vercel** – Alternatively, deploy the serverless functions to Vercel as Edge Functions. Configure the same environment variables for Base44, Microsoft, Planning Center and ClickUp.
- **Azure dependencies** – Requires an Azure App Registration for Teams chat and Graph API integration. A bot registration in Microsoft Teams and appropriate Graph API permissions (e.g., Chat.ReadWrite) must be configured. Credentials (client ID, tenant ID, client secret) are supplied via environment variables.

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

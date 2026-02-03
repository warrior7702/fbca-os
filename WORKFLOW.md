# Workflow

This document defines the standard process for introducing new features or changes to the FBCA OS project. All collaborators—both human and agent—should follow this workflow to ensure consistency and quality.

## Steps

1. **Idea → Spec**
   - The Director or Product Brain captures the high‑level idea or requirement.
   - The Product Brain writes a detailed feature specification using the spec template (see `docs/spec-template.md`). The spec should include a description, scope, data structures, UI changes, and acceptance criteria.

2. **Spec Review**
   - The Architecture/Risk Reviewer examines the spec for feasibility, scalability issues, and alignment with the existing architecture.
   - Feedback and required changes are incorporated into the spec. The spec must be approved by the Director before implementation begins.

3. **Implementation (Build)**
   - Once approved, the Implementation Copilot creates a feature branch and implements the changes exactly as specified.
   - Code should follow existing patterns and standards. All changes are submitted as a pull request.

4. **Verification**
   - The Director or Release/DevOps agent tests the feature in a staging environment against the acceptance criteria.
   - Any issues found are reported back to the Implementation Copilot for resolution before the pull request can be merged.

5. **Merge and Deploy**
   - After successful verification, the pull request is merged into the main branch using the standard GitHub workflow (e.g., rebase and merge).
   - The Release/DevOps agent deploys the updated application to the relevant environments (Render, Vercel, Azure), ensuring that environment variables and secrets are correctly configured.

6. **Update Project State**
   - The Project State document (`PROJECT_STATE.md`) is updated to reflect the new feature, its status, and any changes to architecture or environments.
   - The feature is moved from the backlog to "Current Features" or the appropriate section.

## Roles and Responsibilities

- **Director** – Sets the vision, prioritizes ideas, and makes final decisions.
- **Product Brain** – Translates ideas into detailed specs and manages backlog sequencing.
- **Creative Director** – Suggests new ideas and improvements, providing pros/cons to the Director.
- **Implementation Copilot** – Writes and modifies code according to the approved spec.
- **Architecture/Risk Reviewer** – Reviews designs for scalability, security, and alignment with the existing system.
- **Release/DevOps** – Manages deployments and environment configurations.

By following this workflow and clearly defined roles, the FBCA OS project can scale efficiently while maintaining high quality and alignment with the project's vision.

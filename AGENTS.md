# Project Notes

- `npm run lint` currently fails because the repository has no ESLint configuration. Do not report lint as passing until the configuration is added.

- The popup renders changes before a save finishes. Do not rebuild unchanged controls when the background confirms the save. This can discard text entered immediately after selecting a redirect option.

- Firefox browser tests can fail during startup on macOS with `sandbox_extension_issue_file_to_process` errors. Do not count a startup failure or fixture timeout as a passed extension test.

- To disable an MV3 surface, override its static redirect with an allow rule. Omitting a custom redirect does not disable lower-priority static rules. Keep shared Reddit patterns aligned with the nested routes in its static rules.

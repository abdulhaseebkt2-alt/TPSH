# MANDATORY RULE: Continuous Web APK Documentation Synchronization

Whenever ANY change is made to this codebase (features, bug fixes, UI adjustments, date picker tweaks, styles, permission updates, or scripts), you MUST:
1. Update `WEB_APK_DOCUMENTATION.md` in the project root.
2. Update the relevant technical/functional section describing the changed behavior.
3. Add a new row to Section 10: "Living Changelog & Revision History" in `WEB_APK_DOCUMENTATION.md` with:
   - Incremented version (e.g. v1.4.3)
   - Date & Time
   - Author / Agent
   - Files Modified
   - Clear summary of the change
4. Run `cmd /c npm test` and `cmd /c npm run build` to ensure tests and bundling remain green.
5. Commit both code files and `WEB_APK_DOCUMENTATION.md` together.

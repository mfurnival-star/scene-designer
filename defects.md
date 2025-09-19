# Scene Designer – Local Defect & Issue Log

> Track all open defects and issues for engineering and review.  
> Maintained in Copilot Space and manually updated here.

---

## Defects / Issues

### defect1: Shape delete issue (core bug)
After deselecting a shape (by clicking background), then reselecting and pressing Delete, the shape does not delete as expected.

### defect3: Point shape crosshair uneven
To discuss: allow choice of crosshair style via settings dropdown.

### defect4: Point shape should not be expandable
UI/transformer allows resizing/expansion of point shapes, which should be fixed.

### defect5: MiniLayout panel sizes not saved/restored
Panel sizing changes via splitters are not preserved between reloads.

### defect8: No scroll bars on canvas for large images
When loading an image larger than the canvas/panel, the expected scroll bars do not appear and the image/canvas is clipped to the panel size.  
**Expected:** Scroll bars (horizontal/vertical) should appear when the image is larger than the visible canvas area, allowing the user to pan and view the entire image.  
**Observed:** No scroll bars are shown; overflow is hidden, so large images cannot be fully viewed.

### defect9: Canvas panel cannot scroll on mobile due to gesture conflicts with marquee select and custom input
**Summary:**  
On mobile devices (Safari/iOS and similar), users cannot scroll/pan the Canvas panel when the image is larger than the visible panel. This is due to gesture/event conflicts with custom input features such as marquee selection, multi-select drag, or other pointer event listeners attached to the canvas.

**Details:**
- On desktop, scrollbars appear and the user can pan the Canvas panel as expected.
- On mobile (Safari/iOS), native scroll gestures are blocked by custom touch event handlers (marquee select, multi-select, etc), so the panel cannot be scrolled.
- The marquee select box and shape selection logic currently use touchstart/touchmove on the canvas panel/background, which prevents browser-native scrolling.
- As a result, users cannot pan to see the full image, making annotation difficult for large/tall screenshots on mobile.

**Expected:**
- On mobile, the user should be able to scroll/pan the Canvas panel using native swipe gestures if the image overflows the panel area.
- Marquee select and other custom gestures should not block scroll/pan, or should be triggered via a different gesture (e.g., long-press, two-finger, button-activated mode).

**Future considerations:**
- Consider refactoring touch/gesture logic to allow native scroll/pan on mobile, or provide a mode toggle between selection and pan.
- May require rethinking event delegation and gesture mapping for mobile platforms.
- For now, desktop users can test scroll/pan; mobile fix can wait.

**Status:**
Low priority; desktop testing is available and sufficient for now. Documenting for future UX improvements.

---

## Resolved Defects

### defect2: Log streaming not working **[RESOLVED]**
Remote log streaming does not reliably send logs to the server.
- **Resolution:** Console.Re remote logging now works as confirmed on 2025-09-19. All log levels stream to the dashboard, including TRACE/DEBUG. Mobile and remote debugging is now reliable.
- **Status:** Closed as resolved (2025-09-19).

### defect6: Remote log streaming not working (TRACE logs needed for defect diagnosis) **[RESOLVED]**
Remote log streaming is not reliably working in Scene Designer. When attempting to set logging to 'server' or 'both', TRACE/DEBUG logs are not consistently sent to the configured external server. This prevents effective mobile and remote debugging, especially for diagnosing complex issues (e.g., defect1).
- **Resolution:** Duplicate of defect2. Remote log streaming (including TRACE/DEBUG) is now confirmed working via Console.Re. Issue closed.
- **Status:** Closed as resolved (2025-09-19).

### defect7: FORCE values from index.html not reflected in settings **[RESOLVED]**
FORCE values set via `window.SCENE_DESIGNER_FORCE_SETTINGS` (from index.html) did not appear to be reflected in the settings panel and/or were not taking effect on page load. This prevented reliable override of settings from the HTML entry point.
- **Resolution:** Deploy script and settings.js were updated to ensure correct boolean coercion and robust FORCE settings merge on load. The settings panel now accurately reflects all FORCE overrides from index.html, including booleans such as INTERCEPT_CONSOLE.
- **Status:** Closed as resolved (2025-09-18).

---

## Instructions

- To add, update, or resolve any defect, request changes in Copilot Space.
- To publish an issue to GitHub, ask Copilot to draft a GitHub issue for the defect and attach relevant code or logs.
- For next actions, ask for “details on defectX”, “add a new defect”, or “mark defectX resolved”.

---

*Last updated: 2025-09-19*


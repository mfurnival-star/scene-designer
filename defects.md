# Scene Designer – Local Defect & Issue Log

> Track all open defects and issues for engineering and review.  
> Maintained in Copilot Space and manually updated here.

---

## Defects / Issues

### defect1: Shape delete issue (core bug)
After deselecting a shape (by clicking background), then reselecting and pressing Delete, the shape does not delete as expected.

### defect2: Log streaming not working
Remote log streaming does not reliably send logs to the server.

### defect3: Point shape crosshair uneven
To discuss: allow choice of crosshair style via settings dropdown.

### defect4: Point shape should not be expandable
UI/transformer allows resizing/expansion of point shapes, which should be fixed.

### defect5: MiniLayout panel sizes not saved/restored
Panel sizing changes via splitters are not preserved between reloads.

### defect6: Remote log streaming not working (TRACE logs needed for defect diagnosis)
Remote log streaming is not reliably working in Scene Designer. When attempting to set logging to 'server' or 'both', TRACE/DEBUG logs are not consistently sent to the configured external server. This prevents effective mobile and remote debugging, especially for diagnosing complex issues (e.g., defect1).
- See draft issue in Copilot Space for full steps, expected/actual behavior, and acceptance criteria.

---

## Instructions

- To add, update, or resolve any defect, request changes in Copilot Space.
- To publish an issue to GitHub, ask Copilot to draft a GitHub issue for the defect and attach relevant code or logs.
- For next actions, ask for “details on defectX”, “add a new defect”, or “mark defectX resolved”.

---

*Last updated: 2025-09-18*

# Automation emails

Source of truth for the MailerLite automation emails, so they can be re-pushed through the
MailerLite MCP (`update_automation_email_content`) after edits instead of being hand-edited
in the dashboard, which tends to break the table layout.

| File | Automation | Trigger group |
|---|---|---|
| `field-note.html` | Fuck Dating Apps — field note delivery (198841279434458439) | Fuck Dating Apps – Field Note (198841258567796144) |
| `field-note-webinar.html` | Fuck Dating Apps — field note delivery (webinar edition) (198923952951657651) | Fuck Dating Apps – Field Note (webinar edition) (198923903320458880) |

Forms: plain 198841275420509846, webinar edition 198923949935953900 (both in `src/config/webinar.ts`).
Segment "Fuck Dating Apps – Field Note (all)" (198923956660471020) unions both groups.

Which group the website posts to is decided at build time in `src/config/webinar.ts`
(`fieldNoteFormId()`): the webinar-edition form while a webinar date is in the future, the plain
form otherwise. The webinar-edition email is deliberately date-free; the webinar page carries the date.

MailerLite refuses content updates while an automation is active. Pause, push, reactivate.
Plain-text fallbacks are capped at 1,000 characters.

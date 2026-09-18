/**
 * The next live webinar. One place to update when a new date is set.
 *
 * `date` is ISO 8601 with a UTC offset. Set it to `null` when nothing is scheduled.
 * Pages read this at build time, so the site needs a rebuild once the date passes;
 * the deploy workflow runs on a daily schedule for exactly that reason.
 */
export const nextWebinar = {
	title: 'Fuck Dating Apps',
	// No run scheduled (the Sep 24, 2026 date was dropped for travel). Set an ISO date to schedule the next one.
	date: null as string | null,
	/** Shown after the weekday and date. Keep it short. */
	timeNote: 'evening CEST',
	url: '/webinar/',
	/** Calendar file in /public, or null if there isn't one for this run. */
	ics: null as string | null,
};

export type Webinar = typeof nextWebinar;

/** The webinar if its date is still ahead of `now`, otherwise null. */
export function upcomingWebinar(now: Date = new Date()): Webinar | null {
	if (!nextWebinar.date) return null;
	return new Date(nextWebinar.date) > now ? nextWebinar : null;
}

/**
 * MailerLite wiring for the field-note signup. Two embedded forms feed two groups, each with its
 * own delivery automation (see scripts/emails/README.md). The website posts to the webinar-edition
 * form only while a webinar is scheduled, so the email that goes out matches the situation.
 */
export const mailerlite = {
	accountId: '2536425',
	/** "Fuck Dating Apps — field note (embedded)" -> group "Fuck Dating Apps – Field Note" */
	fieldNoteFormId: '198841275420509846',
	/** "Fuck Dating Apps — field note, webinar edition (embedded)" -> group "... (webinar edition)" */
	fieldNoteWebinarFormId: '198923949935953900',
};

/** Which field-note form the site should post to, given the webinar schedule. */
export function fieldNoteFormId(now: Date = new Date()): string {
	return upcomingWebinar(now) ? mailerlite.fieldNoteWebinarFormId : mailerlite.fieldNoteFormId;
}

/**
 * Which field-note PDF to link. Both are built by `npm run build:onepager` from
 * scripts/one-pager/field-note.md (mirror of the Notion source page); the webinar edition
 * ends with a live-session box, the plain one with the program.
 */
export function fieldNotePdfPath(now: Date = new Date()): string {
	return upcomingWebinar(now) ? '/fuck-dating-apps-one-pager-webinar.pdf' : '/fuck-dating-apps-one-pager.pdf';
}

/** "Thursday, September 24 · evening CEST (time pending confirmation)" */
export function webinarDateLabel(w: Webinar = nextWebinar): string {
	if (!w.date) return '';
	const day = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone: 'Europe/Berlin',
	}).format(new Date(w.date));
	return w.timeNote ? `${day} · ${w.timeNote}` : day;
}

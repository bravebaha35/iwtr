// IWT Social Questions on / off. Questions put member-written public text on
// the site, so the Terms have to cover it before launch: left unset, the
// feature shows everywhere except the production build. Set
// NEXT_PUBLIC_SOCIAL_QUESTIONS_ENABLED=true (and the API's
// SOCIAL_QUESTIONS_ENABLED=true) to turn it on there.
const raw = process.env.NEXT_PUBLIC_SOCIAL_QUESTIONS_ENABLED;

export const SOCIAL_QUESTIONS_ENABLED = raw === "true" || (raw !== "false" && process.env.NODE_ENV !== "production");

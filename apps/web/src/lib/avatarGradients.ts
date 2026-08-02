// 12 Instagram-logo-style multi-stop gradients users can pick as their avatar
// background. Single point of edit — retune or replace any entry here and
// every avatar using it updates everywhere (`key` is the stable storage
// identifier in User.avatarGradient; `css` is a ready-to-use CSS value).
export const AVATAR_GRADIENTS = [
  { key: "sunrise", css: "linear-gradient(45deg, #833AB4, #C13584, #E1306C, #FD1D1D, #F77737, #FCAF45)" },
  { key: "berry", css: "linear-gradient(135deg, #8A2387, #E94057, #F27121)" },
  { key: "ocean", css: "linear-gradient(135deg, #2193b0, #6dd5ed)" },
  { key: "mint", css: "linear-gradient(135deg, #11998e, #38ef7d)" },
  { key: "grape", css: "linear-gradient(135deg, #4568DC, #B06AB3)" },
  { key: "flame", css: "linear-gradient(135deg, #f12711, #f5af19)" },
  { key: "dusk", css: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)" },
  { key: "candy", css: "linear-gradient(135deg, #ff9a9e, #fecfef)" },
  { key: "citrus", css: "linear-gradient(135deg, #f7971e, #ffd200)" },
  { key: "lagoon", css: "linear-gradient(135deg, #43cea2, #185a9d)" },
  { key: "rose", css: "linear-gradient(135deg, #eb3349, #f45c43)" },
  { key: "violet", css: "linear-gradient(135deg, #654ea3, #eaafc8)" },
] as const;

const CUSTOM_PREFIX = "custom:";

// A user-picked exact color (from the native color-picker popup) is stored as
// "custom:#rrggbb" — distinguishable at a glance from a preset key, and
// requiring no schema change since avatarGradient is already a loose string.
export function customGradientKey(hexColor: string): string {
  return `${CUSTOM_PREFIX}${hexColor}`;
}

export function customGradientColor(key: string | null | undefined): string | null {
  return key?.startsWith(CUSTOM_PREFIX) ? key.slice(CUSTOM_PREFIX.length) : null;
}

export function avatarGradientCss(key: string | null | undefined): string {
  const custom = customGradientColor(key);
  if (custom) return custom;
  return AVATAR_GRADIENTS.find((g) => g.key === key)?.css ?? AVATAR_GRADIENTS[0].css;
}

/** One look for every citizen-report surface: the For organisations serif, one button voice, one field. */

/** Newsreader, loaded as --font-display by the pages that host these components. */
export const serif = "font-[family-name:var(--font-display)] font-light tracking-[-0.015em] text-slate-900 dark:text-slate-100";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-out " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const SIZE = { sm: "h-9 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-sm", xl: "h-14 px-6 text-base" };

const TONE = {
  primary: "bg-cyan-700 text-white hover:bg-cyan-800 dark:hover:bg-cyan-600",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 aria-pressed:border-cyan-700 aria-pressed:bg-cyan-50 aria-pressed:text-cyan-900 " +
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:aria-pressed:bg-cyan-950 dark:aria-pressed:text-cyan-200",
  quiet: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-red-700 text-white hover:bg-red-800",
  dangerQuiet: "text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-950/50",
  approve: "bg-emerald-700 text-white hover:bg-emerald-800",
};

/** A button's classes: tone and size never overlap, so callers add only layout (width, margins). */
export const btn = (tone: keyof typeof TONE, size: keyof typeof SIZE = "lg") => `${BASE} ${SIZE[size]} ${TONE[tone]}`;

/** Keyboard focus on a visually hidden file input shows on the label that wraps it. */
export const fileFocus = "cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-cyan-500";

/** 16px text so phones do not zoom into the field. `fieldBox` has no width, for fields that size themselves. */
export const fieldBox =
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 transition-colors " +
  "focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
export const field = `${fieldBox} block w-full`;

export const muted = "text-slate-600 dark:text-slate-400";
export const link = "font-semibold text-cyan-800 underline-offset-2 hover:underline dark:text-cyan-400";
/** Hairlines: border and divider colour together. */
export const rule = "border-slate-200 divide-slate-200 dark:border-slate-800 dark:divide-slate-800";
/** Fades and lifts a freshly shown block in; still under reduced motion. */
export const enter = "transition duration-300 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none";

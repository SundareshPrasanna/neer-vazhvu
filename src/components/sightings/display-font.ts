import { Newsreader } from "next/font/google";

/** The For organisations serif, as --font-display, for the pages that host the citizen-report components. */
export const displayFont = Newsreader({ subsets: ["latin"], weight: ["300", "500"], variable: "--font-display", display: "swap" });

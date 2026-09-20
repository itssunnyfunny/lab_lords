import { Playfair_Display } from "next/font/google";

/** Kept on the public shell so authenticated screens retain their own typography. */
export const publicDisplayFont = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-display",
});

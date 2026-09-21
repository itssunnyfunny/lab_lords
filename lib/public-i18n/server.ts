import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { publicLanguageHeader, publicPathHeader, publicHref, type PublicLocale } from "./routes";
import { messagesFor, publicTranslator } from "./translate";
import { publicCatalog } from "./catalog";
import { publicUiKeysForPath } from "./ui-keys";

export const publicStrings = cache(async () => {
  const requestHeaders = await headers();
  const header = requestHeaders.get(publicLanguageHeader);
  const locale: PublicLocale = header === "hi" || header === "hinglish" ? header : "en";
  const messages = messagesFor(publicCatalog, locale);
  return { locale, t: publicTranslator(messages), href: (path: string) => publicHref(locale, path),
    uiMessages: Object.fromEntries(publicUiKeysForPath(requestHeaders.get(publicPathHeader) ?? "").filter(key => key in messages).map(key => [key, messages[key]])) };
});

import type { PublicLocale } from "./routes";

export type PublicMessages = Readonly<Record<string, string>>;
export type PlaceholderNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | PlaceholderNames<Rest> : never;
export type MessageValues<S extends string> = Record<PlaceholderNames<S>, string | number>;

export function publicTranslator(messages: PublicMessages = {}) {
  return <S extends string>(source: S, ...args: [PlaceholderNames<S>] extends [never] ? [values?: Record<string, string | number>] : [values: MessageValues<S>]): string => {
    const value = messages[source] ?? source;
    const values = args[0] as Record<string, string | number> | undefined;
    return values ? value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match) : value;
  };
}
export type PublicTranslator = ReturnType<typeof publicTranslator>;
export type PublicCatalog = Record<string, readonly [hindi: string, hinglish: string]>;
export function messagesFor(catalog: PublicCatalog, locale: PublicLocale): PublicMessages {
  return locale === "en" ? {} : Object.fromEntries(Object.entries(catalog).map(([key, values]) => [key, values[locale === "hi" ? 0 : 1]]));
}

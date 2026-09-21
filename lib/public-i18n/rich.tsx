import { Fragment, type ReactNode } from "react";
import type { PlaceholderNames, PublicTranslator } from "./translate";

/** Named React nodes keep complete sentences reorderable without HTML interpolation. */
export function publicRich<S extends string>(t: PublicTranslator, source: S, values: Record<PlaceholderNames<S>, ReactNode>): ReactNode {
  const translated = t(source as string);
  return translated.split(/(\{[A-Za-z][A-Za-z0-9_]*\})/g).map((part, index) => <Fragment key={index}>{
    part.startsWith("{") && Object.hasOwn(values, part.slice(1, -1))
      ? values[part.slice(1, -1) as PlaceholderNames<S>] : part
  }</Fragment>);
}

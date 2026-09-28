import type { ComponentProps } from "react";
// Visual fixture only: serve the same owned assets directly, without Next's optimizer.
export default function Image({ priority: _priority, ...props }: ComponentProps<"img"> & { priority?: boolean }) {
    void _priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
}

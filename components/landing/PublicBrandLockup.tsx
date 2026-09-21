import Image from "next/image";

export function PublicBrandLockup() {
  return <>
    <Image src="/brand-reference/open-book-leaf.svg" alt="" width={64} height={42} />
    <span>Lab <span className="reference-wordmark-leaf">Lords</span></span>
  </>;
}

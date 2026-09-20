import Image from "next/image";

export function NatureDetail({ className = "", variant = "branch" }: { className?: string; variant?: "branch" | "books" }) {
  return <div className={`nature-detail ${className}`} aria-hidden="true">
    <Image src={`/brand-reference/${variant === "books" ? "books-and-leaves" : "botanical-accent"}.webp`} alt="" width={720} height={720} sizes="(max-width: 760px) 180px, 280px" />
  </div>;
}

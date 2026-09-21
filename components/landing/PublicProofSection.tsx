import { publicStrings } from "@/lib/public-i18n/server";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ReceiptText } from "lucide-react";
import { approvedPublicProof, type PublicProof } from "@/lib/publicProof";

export async function PublicProofSection({ proof = approvedPublicProof }: { proof?: PublicProof }) {
  const { t, href: localHref } = await publicStrings();
  const hasProof = proof.metrics.length > 0 || proof.feedback.length > 0;

  return <section className="marketing-section marketing-customer-proof" aria-labelledby="public-proof-title">
    <div className="marketing-container">
      {hasProof ? <>
        <div className="marketing-section-heading">
          <p className="marketing-eyebrow">{t("Everyday library work")}</p>
          <h2 id="public-proof-title" className="marketing-title">{t(proof.feedback.length ? "What library owners say" : "Libraries using Lab Lords")}</h2>
        </div>
        {proof.metrics.length > 0 && <dl className="public-proof-metrics">{proof.metrics.map(metric => <div key={metric.id} lang="en-IN">
          <dt>{metric.label}</dt><dd><strong>{metric.value}</strong><p>{metric.definition}</p><small>{t("As of {date}", { date: metric.asOf })}</small></dd>
        </div>)}</dl>}
        {proof.feedback.length > 0 && <div className="public-proof-feedback">{proof.feedback.map(item => <figure key={item.id} lang="en-IN">
          {item.logo && <Image {...item.logo} alt={item.logo.alt} />}
          <blockquote><p>{item.quote}</p></blockquote>
          <figcaption><strong>{item.attribution}</strong><span>{item.library}</span></figcaption>
        </figure>)}</div>}
      </> : <div className="marketing-proof-grid">
        <div>
          <p className="marketing-eyebrow">{t("Payments & receipts")}</p>
          <h2 id="public-proof-title" className="marketing-title">{t("See how it works in your library")}</h2>
          <p className="marketing-lead">{t("Record full or partial payments and check how much each student has left to pay.")}</p>
          <p className="marketing-lead">{t("Download a receipt for a recorded payment and find it again in the student's collection history.")}</p>
          <Link href={localHref("/how-it-works")} className="marketing-text-link">{t("How it works")} <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <figure className="public-proof-receipt">
          <figcaption><span><ReceiptText size={20} aria-hidden="true" />{t("A recorded payment")}</span><span className="public-proof-sample">{t("Sample data")}</span></figcaption>
          <p>{t("Example student · Example library")}</p>
          <dl><div><dt>{t("Fee due")}</dt><dd>₹1,200</dd></div><div><dt>{t("Payment recorded")}</dt><dd>₹700</dd></div><div><dt>{t("Left to pay")}</dt><dd>₹500</dd></div></dl>
          <p className="public-proof-receipt-note"><Check size={17} aria-hidden="true" />{t("Receipt for the ₹700 recorded payment")}</p>
          <small>{t("Sample receipt summary. Recording a payment does not transfer money or verify a bank transaction.")}</small>
        </figure>
      </div>}
    </div>
  </section>;
}

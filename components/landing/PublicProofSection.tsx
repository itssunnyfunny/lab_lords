import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ReceiptText } from "lucide-react";
import { approvedPublicProof, type PublicProof } from "@/lib/publicProof";

export function PublicProofSection({ proof = approvedPublicProof }: { proof?: PublicProof }) {
  const hasProof = proof.metrics.length > 0 || proof.feedback.length > 0;

  return <section className="marketing-section marketing-customer-proof" aria-labelledby="public-proof-title">
    <div className="marketing-container">
      {hasProof ? <>
        <div className="marketing-section-heading">
          <p className="marketing-eyebrow">Everyday library work</p>
          <h2 id="public-proof-title" className="marketing-title">{proof.feedback.length ? "What library owners say" : "Libraries using Lab Lords"}</h2>
        </div>
        {proof.metrics.length > 0 && <dl className="public-proof-metrics">{proof.metrics.map(metric => <div key={metric.id}>
          <dt>{metric.label}</dt><dd><strong>{metric.value}</strong><p>{metric.definition}</p><small>As of {metric.asOf}</small></dd>
        </div>)}</dl>}
        {proof.feedback.length > 0 && <div className="public-proof-feedback">{proof.feedback.map(item => <figure key={item.id}>
          {item.logo && <Image {...item.logo} alt={item.logo.alt} />}
          <blockquote><p>{item.quote}</p></blockquote>
          <figcaption><strong>{item.attribution}</strong><span>{item.library}</span></figcaption>
        </figure>)}</div>}
      </> : <div className="marketing-proof-grid">
        <div>
          <p className="marketing-eyebrow">Payments &amp; receipts</p>
          <h2 id="public-proof-title" className="marketing-title">See how it works in your library</h2>
          <p className="marketing-lead">Record full or partial payments and check how much each student has left to pay.</p>
          <p className="marketing-lead">Download a receipt for a recorded payment and find it again in the student&apos;s collection history.</p>
          <Link href="/how-it-works" className="marketing-text-link">How it works <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <figure className="public-proof-receipt">
          <figcaption><span><ReceiptText size={20} aria-hidden="true" />A recorded payment</span><span className="public-proof-sample">Sample data</span></figcaption>
          <p>Example student · Example library</p>
          <dl><div><dt>Fee due</dt><dd>₹1,200</dd></div><div><dt>Payment recorded</dt><dd>₹700</dd></div><div><dt>Left to pay</dt><dd>₹500</dd></div></dl>
          <p className="public-proof-receipt-note"><Check size={17} aria-hidden="true" />Receipt for the ₹700 recorded payment</p>
          <small>Sample receipt summary. Recording a payment does not transfer money or verify a bank transaction.</small>
        </figure>
      </div>}
    </div>
  </section>;
}

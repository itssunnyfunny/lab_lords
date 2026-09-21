/** Approved public fields only. Keep consent and source records in review notes. */
export type PublicProof = {
  metrics: readonly { id: string; value: string; label: string; definition: string; asOf: string }[];
  feedback: readonly {
    id: string;
    quote: string;
    attribution: string;
    library: string;
    logo?: { src: string; alt: string; width: number; height: number };
  }[];
};

// No customer aggregates, quotes or logos have public-use approval recorded yet.
// See docs/redesign/public-proof-and-metadata.md before adding evidence here.
export const approvedPublicProof: PublicProof = { metrics: [], feedback: [] };

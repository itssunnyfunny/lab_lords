import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FeeCollectionView } from "@/lib/feeCollections";
import { BasicReceipt } from "@/components/basic/BasicFees";
import { receiptSummary } from "@/lib/feeReceiptPdf";
import { receiptCollectedAt, receiptPeriodDate } from "@/lib/feeReceiptDates";
const preferences=vi.hoisted(()=>({timezone:"UTC",documentLanguage:"en"}));
vi.mock("@/components/basic/BasicDialog",()=>({BasicDialog:({children,title}:{children:ReactNode;title:string})=><section aria-label={title}>{children}</section>}));
vi.mock("@/components/settings/LocalizedText",()=>({useTranslation:()=>Object.assign((key:string)=>key,{owned:(key:string)=>key,error:(key:string)=>key})}));
vi.mock("@/components/settings/UserPreferencesApplier",()=>({useUserPreferences:()=>({...preferences,formatNumber:(n:number)=>String(n),formatDate:(s:string)=>new Date(s).toLocaleDateString("en-IN",{timeZone:preferences.timezone})})}));
const collection:FeeCollectionView={id:"receipt",receiptNumber:"LL-100",amount:300,collectedAt:"2026-10-28T18:45:00.000Z",method:"CASH",reference:null,voidedAt:null,voidReason:null,
 snapshot:{version:1,branchName:"Library",organizationName:"Organization",address:null,contactPhone:null,studentName:"Student",studentId:"student",recordedBy:"Owner",recordedById:"owner",collectedAt:"2026-10-28T18:45:00.000Z",amount:300,method:"CASH",reference:"",note:"",remainingBalance:700,allocations:[{paymentId:"fee",type:"MONTHLY",periodStart:"2026-09-30T18:30:00.000Z",periodEnd:"2026-10-31T18:29:59.999Z",amount:300,remaining:700}]}};
describe("Basic receipt uses the recorded India calendar",()=>{
 it.each(["Asia/Kolkata","UTC","America/Los_Angeles"])("matches PDF content under %s account preferences",timezone=>{
  preferences.timezone=timezone;const screen=renderToStaticMarkup(<BasicReceipt branchId="branch" receipt={collection} onClose={()=>{}}/>);const pdf=receiptSummary(collection);
  for(const date of [receiptCollectedAt(collection.snapshot.collectedAt),receiptPeriodDate(collection.snapshot.allocations[0].periodStart),receiptPeriodDate(collection.snapshot.allocations[0].periodEnd)]){expect(screen).toContain(date);expect(pdf).toContain(date);}
  expect(screen).toContain("29/10/2026");expect(screen).not.toContain("28/10/2026");expect(screen).toContain("700");
 });
 it("keeps void evidence and document-language content without changing financial snapshots",()=>{
  const receipt={...collection,voidedAt:"2026-10-29T18:45:00.000Z",voidReason:"Wrong collection"};const before=JSON.stringify(receipt);
  const screen=renderToStaticMarkup(<BasicReceipt branchId="branch" receipt={receipt} onClose={()=>{}}/>);expect(screen).toContain("Voided receipt");expect(screen).toContain("30/10/2026");expect(screen).toContain("Wrong collection");
  for(const language of ["en","hi","hinglish"] as const){const pdf=receiptSummary(receipt,language);expect(pdf).toContain(receiptCollectedAt(collection.collectedAt));expect(pdf).toContain("Wrong collection");expect(pdf).toContain("300");}
  expect(JSON.stringify(receipt)).toBe(before);
 });
});

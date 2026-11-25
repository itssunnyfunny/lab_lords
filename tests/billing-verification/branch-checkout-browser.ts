import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { BillingService } from "../../services/billing.service";
import { withOwnerBillingScope } from "../../services/billingAgreementScope.service";
import { prisma } from "../../lib/prisma";

type Plan = "BASIC" | "STANDARD" | "PRO";
const origin = "http://127.0.0.1:4193";
function send(response: ServerResponse, status: number, body: string, html = false) {
  response.writeHead(status, { "Content-Type": html ? "text/html; charset=utf-8" : "application/json",
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff" });
  response.end(body);
}
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 2048) throw new Error("Invalid input");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

/** Called only after branch-preauthorization verifies exact isolated Test fixtures and restricts provider traffic to GET. */
export async function serveOriginalCheckouts(input: {
  ownerId: string; organizationId: string; plans: readonly Plan[]; branchFor: (plan: string) => string;
}) {
  const token = randomBytes(32).toString("hex");
  const originals = new Map<Plan, { changeId: string; subscriptionId: string; branchId: string }>();
  for (const plan of input.plans) {
    const branchId = input.branchFor(plan);
    const where = { organizationId: input.organizationId, agreementBranchId: branchId };
    const action = await prisma.billingProviderAction.findFirstOrThrow({ where: { ...where, providerMode: "TEST", purpose: "CREATE", status: "CONFIRMED" } });
    const change = await prisma.organizationBillingChange.findFirstOrThrow({ where: { ...where, id: action.changeId ?? "",
      type: "SUBSCRIPTION_AUTHORIZATION", authorizedProviderMode: "TEST", authorizedQuantity: 1, authorizedPlan: plan } });
    if (!change.authorizedRazorpaySubscriptionId) throw new Error("Original Test checkout missing");
    originals.set(plan, { branchId, changeId: change.id, subscriptionId: change.authorizedRazorpaySubscriptionId });
  }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Branch checkout verification</title><main><h1>Razorpay Test checkout</h1>
<p>Each button opens the original Test subscription for one synthetic branch. Use Razorpay Test details for manual authorization.</p>
<button data-plan="BASIC">Basic · ₹99</button> <button data-plan="STANDARD">Standard · ₹299</button> <button data-plan="PRO">Pro · ₹499</button><p role="status"></p></main>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
const message = document.querySelector('[role=status]');
async function call(plan, path, data) {
  const result = await fetch('/'+plan+'/'+path, {method:'POST',headers:{'Content-Type':'application/json','X-Billing-Test-Token':${JSON.stringify(token)}}, body:JSON.stringify(data)});
  if (!result.ok) throw new Error('This Test checkout has expired or its current state needs review.');
  return result.json();
}
for (const button of document.querySelectorAll('button')) button.onclick = async () => {
  const plan = button.dataset.plan;
  try {
    const value = await call(plan,'open',{});
    if (!window.Razorpay) throw new Error('Razorpay Checkout could not load.');
    const checkout = new Razorpay({key:value.keyId, subscription_id:value.subscriptionId, name:value.name, description:value.description, config:value.config,
      remember_customer:false, handler:async result => {
        try { const verified = await call(plan,'verify',result); message.textContent = verified.verified ? 'Server verified the Test response.' : 'Provider confirmation pending.'; }
        catch { message.textContent='Callback needs server-side review.'; }
      }, modal:{ondismiss:()=>{message.textContent='Test checkout closed.';}}});
    checkout.open();
  } catch(error) { message.textContent=error.message; }
};
</script></html>`;
  const server = createServer(async (req, res) => {
    if (req.headers.host !== "127.0.0.1:4193") return send(res, 403, "{}");
    if (req.method === "GET" && req.url === "/") return send(res, 200, html, true);
    const session = req.headers["x-billing-test-token"];
    if (req.method !== "POST" || req.headers.origin !== origin || typeof session !== "string" || !/^[0-9a-f]{64}$/.test(session)
      || !timingSafeEqual(Buffer.from(session), Buffer.from(token)) || req.headers["content-type"] !== "application/json") return send(res, 403, "{}");
    try {
      const match = req.url?.match(/^\/(BASIC|STANDARD|PRO)\/(open|verify)$/);
      const original = match ? originals.get(match[1] as Plan) : null;
      if (!match || !original) return send(res, 404, "{}");
      const data = await body(req);
      const { changeId, subscriptionId, branchId } = original;
      const run = <T>(fn: () => Promise<T>) => withOwnerBillingScope(input.ownerId, input.organizationId, branchId, fn);
      if (match[2] === "open") {
        const { checkout } = await run(() => BillingService.getBillingOperation(input.ownerId, input.organizationId, changeId));
        if (!checkout?.testMode || checkout.subscriptionId !== subscriptionId || checkout.changeId !== changeId
          || checkout.notes.branch_agreement_id !== branchId || checkout.summary.quantity !== 1 || checkout.summary.plan !== match[1]) return send(res, 409, "{}");
        return send(res, 200, JSON.stringify({ keyId: checkout.keyId, subscriptionId: checkout.subscriptionId,
          name: checkout.name, description: checkout.description, config: checkout.config }));
      }
      if (data.razorpay_subscription_id !== subscriptionId) return send(res, 403, "{}");
      const result = await run(() => BillingService.verifySubscriptionSuccess(input.ownerId, input.organizationId, {
        changeId, razorpay_subscription_id: subscriptionId, razorpay_payment_id: data.razorpay_payment_id, razorpay_signature: data.razorpay_signature,
      }));
      return send(res, 200, JSON.stringify({ verified: result.verified }));
    } catch { return send(res, 409, "{}"); }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("close", resolve);
    server.listen(4193, "127.0.0.1", () => process.stdout.write("Verified manual Test checkout is listening on loopback port 4193.\n"));
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close());
  });
}

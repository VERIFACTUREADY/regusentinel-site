import { NextRequest, NextResponse } from "next/server";
import { handleWebhookEvent } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

    await handleWebhookEvent(body, sig);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

import { getStore } from "@netlify/blobs";
import { webhookSaspay } from "../lib/paiement.mjs";

export default async (req) => webhookSaspay(req, getStore({ name: "paiements", consistency: "strong" }));

export const config = { path: "/api/saspay/webhook" };

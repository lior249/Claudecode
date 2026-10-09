import { getStore } from "@netlify/blobs";
import { statutPaiement } from "../lib/paiement.mjs";

export default async (req) => statutPaiement(req, getStore({ name: "paiements", consistency: "strong" }));

export const config = { path: "/api/status" };

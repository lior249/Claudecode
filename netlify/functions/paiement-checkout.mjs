import { getStore } from "@netlify/blobs";
import { creerPaiement } from "../lib/paiement.mjs";

export default async (req, context) => creerPaiement(req, getStore({ name: "paiements", consistency: "strong" }), { ip: context.ip });

export const config = { path: "/api/checkout" };

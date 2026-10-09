import { getStore } from "@netlify/blobs";
import { reserver } from "../lib/reservations.mjs";

export default async (req) => reserver(req, getStore({ name: "reservations", consistency: "strong" }));

export const config = { path: "/api/reserver" };

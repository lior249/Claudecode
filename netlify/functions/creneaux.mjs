import { getStore } from "@netlify/blobs";
import { listerCreneaux } from "../lib/reservations.mjs";

export default async () => listerCreneaux(getStore({ name: "reservations", consistency: "strong" }));

export const config = { path: "/api/creneaux" };

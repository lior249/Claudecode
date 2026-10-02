// Au démarrage du serveur : vérifie la configuration tout de suite (un secret manquant arrête le site avec un message clair).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/server/env");
    getEnv();
  }
}

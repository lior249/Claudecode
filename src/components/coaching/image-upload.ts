"use client";

// Envoi d'une image privée (ticket, preuve). Renvoie la clé de stockage et l'adresse d'affichage.
export function uploadImage(file: File): Promise<{ key: string; url: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) return reject(new Error("Image trop lourde : 10 Mo maximum."));
    const req = new XMLHttpRequest();
    req.open("POST", "/api/uploads/image");
    req.onload = () => {
      let body: { key?: string; url?: string; error?: string } = {};
      try {
        body = JSON.parse(req.responseText);
      } catch {}
      if (req.status === 200 && body.key && body.url) resolve({ key: body.key, url: body.url });
      else reject(new Error(body.error ?? "Envoi impossible. Réessaie."));
    };
    req.onerror = () => reject(new Error("Connexion interrompue. Réessaie."));
    req.send(file);
  });
}

// Creato — carrousel des résultats, apparitions au défilement, réservation d'appel.
(function () {
  var INSTAGRAM = "https://www.instagram.com/flohustle24/";
  var NB_RESULTATS = 20;

  // ----- Carrousel des résultats (fenêtres façon ordinateur, comme l'ancien site) -----
  var piste = document.querySelector("[data-piste]");
  for (var i = 1; i <= NB_RESULTATS; i++) {
    var n = (i < 10 ? "0" : "") + i;
    var fig = document.createElement("figure");
    fig.className = "fenetre";
    fig.innerHTML =
      '<div class="fenetre-barre"><span class="points"><i></i><i></i><i></i></span><span class="fenetre-titre">résultat-client-' + n + '.png</span><span></span></div>' +
      '<div class="fenetre-image"><img src="img/resultats/' + n + '.jpg" alt="Résultat client Creato — capture ' + i + '" loading="lazy" decoding="async"></div>';
    piste.appendChild(fig);
  }

  // Glisser à la souris sur ordinateur (le doigt fait déjà défiler sur téléphone).
  var rail = document.querySelector(".defilant");
  if (rail && window.matchMedia("(pointer: fine)").matches) {
    var actif = false, departX = 0, departScroll = 0;
    rail.addEventListener("pointerdown", function (e) {
      actif = true; departX = e.clientX; departScroll = rail.scrollLeft;
      rail.classList.add("glisse"); rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener("pointermove", function (e) {
      if (actif) rail.scrollLeft = departScroll - (e.clientX - departX);
    });
    var stop = function () { actif = false; rail.classList.remove("glisse"); };
    rail.addEventListener("pointerup", stop);
    rail.addEventListener("pointercancel", stop);
  }

  // ----- Apparition des blocs au défilement -----
  var blocs = document.querySelectorAll(".apparait");
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("visible"); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    blocs.forEach(function (b) { obs.observe(b); });
  } else {
    blocs.forEach(function (b) { b.classList.add("visible"); });
  }

  // ----- Réservation d'un appel -----
  var agenda = document.querySelector("[data-agenda]");
  if (!agenda) return;
  var etat = agenda.querySelector("[data-etat]");
  var choix = agenda.querySelector("[data-choix]");
  var joursEl = agenda.querySelector("[data-jours]");
  var heuresEl = agenda.querySelector("[data-heures]");
  var fuseauEl = agenda.querySelector("[data-fuseau]");
  var form = agenda.querySelector("[data-formulaire]");
  var recap = agenda.querySelector("[data-recap]");
  var erreur = agenda.querySelector("[data-erreur]");
  var alerte = agenda.querySelector("[data-alerte]");
  var confirmation = agenda.querySelector("[data-confirmation]");
  var confirmationTexte = agenda.querySelector("[data-confirmation-texte]");

  var parJour = {};      // « 2026-10-12 » (date du visiteur) → liste des créneaux ISO
  var jourChoisi = null;
  var creneauChoisi = null;

  var fmt = function (opts) { return new Intl.DateTimeFormat("fr-FR", opts); };
  var cleJour = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var heure = function (iso) { return fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); };
  var libelle = function (iso) {
    var h = heure(iso).split(":");
    return fmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)) + " à " + Number(h[0]) + " h " + h[1];
  };
  var lienInstagram = '<a href="' + INSTAGRAM + '" target="_blank" rel="noopener noreferrer">Instagram</a>';

  function afficherEtat(html) {
    etat.innerHTML = html;
    etat.hidden = false;
    choix.hidden = true;
    form.hidden = true;
  }

  // `alerte` : message affiché sous les heures après le rechargement (créneau pris entre-temps).
  function charger(alerteTexte) {
    return fetch("/api/creneaux", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (j) {
        parJour = {};
        (j.creneaux || []).forEach(function (iso) {
          var k = cleJour(new Date(iso));
          (parJour[k] = parJour[k] || []).push(iso);
        });
        var jours = Object.keys(parJour).sort();
        if (!jours.length) return afficherEtat("Aucun créneau libre pour le moment. Écris-moi sur " + lienInstagram + ".");
        etat.hidden = true;
        choix.hidden = false;
        if (jours.indexOf(jourChoisi) < 0) jourChoisi = jours[0];
        if (creneauChoisi && (parJour[jourChoisi] || []).indexOf(creneauChoisi) < 0) {
          creneauChoisi = null;
          form.hidden = true;
        }
        dessinerJours(jours);
        dessinerHeures();
        alerte.textContent = alerteTexte || "";
      })
      .catch(function () {
        afficherEtat("Les créneaux ne peuvent pas être chargés pour le moment. Réessaie plus tard ou écris-moi sur " + lienInstagram + ".");
      });
  }

  function dessinerJours(jours) {
    joursEl.innerHTML = "";
    jours.forEach(function (k) {
      var d = new Date(parJour[k][0]);
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", k === jourChoisi ? "true" : "false");
      b.innerHTML = "<b>" + fmt({ weekday: "short" }).format(d) + "</b><span>" + fmt({ day: "numeric", month: "short" }).format(d) + "</span>";
      b.addEventListener("click", function () {
        jourChoisi = k;
        creneauChoisi = null;
        alerte.textContent = "";
        form.hidden = true;
        dessinerJours(jours);
        dessinerHeures();
      });
      joursEl.appendChild(b);
    });
  }

  function dessinerHeures() {
    heuresEl.innerHTML = "";
    (parJour[jourChoisi] || []).forEach(function (iso) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = heure(iso);
      b.setAttribute("aria-pressed", iso === creneauChoisi ? "true" : "false");
      b.addEventListener("click", function () {
        creneauChoisi = iso;
        alerte.textContent = "";
        dessinerHeures();
        recap.textContent = "Appel le " + libelle(iso) + ".";
        erreur.textContent = "";
        form.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      heuresEl.appendChild(b);
    });
    fuseauEl.textContent = "Heures affichées à l’heure de ton téléphone.";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    erreur.textContent = "";
    var nom = form.elements.nom.value.trim();
    var instagram = form.elements.instagram.value.trim();
    if (!creneauChoisi) return (erreur.textContent = "Choisis d’abord un jour et une heure.");
    if (nom.length < 2) return (erreur.textContent = "Indique ton nom.");
    if (!instagram.replace(/^@+/, "")) return (erreur.textContent = "Indique ton pseudo Instagram.");
    var bouton = form.querySelector("button[type=submit]");
    bouton.disabled = true;
    bouton.textContent = "Envoi…";
    fetch("/api/reserver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nom, instagram: instagram, creneau: creneauChoisi, site: form.elements.site.value }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j.ok) {
          choix.hidden = true;
          form.hidden = true;
          confirmation.hidden = false;
          confirmationTexte.textContent = "Le " + libelle(creneauChoisi) + " (heure de ton téléphone).";
          confirmation.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        var msg = res.j.erreur || "La réservation n’a pas pu être envoyée. Réessaie dans un instant.";
        // Créneau pris entre-temps : on recharge la liste.
        if (res.status === 409 || /plus disponible/.test(msg)) return charger(msg);
        erreur.textContent = msg;
      })
      .catch(function () { erreur.textContent = "Connexion impossible. Vérifie ton réseau et réessaie."; })
      .then(function () {
        bouton.disabled = false;
        bouton.textContent = "Je réserve ce créneau";
      });
  });

  charger();
})();

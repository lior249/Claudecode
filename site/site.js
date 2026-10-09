// Creato — carrousel des résultats, apparitions au défilement, paiement (carte ou mobile money).
(function () {
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

  // ----- Rejoindre : carte → Maketou, mobile money → SasPay (le serveur crée le paiement) -----
  var zone = document.querySelector("[data-paiement]");
  if (!zone) return;
  var moyens = zone.querySelector("[data-moyens]");
  var form = zone.querySelector("[data-formulaire]");
  var moyenChoisi = zone.querySelector("[data-moyen-choisi]");
  var erreur = zone.querySelector("[data-erreur]");
  var envoi = form.querySelector("button[type=submit]");
  var moyen = "";

  function afficherFormulaire(oui) {
    moyens.hidden = oui;
    form.hidden = !oui;
    erreur.textContent = "";
    if (oui) form.elements.firstName.focus();
  }
  zone.querySelectorAll("[data-moyen]").forEach(function (b) {
    b.addEventListener("click", function () {
      moyen = b.getAttribute("data-moyen");
      moyenChoisi.textContent = moyen === "carte" ? "Paiement par carte bancaire" : "Paiement par mobile money";
      afficherFormulaire(true);
    });
  });
  zone.querySelector("[data-retour]").addEventListener("click", function () { afficherFormulaire(false); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    erreur.textContent = "";
    var firstName = form.elements.firstName.value.trim();
    var lastName = form.elements.lastName.value.trim();
    var email = form.elements.email.value.trim();
    if (!firstName) return (erreur.textContent = "Indique ton prénom.");
    if (!lastName) return (erreur.textContent = "Indique ton nom.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return (erreur.textContent = "Adresse e-mail invalide.");
    envoi.disabled = true;
    envoi.textContent = "Redirection vers le paiement…";
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moyen: moyen, firstName: firstName, lastName: lastName, email: email }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.url) throw new Error(res.j.error || "Le paiement est momentanément indisponible.");
        window.location.href = res.j.url;
      })
      .catch(function (err) {
        erreur.textContent = err.message || "Le paiement est momentanément indisponible.";
        envoi.disabled = false;
        envoi.textContent = "Continuer vers le paiement";
      });
  });
  // Retour arrière depuis la page de paiement : bouton de nouveau utilisable.
  window.addEventListener("pageshow", function () {
    envoi.disabled = false;
    envoi.textContent = "Continuer vers le paiement";
  });
})();

/* =========================================================
   Caflo — comportements du site
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     Configuration — à renseigner avant la mise en ligne
     --------------------------------------------------------- */
  var CONFIG = {
    // URL du Worker Cloudflare (dossier serveur-licence/)
    apiLicence: 'https://caflo-licence.exemple.workers.dev',
    // Dépôt GitHub qui héberge les installeurs
    depotReleases: 'hassaineNazim/caflo-releases',
    // Nom de l'asset, SANS numéro de version : c'est ce qui fait
    // fonctionner l'URL /releases/latest/download/
    fichierInstalleur: 'Caflo-Setup.exe'
  };

  CONFIG.urlTelechargement = 'https://github.com/' + CONFIG.depotReleases +
    '/releases/latest/download/' + CONFIG.fichierInstalleur;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     Préchargeur — affiché une fois par session
     --------------------------------------------------------- */
  (function preloader() {
    var el = document.getElementById('preloader');
    if (!el) return;

    var seen = false;
    try { seen = sessionStorage.getItem('caflo:intro') === '1'; } catch (e) { /* mode privé */ }

    if (seen || reduceMotion) {
      el.remove();
      return;
    }
    try { sessionStorage.setItem('caflo:intro', '1'); } catch (e) { /* ignore */ }

    // Retire l'élément du DOM une fois l'animation de sortie terminée.
    setTimeout(function () { el.classList.add('is-done'); }, 3200);
  })();

  /* ---------------------------------------------------------
     Ombre du header au scroll
     --------------------------------------------------------- */
  (function stickyHeader() {
    var header = document.querySelector('.header');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  })();

  /* ---------------------------------------------------------
     Menu mobile
     --------------------------------------------------------- */
  (function mobileMenu() {
    var burger = document.getElementById('burger');
    var menu = document.getElementById('mobile-menu');
    if (!burger || !menu) return;

    function setOpen(open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.hidden = !open;
    }

    burger.addEventListener('click', function () {
      setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        burger.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (burger.getAttribute('aria-expanded') !== 'true') return;
      if (menu.contains(e.target) || burger.contains(e.target)) return;
      setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1220) setOpen(false);
    });
  })();

  /* ---------------------------------------------------------
     Révélation des blocs au scroll
     --------------------------------------------------------- */
  (function reveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (el) { io.observe(el); });

    // Filet de sécurité : rien ne doit rester invisible.
    setTimeout(function () {
      items.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
      });
    }, 1200);
  })();

  /* ---------------------------------------------------------
     Parcours d'une commande — onglets + lecture automatique
     --------------------------------------------------------- */
  (function journey() {
    var container = document.getElementById('journey-steps');
    var shot = document.getElementById('journey-shot');
    var caption = document.getElementById('journey-caption');
    var panel = document.getElementById('journey-panel');
    if (!container || !shot || !caption) return;

    var steps = Array.prototype.slice.call(container.querySelectorAll('.step'));
    var current = 0;
    var timer = null;
    var userLocked = false;
    var visible = false;

    // Précharge les captures pour éviter le clignotement au changement d'étape.
    steps.forEach(function (s) {
      var img = new Image();
      img.src = s.dataset.shot;
    });

    function select(index, fromUser) {
      if (index === current && !fromUser) return;
      current = index;

      steps.forEach(function (s, i) {
        var on = i === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-selected', String(on));
        s.tabIndex = on ? 0 : -1;
      });

      var step = steps[index];
      if (panel) panel.setAttribute('aria-labelledby', step.id);

      if (reduceMotion) {
        shot.src = step.dataset.shot;
        shot.alt = step.dataset.alt;
      } else {
        shot.classList.add('is-swapping');
        setTimeout(function () {
          shot.src = step.dataset.shot;
          shot.alt = step.dataset.alt;
          shot.classList.remove('is-swapping');
        }, 180);
      }
      caption.textContent = step.dataset.caption;
    }

    function start() {
      if (userLocked || reduceMotion || timer) return;
      timer = setInterval(function () { select((current + 1) % steps.length); }, 4200);
    }
    function stop() {
      clearInterval(timer);
      timer = null;
    }

    steps.forEach(function (s, i) {
      s.addEventListener('click', function () {
        userLocked = true;
        stop();
        select(i, true);
      });
      s.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % steps.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + steps.length) % steps.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = steps.length - 1;
        if (next === null) return;
        e.preventDefault();
        userLocked = true;
        stop();
        select(next, true);
        steps[next].focus();
      });
    });

    // La lecture automatique ne tourne que lorsque la section est visible.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0.25 }).observe(container);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (visible) start();
    });
  })();

  /* ---------------------------------------------------------
     Lien de navigation actif selon la section visible
     --------------------------------------------------------- */
  (function scrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var targets = [];
    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (!el) return;
      map[id] = link;
      targets.push(el);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('is-current'); });
        var link = map[entry.target.id];
        if (link) link.classList.add('is-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    targets.forEach(function (t) { io.observe(t); });
  })();

  /* ---------------------------------------------------------
     Modale d'essai — formulaire puis clé délivrée
     --------------------------------------------------------- */
  (function essai() {
    var modal = document.getElementById('modal-essai');
    var form = document.getElementById('form-essai');
    var succes = document.getElementById('essai-succes');
    if (!modal || !form || !succes) return;

    var boite = modal.querySelector('.modal__boite');
    var erreur = document.getElementById('form-erreur');
    var envoyer = document.getElementById('form-envoyer');
    var champFormule = document.getElementById('f-formule');
    var dernierFocus = null;

    function ouvrir(formule) {
      dernierFocus = document.activeElement;
      if (formule && champFormule) champFormule.value = formule;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      var premier = succes.hidden ? document.getElementById('f-nom') : document.getElementById('copier-cle');
      if (premier) premier.focus();
    }

    function fermer() {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (dernierFocus) dernierFocus.focus();
    }

    document.addEventListener('click', function (e) {
      var declencheur = e.target.closest('[data-ouvrir-essai]');
      if (declencheur) {
        e.preventDefault();
        ouvrir(declencheur.dataset.formule);
        return;
      }
      if (e.target.closest('[data-fermer-essai]')) fermer();
    });

    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') { fermer(); return; }
      if (e.key !== 'Tab') return;

      // Piège à focus : on reste dans la modale tant qu'elle est ouverte.
      var focusables = boite.querySelectorAll(
        'a[href], button:not([disabled]), input:not([tabindex="-1"]), select, textarea'
      );
      var visibles = Array.prototype.filter.call(focusables, function (el) {
        return el.offsetParent !== null;
      });
      if (!visibles.length) return;

      var premier = visibles[0];
      var dernier = visibles[visibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    });

    function afficherErreur(texte) {
      erreur.textContent = texte;
      erreur.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      erreur.hidden = true;

      var donnees = {};
      new FormData(form).forEach(function (valeur, cle) { donnees[cle] = String(valeur).trim(); });

      // Validation côté client — le serveur revalide de toute façon.
      var manquants = ['nom', 'etablissement', 'telephone'].filter(function (c) { return !donnees[c]; });
      form.querySelectorAll('input').forEach(function (i) { i.removeAttribute('aria-invalid'); });
      if (manquants.length) {
        manquants.forEach(function (c) {
          var champ = form.querySelector('[name="' + c + '"]');
          if (champ) champ.setAttribute('aria-invalid', 'true');
        });
        form.querySelector('[name="' + manquants[0] + '"]').focus();
        afficherErreur('Merci de renseigner votre nom, votre établissement et votre téléphone.');
        return;
      }

      envoyer.disabled = true;
      envoyer.textContent = 'Envoi…';

      fetch(CONFIG.apiLicence + '/api/essai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(donnees)
      })
        .then(function (r) { return r.json().then(function (c) { return { ok: r.ok, corps: c }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.corps.erreur || 'Demande refusée.');

          document.getElementById('succes-cle').textContent = res.corps.cle;
          document.getElementById('succes-lien').href = res.corps.telechargement || CONFIG.urlTelechargement;
          if (res.corps.deja_demande) {
            document.getElementById('succes-intro').textContent =
              'Une clé avait déjà été émise pour ce numéro — c’est la même, elle reste valable.';
          }
          form.hidden = true;
          succes.hidden = false;
          boite.scrollTop = 0;
          document.getElementById('copier-cle').focus();
        })
        .catch(function (err) {
          afficherErreur(
            err.message === 'Failed to fetch'
              ? 'Connexion au serveur impossible. Réessayez, ou appelez le +213 673 35 61 65.'
              : err.message
          );
        })
        .then(function () {
          envoyer.disabled = false;
          envoyer.textContent = 'Obtenir ma clé et télécharger';
        });
    });

    var copier = document.getElementById('copier-cle');
    if (copier) {
      copier.addEventListener('click', function () {
        var cle = document.getElementById('succes-cle').textContent;
        var fini = function () {
          copier.textContent = 'Copiée';
          setTimeout(function () { copier.textContent = 'Copier'; }, 2000);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(cle).then(fini, function () {});
        else fini();
      });
    }
  })();

  /* ---------------------------------------------------------
     Version et taille de l'installeur, lues sur GitHub
     --------------------------------------------------------- */
  (function infosRelease() {
    var champVersion = document.getElementById('dl-version');
    var champTaille = document.getElementById('dl-taille');
    if (!champVersion || !champTaille) return;

    fetch('https://api.github.com/repos/' + CONFIG.depotReleases + '/releases/latest')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (release) {
        champVersion.textContent = release.tag_name || '—';
        var asset = (release.assets || []).filter(function (a) {
          return a.name === CONFIG.fichierInstalleur;
        })[0];
        if (asset) champTaille.textContent = (asset.size / 1048576).toFixed(0) + ' Mo';
      })
      .catch(function () {
        // Pas encore de release publiée, ou quota de l'API atteint.
        champVersion.textContent = 'bientôt disponible';
        champTaille.textContent = '—';
      });
  })();

  /* ---------------------------------------------------------
     Année du copyright
     --------------------------------------------------------- */
  (function year() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  })();

})();

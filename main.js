/* =========================================================
   Caflo — comportements du site
   ========================================================= */
(function () {
  'use strict';

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
      if (window.innerWidth >= 1120) setOpen(false);
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
     Année du copyright
     --------------------------------------------------------- */
  (function year() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  })();

})();

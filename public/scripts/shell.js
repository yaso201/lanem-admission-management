/* ============================================================
   emela — Front management : châssis partagé (C4-FRONT, DEC-264)
   - AUTH RÉELLE : session native Frappe. Au chargement de toute
     page applicative, whoami() vérifie la session ; absente ou
     expirée → redirection /connexion. (L'ancienne gate
     localStorage de la maquette est SUPPRIMÉE.)
   - Le rôle vient du SERVEUR (whoami.roles) — l'UX masque ce que
     le rôle ne peut pas faire (data-roles) ; la sécurité reste
     portée par les endpoints role-gardés.
   ============================================================ */
(function () {
  const ROLE_HOME = {
    admin: '/espace-administratif',
    resp: '/cockpit-responsable',
    dir: '/tableau-direction',
    sm: '/personnel',
  };
  const ROLE_LABEL = {
    admin: "Agent d'admission",
    resp: 'Responsable admission',
    dir: 'Direction',
    sm: 'Super-admin (SM)',
  };
  // SM = super-admin de domaine : superset d'AFFICHAGE (voit toutes les sections).
  const VISIBLE_CODES = {
    admin: ['admin'], resp: ['resp'], dir: ['dir'],
    sm: ['admin', 'resp', 'dir', 'sm'],
  };

  function initials(name) {
    return (name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }

  function applyRole(role, me) {
    document.body.setAttribute('data-role', role);

    // Carte utilisateur : identité RÉELLE de session (plus de profils fictifs)
    const nm = document.querySelector('.app-user .nm');
    const rl = document.querySelector('.app-user .rl');
    const av = document.querySelector('.app-user .av');
    if (nm) nm.textContent = me.full_name || me.user;
    if (rl) rl.textContent = ROLE_LABEL[role] || role;
    if (av) av.textContent = initials(me.full_name || me.user);

    // Nav + contenu : gating d'AFFICHAGE par rôle (UX — le serveur refuse de toute façon).
    // SM voit le superset (admin+resp+dir+sm) ; les autres ne voient que leur code.
    const visible = VISIBLE_CODES[role] || [role];
    document.querySelectorAll('[data-roles]').forEach(el => {
      el.hidden = !el.getAttribute('data-roles').split(/\s+/).some(r => visible.includes(r));
    });
    // STAFF-HEADER-NAV : le logo (.brand[data-home]) mène à l'accueil du rôle (superset SM inclus).
    document.querySelectorAll('a[data-home]').forEach(a => a.setAttribute('href', ROLE_HOME[role]));
    // NB : onEmelaRole (chargement des DONNÉES de page) est appelé par boot() APRÈS reveal(),
    // pour qu'une erreur de données ne puisse jamais laisser la page masquée (STAFF-GATE).
  }

  /* STAFF-GATE — révélation : retire le cloak posé par Layout (le body redevient visible). */
  function reveal() {
    var c = document.getElementById('auth-cloak');
    if (c) c.remove();
  }

  /* STAFF-GATE — panne réseau (DEC-F) : NE PAS déconnecter, NE PAS révéler la structure.
     Carte bloquante affichée PAR-DESSUS le cloak : `visibility:visible` sur l'overlay seul
     ré-affiche la carte alors que le body reste masqué (visibility hérite, mais un enfant peut
     forcer sa propre visibilité) → zéro fuite de structure. Réessai = rechargement. */
  function showNetworkRetry() {
    if (document.getElementById('auth-neterr')) return;
    var ov = document.createElement('div');
    ov.id = 'auth-neterr';
    ov.setAttribute('role', 'alert');
    ov.style.cssText = 'visibility:visible;position:fixed;inset:0;z-index:2147483647;display:flex;'
      + 'align-items:center;justify-content:center;padding:24px;background:var(--surface-canvas,#f6f5fb)';
    var card = document.createElement('div');
    card.style.cssText = 'max-width:420px;text-align:center;background:var(--surface-paper,#fff);'
      + 'border-radius:14px;padding:28px 26px;box-shadow:0 20px 60px rgba(0,0,0,.16)';
    var h = document.createElement('h1');
    h.style.cssText = 'font-family:var(--font-display);font-size:19px;font-weight:700;margin:0 0 8px;color:var(--text-primary)';
    h.textContent = 'Connexion au serveur impossible';
    var p = document.createElement('p');
    p.style.cssText = 'font-size:14px;color:var(--text-secondary);margin:0 0 20px;line-height:1.5';
    p.textContent = "Vous n'êtes pas déconnecté. Vérifiez votre connexion, puis réessayez.";
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'em-btn em-btn--primary';   // design system (feedback : réutiliser le DS)
    btn.textContent = 'Réessayer';
    btn.addEventListener('click', function () { window.location.reload(); });
    card.appendChild(h); card.appendChild(p); card.appendChild(btn);
    ov.appendChild(card);
    document.body.appendChild(ov);
  }

  async function boot() {
    let me = null;
    try {
      me = await window.EmelaAPI.whoami();
    } catch (e) {
      // STAFF-GATE — verdict de session, cloak toujours posé :
      //  · panne RÉSEAU (DEC-F) → on NE déconnecte PAS : carte « Réessayer », structure masquée.
      //  · tout autre échec (401/403/…) → pas de session staff valide → /connexion. Le cloak
      //    reste posé pendant la navigation → la structure ne s'affiche JAMAIS (DEC-B, point 1).
      if (e && (e.code === 'NETWORK' || e.httpStatus === 0)) { showNetworkRetry(); return; }
      window.EmelaAPI.gotoLogin({ next: location.pathname + location.search });
      return;
    }
    const role = window.EmelaAPI.uxRole(me.roles);
    window.EmelaShell.role = role;
    window.EmelaShell.me = me;
    applyRole(role, me);

    // A-04 : cible du lien d'évitement (id + focusable) sur le contenu principal
    const main = document.querySelector('main');
    if (main) { if (!main.id) main.id = 'main-content'; main.setAttribute('tabindex', '-1'); }

    // Déconnexion : la carte utilisateur reste cliquable…
    const userCard = document.querySelector('.app-user');
    if (userCard) {
      userCard.style.cursor = 'pointer';
      userCard.title = 'Se déconnecter';
      userCard.addEventListener('click', () => window.EmelaAPI.logout());
      // …+ un BOUTON VISIBLE « Déconnexion » (la carte seule n'était pas découvrable).
      if (!document.querySelector('.app-logout')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        // F-05 : variante du design system au lieu de styles inline
        btn.className = 'app-logout em-btn em-btn--secondary em-btn--sm';
        btn.textContent = 'Déconnexion';
        btn.title = 'Se déconnecter';
        btn.style.marginLeft = 'var(--space-4, 14px)';
        btn.style.whiteSpace = 'nowrap';
        btn.addEventListener('click', (e) => { e.stopPropagation(); window.EmelaAPI.logout(); });
        userCard.parentNode.insertBefore(btn, userCard.nextSibling);
      }
    }

    // STAFF-GATE — la page est dans son état FINAL (rôle appliqué, nav filtrée) → on révèle.
    reveal();
    // Le chargement des DONNÉES de page (onEmelaRole) s'exécute APRÈS reveal : une erreur y est
    // remontée par OBS-1 mais ne peut jamais re-masquer la page (déjà révélée).
    if (typeof window.onEmelaRole === 'function') window.onEmelaRole(role, me);
  }

  window.EmelaShell = { ROLE_HOME, ROLE_LABEL, role: null, me: null };
  document.addEventListener('DOMContentLoaded', boot);
})();

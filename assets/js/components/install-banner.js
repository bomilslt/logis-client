/**
 * PWA Install Banner — Express Cargo client
 * ==========================================
 * Affiche une bannière proposant l'installation de l'app si :
 *   - Le navigateur supporte l'installation PWA (Android/Desktop Chrome/Edge)
 *   - OU l'utilisateur est sur iOS Safari et l'app n'est pas déjà installée
 *   - ET l'utilisateur ne l'a pas masquée récemment (cooldown 7 jours)
 *
 * API publique (globale) :
 *   InstallBanner.init()       // À appeler au démarrage de l'app
 *   InstallBanner.show()       // Force l'affichage (ignore le cooldown)
 *   InstallBanner.isInstalled  // boolean
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'ec_install_banner_dismissed';
    const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
    const LOGO_SRC = 'assets/logo/logo_expressCargo.png';

    let deferredPrompt = null;
    let bannerEl = null;

    // ── Helpers ────────────────────────────────────────────────────────────
    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    }

    function isDismissedRecently() {
        const ts = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
        if (!ts) return false;
        return (Date.now() - ts) < COOLDOWN_MS;
    }

    function rememberDismiss() {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    // ── DOM construction ───────────────────────────────────────────────────
    function buildBanner(opts) {
        const el = document.createElement('div');
        el.className = 'install-banner' + (opts.ios ? ' install-banner-ios' : '');
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', "Installer l'application Express Cargo");

        el.innerHTML = `
            <button class="install-banner-close" aria-label="Fermer">&times;</button>
            <img src="${LOGO_SRC}" alt="Express Cargo" class="install-banner-icon">
            <div class="install-banner-text">
                <strong class="install-banner-title">Installer Express Cargo</strong>
                <span class="install-banner-subtitle">${opts.subtitle}</span>
            </div>
            <div class="install-banner-actions">
                ${opts.ios ? '' : '<button class="install-banner-btn install-banner-btn-primary" data-action="install">Installer</button>'}
                <button class="install-banner-btn install-banner-btn-secondary" data-action="dismiss">Plus tard</button>
            </div>
        `;
        return el;
    }

    function show(kind) {
        if (bannerEl) return;

        const isIOSKind = (kind === 'ios');
        bannerEl = buildBanner({
            ios: isIOSKind,
            subtitle: isIOSKind
                ? 'Appuyez sur Partager puis « Sur l\'écran d\'accueil ».'
                : 'Accès rapide depuis votre écran d\'accueil, mode hors-ligne.',
        });
        document.body.appendChild(bannerEl);

        // Slide-in animation
        requestAnimationFrame(() => bannerEl.classList.add('show'));

        // Wire up buttons
        bannerEl.querySelector('.install-banner-close')
            .addEventListener('click', dismiss);
        bannerEl.querySelector('[data-action="dismiss"]')
            .addEventListener('click', dismiss);

        const installBtn = bannerEl.querySelector('[data-action="install"]');
        if (installBtn) installBtn.addEventListener('click', triggerInstall);
    }

    function hide() {
        if (!bannerEl) return;
        const el = bannerEl;
        bannerEl = null;
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }

    function dismiss() {
        rememberDismiss();
        hide();
    }

    async function triggerInstall() {
        if (!deferredPrompt) return;
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[InstallBanner] User choice:', outcome);
        } catch (e) {
            console.warn('[InstallBanner] prompt failed:', e);
        }
        deferredPrompt = null;
        hide();
    }

    // ── Public API ─────────────────────────────────────────────────────────
    const InstallBanner = {
        get isInstalled() { return isStandalone(); },

        init() {
            // Already installed → nothing to do
            if (isStandalone()) return;

            // Capture the install prompt event (Chrome/Edge/Android)
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                if (!isDismissedRecently()) {
                    // Small delay so the banner doesn't appear during initial paint
                    setTimeout(() => show('default'), 800);
                }
            });

            window.addEventListener('appinstalled', () => {
                console.log('[InstallBanner] App installed');
                deferredPrompt = null;
                hide();
            });

            // iOS Safari has no beforeinstallprompt → show manual instructions
            if (isIOS() && !isDismissedRecently()) {
                setTimeout(() => show('ios'), 1500);
            }
        },

        /** Force the banner regardless of cooldown (e.g. from a settings page). */
        show() {
            localStorage.removeItem(STORAGE_KEY);
            if (deferredPrompt) {
                show('default');
            } else if (isIOS() && !isStandalone()) {
                show('ios');
            }
        },
    };

    window.InstallBanner = InstallBanner;
})();

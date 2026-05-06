/**
 * Vue Mes Groupages (client)
 * Liste les demandes de groupage du client connecté.
 */

Views.groups = {
    groups: [],
    expandedId: null,

    async render() {
        const main = document.getElementById('main-content');
        if (!main) return;

        main.innerHTML = `
            <div class="groups-view">
                <div class="page-header">
                    <h1 class="page-title">Mes groupages</h1>
                    <button class="btn btn-primary btn-sm" id="btn-new-group">
                        <svg class="icon-sm" viewBox="0 0 24 24"><use href="assets/icons/icons.svg#plus"></use></svg>
                        Nouveau
                    </button>
                </div>

                <div class="groups-info-banner">
                    <svg class="icon-sm" viewBox="0 0 24 24"><use href="assets/icons/icons.svg#info"></use></svg>
                    <span>Le groupage permet de consolider plusieurs petits colis en un seul envoi pour réduire les frais et simplifier la livraison.</span>
                </div>

                <div id="groups-list-container">
                    ${Loader.page('Chargement...')}
                </div>
            </div>
        `;

        document.getElementById('btn-new-group')?.addEventListener('click', () => this.openCreateModal());

        await this.loadGroups();
    },

    async loadGroups() {
        const container = document.getElementById('groups-list-container');
        try {
            const data = await API.groups.getAll();
            this.groups = data.groups || [];
            this.renderList();
        } catch (e) {
            container.innerHTML = `
                <div class="error-state">
                    <svg class="error-state-icon" viewBox="0 0 24 24"><use href="assets/icons/icons.svg#alert-circle"></use></svg>
                    <h3 class="error-state-title">Erreur de chargement</h3>
                    <p>${e.message || ''}</p>
                </div>
            `;
        }
    },

    renderList() {
        const container = document.getElementById('groups-list-container');
        if (!container) return;

        if (!this.groups.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24"><use href="assets/icons/icons.svg#package"></use></svg>
                    <h3 class="empty-state-title">Aucun groupage</h3>
                    <p class="empty-state-text">Créez votre premier groupage pour consolider plusieurs colis en un seul envoi.</p>
                    <button class="btn btn-primary mt-md" onclick="Views.groups.openCreateModal()">
                        Créer un groupage
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `<div class="groups-list">${this.groups.map(g => this.renderGroupCard(g)).join('')}</div>`;

        container.querySelectorAll('.group-card-header').forEach(h => {
            h.addEventListener('click', () => {
                const card = h.closest('.group-card');
                const id = card.dataset.id;
                this.expandedId = (this.expandedId === id) ? null : id;
                this.renderList();
            });
        });

        container.querySelectorAll('.btn-cancel-group').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (!confirm('Annuler cette demande de groupage ? Vos colis redeviendront indépendants.')) return;
                try {
                    await API.groups.cancel(id);
                    Toast.success('Demande annulée');
                    await this.loadGroups();
                } catch (err) {
                    Toast.error(err.message || 'Erreur');
                }
            });
        });
    },

    renderGroupCard(g) {
        const isExpanded = this.expandedId === g.id;
        const date = g.created_at ? new Date(g.created_at).toLocaleDateString('fr-FR') : '';

        return `
            <div class="group-card" data-id="${g.id}">
                <div class="group-card-header">
                    <div class="group-card-main">
                        <div class="group-card-number">${g.group_number}</div>
                        <div class="group-card-meta">
                            ${g.package_count} colis · Créé le ${date}
                        </div>
                    </div>
                    <div class="group-card-side">
                        ${this.renderStatusBadge(g.status)}
                        <svg class="icon-sm chevron ${isExpanded ? 'rotated' : ''}" viewBox="0 0 24 24">
                            <use href="assets/icons/icons.svg#chevron-down"></use>
                        </svg>
                    </div>
                </div>

                ${isExpanded ? `
                    <div class="group-card-body">
                        ${(g.status === 'approved' || g.status === 'ready_consolidation') ? `
                            <div class="group-progress">
                                <div class="group-progress-bar">
                                    <div class="group-progress-fill" style="width:${(g.received_count / Math.max(g.package_count, 1)) * 100}%"></div>
                                </div>
                                <div class="group-progress-label">${g.received_count}/${g.package_count} colis reçus à l'entrepôt</div>
                            </div>
                        ` : ''}

                        ${g.rejection_reason ? `
                            <div class="group-note group-note-error">
                                <strong>Motif de rejet :</strong> ${g.rejection_reason}
                            </div>
                        ` : ''}

                        ${g.client_notes ? `
                            <div class="group-note">
                                <strong>Votre note :</strong> ${g.client_notes}
                            </div>
                        ` : ''}

                        <h4 class="group-section-title">Colis du groupage</h4>
                        <div class="group-packages">
                            ${(g.packages || []).map(p => this.renderPackageRow(p)).join('')}
                        </div>

                        ${g.status === 'pending_approval' ? `
                            <div class="group-card-actions">
                                <button class="btn btn-outline btn-sm btn-cancel-group" data-id="${g.id}">
                                    Annuler la demande
                                </button>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderPackageRow(p) {
        const status = CONFIG.PACKAGE_STATUSES[p.status] || { label: p.status };
        const isReceived = ['received','in_transit','arrived_port','customs','out_for_delivery','delivered'].includes(p.status);

        return `
            <a href="#/packages/${p.id}" class="group-package-row" onclick="event.stopPropagation()">
                <div class="group-package-icon ${isReceived ? 'received' : ''}">
                    <svg class="icon-sm" viewBox="0 0 24 24">
                        <use href="assets/icons/icons.svg#${isReceived ? 'check' : 'package'}"></use>
                    </svg>
                </div>
                <div class="group-package-info">
                    <div class="group-package-tracking">${p.tracking_number}</div>
                    <div class="group-package-desc">${p.description || ''}</div>
                </div>
                <span class="status-badge status-${p.status}">${status.label}</span>
            </a>
        `;
    },

    renderStatusBadge(status) {
        const map = {
            'pending_approval':    { label: 'En attente',    cls: 'grp-badge-warning' },
            'approved':            { label: 'Approuvé',      cls: 'grp-badge-info' },
            'ready_consolidation': { label: 'Prêt',          cls: 'grp-badge-primary' },
            'consolidated':        { label: 'Expédié',       cls: 'grp-badge-success' },
            'rejected':            { label: 'Rejeté',        cls: 'grp-badge-error' }
        };
        const m = map[status] || { label: status, cls: 'grp-badge-default' };
        return `<span class="grp-badge ${m.cls}">${m.label}</span>`;
    },

    async openCreateModal() {
        Modal.open({
            title: 'Nouveau groupage',
            content: `
                <p class="text-sm text-muted mb-md">Sélectionnez au moins 2 colis (statut "En attente" ou "Reçu") à regrouper. Tous les colis doivent partager le même mode de transport et la même destination.</p>
                <div id="eligible-packages-container">${Loader.page('Chargement de vos colis...')}</div>
                <div class="form-group mt-md" id="grp-notes-group" style="display:none;">
                    <label class="form-label">Note (optionnel)</label>
                    <textarea id="grp-client-notes" class="form-input" rows="2" placeholder="Précisions pour l'agence..."></textarea>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" onclick="Modal.close()">Annuler</button>
                <button class="btn btn-primary" id="btn-confirm-create-group" disabled>
                    Créer le groupage
                </button>
            `
        });

        try {
            const data = await API.groups.getEligiblePackages();
            const eligible = data.packages || [];
            const container = document.getElementById('eligible-packages-container');

            if (!eligible.length) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:var(--spacing-md) 0;">
                        <svg class="empty-state-icon" viewBox="0 0 24 24"><use href="assets/icons/icons.svg#package"></use></svg>
                        <p class="empty-state-text">Aucun colis éligible. Vos colis doivent être en statut "En attente" ou "Reçu" et ne pas déjà appartenir à un groupage.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="eligible-packages-list">
                    ${eligible.map(p => this.renderEligibleRow(p)).join('')}
                </div>
                <div class="text-sm text-muted mt-sm" id="grp-selection-hint">
                    Sélectionnez au moins 2 colis
                </div>
            `;
            document.getElementById('grp-notes-group').style.display = '';

            // Sélection
            const selected = new Set();
            const updateSelection = () => {
                const btn = document.getElementById('btn-confirm-create-group');
                const hint = document.getElementById('grp-selection-hint');
                if (selected.size >= 2) {
                    btn.disabled = false;
                    hint.textContent = `${selected.size} colis sélectionnés`;
                    hint.classList.add('valid');
                } else {
                    btn.disabled = true;
                    hint.textContent = `Sélectionnez au moins 2 colis (${selected.size}/2)`;
                    hint.classList.remove('valid');
                }
            };

            container.querySelectorAll('.eligible-row').forEach(row => {
                row.addEventListener('click', () => {
                    const id = row.dataset.id;
                    if (selected.has(id)) {
                        selected.delete(id);
                        row.classList.remove('selected');
                    } else {
                        selected.add(id);
                        row.classList.add('selected');
                    }
                    updateSelection();
                });
            });

            document.getElementById('btn-confirm-create-group').addEventListener('click', async () => {
                if (selected.size < 2) return;
                const notes = document.getElementById('grp-client-notes').value.trim();
                try {
                    await API.groups.create({
                        package_ids: Array.from(selected),
                        client_notes: notes || undefined
                    });
                    Toast.success('Demande de groupage créée');
                    Modal.close();
                    await this.loadGroups();
                } catch (err) {
                    Toast.error(err.message || 'Erreur');
                }
            });

        } catch (e) {
            const container = document.getElementById('eligible-packages-container');
            if (container) container.innerHTML = `<p class="text-error">${e.message || 'Erreur de chargement'}</p>`;
        }
    },

    renderEligibleRow(p) {
        const status = CONFIG.PACKAGE_STATUSES[p.status] || { label: p.status };
        return `
            <div class="eligible-row" data-id="${p.id}">
                <div class="eligible-row-check">
                    <svg viewBox="0 0 24 24" width="14" height="14"><use href="assets/icons/icons.svg#check"></use></svg>
                </div>
                <div class="eligible-row-info">
                    <div class="eligible-row-tracking">${p.tracking_number}</div>
                    <div class="eligible-row-desc">${p.description || ''}</div>
                </div>
                <span class="status-badge status-${p.status}">${status.label}</span>
            </div>
        `;
    }
};

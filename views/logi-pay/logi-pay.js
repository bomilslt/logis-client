const LogiPayView = {
    config: null,
    requests: [],

    // Guard anti-race-condition : vérifie que le conteneur est toujours dans le DOM
    _container() { return document.getElementById('logi-pay-container'); },
    _isStillMounted() { return !!this._container(); },

    async render() {
        const main = document.getElementById('main-content');
        if (!main) {
            console.error('[LogiPay] main-content introuvable');
            return;
        }

        main.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Logi Pay</h1>
                <p class="page-subtitle">Paiements fournisseurs en Chine</p>
            </div>
            <div id="logi-pay-container">
                ${Loader.page('Chargement de la configuration...')}
            </div>
        `;

        await this.loadConfigAndData();
    },

    async loadConfigAndData() {
        try {
            // Load config — le backend retourne l'objet logi_pay directement
            const configResponse = await API.logiPay.getConfig();

            // Guard: si l'utilisateur a navigué ailleurs pendant l'appel API, on abandonne
            if (!this._isStillMounted()) return;

            // L'endpoint /logi-pay/config retourne { enabled, exchange_rate_cny, ... } directement
            this.config = configResponse || { enabled: false };

            if (!this.config.enabled) {
                this.renderDisabledState();
                return;
            }

            // Load user requests
            const reqResponse = await API.logiPay.getRequests();

            // Guard: deuxième vérification après le second await
            if (!this._isStillMounted()) return;

            this.requests = reqResponse.requests || [];
            this.renderMain();
        } catch (error) {
            console.error('Error loading Logi Pay data:', error);
            const lpContainer = this._container();
            if (lpContainer) {
                lpContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon text-error">${Icons.get('alertCircle', {size:48})}</div>
                    <h3 class="empty-state-title">Erreur de chargement</h3>
                    <p class="empty-state-desc">Impossible de charger le service Logi Pay. Veuillez réessayer plus tard.</p>
                </div>
            `;
            }
        }
    },

    renderDisabledState() {
        const c = this._container();
        if (!c) return;
        c.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon text-muted">${Icons.get('alertTriangle', {size:48})}</div>
                <h3 class="empty-state-title">Service non disponible</h3>
                <p class="empty-state-text">Le service Logi Pay est actuellement désactivé. Veuillez contacter le support pour plus d'informations.</p>
            </div>
        `;
    },

    renderMain() {
        const container = this._container();
        if (!container) return;

        container.innerHTML = `
            <div class="logi-pay-grid">
                <!-- Formulaire de demande -->
                <div class="card">
                    <div class="card-header lp-card-header">
                        <h3 class="card-title">Nouvelle demande</h3>
                    </div>
                    <div class="card-body">
                        ${this.config.disclaimer ? `
                            <div class="lp-disclaimer">
                                ${Icons.get('info', {size:15})}
                                <span>${this.config.disclaimer}</span>
                            </div>
                        ` : ''}

                        <form id="logi-pay-form">
                            <div class="form-group">
                                <label class="form-label">Nom du fournisseur *</label>
                                <input type="text" id="lp-supplier" class="form-input" required placeholder="Nom de l'entreprise ou contact WeChat">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Référence commande / facture</label>
                                <input type="text" id="lp-reference" class="form-input" placeholder="Optionnel">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Montant à payer (Yuan / CNY) *</label>
                                <div class="lp-input-group">
                                    <span class="lp-input-prefix">¥</span>
                                    <input type="number" id="lp-amount-cny" class="form-input lp-amount-input" step="0.01" min="1" required placeholder="0.00">
                                </div>
                            </div>

                            <div class="lp-rate-box">
                                <div class="lp-rate-row">
                                    <span class="lp-rate-label">Taux de change</span>
                                    <span class="lp-rate-value">1 CNY = ${this.config.exchange_rate_cny} ${this.config.currency_local}</span>
                                </div>
                                <div class="lp-rate-divider"></div>
                                <div class="lp-rate-row">
                                    <span class="lp-rate-label lp-rate-bold">Total estimé à payer</span>
                                    <span class="lp-total-amount" id="lp-estimated-total">0 ${this.config.currency_local}</span>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Méthode de paiement *</label>
                                <select id="lp-method" class="form-input" required>
                                    <option value="">Sélectionner...</option>
                                    <option value="Alipay">Alipay</option>
                                    <option value="WeChat Pay">WeChat Pay</option>
                                    <option value="Bank Transfer">Virement Bancaire (Chine)</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Compte bénéficiaire *</label>
                                <input type="text" id="lp-account" class="form-input" required placeholder="N° de compte, téléphone ou ID">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Nom du bénéficiaire</label>
                                <input type="text" id="lp-beneficiary" class="form-input" placeholder="Optionnel">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <textarea id="lp-notes" class="form-input" rows="2" placeholder="Instructions supplémentaires..."></textarea>
                            </div>

                            <button type="submit" class="btn btn-primary btn-block" id="btn-submit-lp">
                                Soumettre la demande
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Historique -->
                <div class="card">
                    <div class="card-header lp-card-header">
                        <h3 class="card-title">Mes demandes</h3>
                        <button class="btn btn-ghost btn-sm lp-refresh-btn" id="btn-refresh-lp" title="Actualiser">
                            ${Icons.get('refresh', {size:16})}
                        </button>
                    </div>
                    <div id="lp-history-content">
                        ${this.renderHistoryContent()}
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    renderHistoryContent() {
        if (this.requests.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        ${Icons.get('fileText', {size:40})}
                    </div>
                    <h3 class="empty-state-title">Aucune demande</h3>
                    <p class="empty-state-text">Vos demandes de paiement fournisseur apparaîtront ici.</p>
                </div>
            `;
        }
        return `
            <div class="table-container">
                <table class="table" id="lp-history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Fournisseur</th>
                            <th>Montant</th>
                            <th>Statut</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.renderHistoryRows()}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderHistoryRows() {
        return this.requests.map(req => `
            <tr>
                <td class="text-sm text-muted">${new Date(req.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                    <div class="font-medium">${req.supplier_name}</div>
                    ${req.order_reference ? `<div class="text-sm text-muted">Réf: ${req.order_reference}</div>` : ''}
                </td>
                <td class="font-semibold text-primary">¥${new Intl.NumberFormat('fr-FR').format(req.amount_cny)}</td>
                <td>${this.getStatusBadge(req.status)}</td>
                <td class="text-right">
                    <button class="btn btn-sm btn-outline btn-view" data-id="${req.id}" title="Détails">
                        ${Icons.get('eye', {size:14})}
                    </button>
                </td>
            </tr>
        `).join('');
    },

    getStatusBadge(status) {
        const map = {
            'pending_payment': '<span class="lp-badge lp-badge-warning">En attente de paiement</span>',
            'paid_by_client':  '<span class="lp-badge lp-badge-info">Paiement reçu</span>',
            'processing':      '<span class="lp-badge lp-badge-primary">En traitement</span>',
            'completed':       '<span class="lp-badge lp-badge-success">Terminé</span>',
            'rejected':        '<span class="lp-badge lp-badge-error">Rejeté</span>'
        };
        return map[status] || `<span class="lp-badge lp-badge-default">${status}</span>`;
    },

    bindEvents() {
        // Calculator
        const amountInput = document.getElementById('lp-amount-cny');
        const totalDisplay = document.getElementById('lp-estimated-total');
        if (amountInput && totalDisplay && this.config) {
            amountInput.addEventListener('input', (e) => {
                const cny = parseFloat(e.target.value) || 0;
                const local = cny * this.config.exchange_rate_cny;
                totalDisplay.textContent = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(local) + ' ' + this.config.currency_local;
            });
            amountInput.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
        }

        // Form submit
        const form = document.getElementById('logi-pay-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btn-submit-lp');
                const cnyAmount = parseFloat(document.getElementById('lp-amount-cny').value);
                const localAmount = cnyAmount * this.config.exchange_rate_cny;
                const payload = {
                    supplier_name: document.getElementById('lp-supplier').value.trim(),
                    order_reference: document.getElementById('lp-reference').value.trim(),
                    amount_cny: cnyAmount,
                    amount_local: localAmount,
                    currency_local: this.config.currency_local,
                    payment_method: document.getElementById('lp-method').value,
                    beneficiary_account: document.getElementById('lp-account').value.trim(),
                    beneficiary_name: document.getElementById('lp-beneficiary').value.trim(),
                    client_notes: document.getElementById('lp-notes').value.trim()
                };
                try {
                    btn.disabled = true;
                    btn.innerHTML = Loader.inline('sm') + ' Traitement...';
                    await API.logiPay.createRequest(payload);
                    Toast.success('Demande soumise avec succès');
                    form.reset();
                    if (totalDisplay) totalDisplay.textContent = `0 ${this.config.currency_local}`;
                    const reqResponse = await API.logiPay.getRequests();
                    this.requests = reqResponse.requests || [];
                    this._refreshHistory();
                } catch (err) {
                    Toast.error(err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = 'Soumettre la demande';
                }
            });
        }

        // Refresh
        document.getElementById('btn-refresh-lp')?.addEventListener('click', async () => {
            try {
                const reqResponse = await API.logiPay.getRequests();
                this.requests = reqResponse.requests || [];
                this._refreshHistory();
                Toast.success('Liste actualisée');
            } catch (err) {
                Toast.error(err.message);
            }
        });

        // View details — délégation sur le container stable
        this._container()?.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-view');
            if (!btn) return;
            this.showDetailsModal(btn.dataset.id);
        });
    },

    _refreshHistory() {
        const el = document.getElementById('lp-history-content');
        if (el) el.innerHTML = this.renderHistoryContent();
    },

    showDetailsModal(id) {
        const req = this.requests.find(r => r.id === id);
        if (!req) return;

        const getStatusText = (status) => {
            const texts = {
                'pending_payment': 'En attente de paiement par vous. Veuillez payer dans nos bureaux ou via le moyen convenu.',
                'paid_by_client': 'Paiement reçu. Nous procédons au transfert.',
                'processing': 'Transfert au fournisseur en cours.',
                'completed': 'Transfert terminé.',
                'rejected': 'Demande rejetée.'
            };
            return texts[status] || status;
        };

        const content = `
            <div class="alert ${req.status === 'rejected' ? 'alert-error' : 'alert-info'} mb-md">
                ${Icons.get('info', {size:16})}
                <div>${getStatusText(req.status)}</div>
            </div>
            
            ${req.rejection_reason ? `
            <div class="alert alert-error mb-md">
                <strong>Motif de rejet :</strong> ${req.rejection_reason}
            </div>` : ''}

            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Fournisseur</div>
                    <div class="detail-value font-medium">${req.supplier_name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Référence</div>
                    <div class="detail-value">${req.order_reference || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Montant en Yuan</div>
                    <div class="detail-value font-medium text-primary">¥${new Intl.NumberFormat('fr-FR').format(req.amount_cny)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total à payer</div>
                    <div class="detail-value font-medium">${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(req.amount_local)} ${req.currency_local}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Méthode</div>
                    <div class="detail-value">${req.payment_method}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Compte</div>
                    <div class="detail-value">${req.beneficiary_account}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Bénéficiaire</div>
                    <div class="detail-value">${req.beneficiary_name || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Créé le</div>
                    <div class="detail-value">${new Date(req.created_at).toLocaleString()}</div>
                </div>
            </div>
        `;

        Modal.open({
            title: `Demande #${req.id.substring(0, 8)}`,
            content,
            size: 'md',
            footer: `<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>`
        });
    }
};

window.LogiPayView = LogiPayView;

/**
 * frontend/static/js/client.js
 * Logique JavaScript pour l'Espace Client Web La Poste CI.
 */

document.addEventListener('DOMContentLoaded', () => {
  const simuPays = document.getElementById('simuPays');
  const simuType = document.getElementById('simuType');
  const simuPoids = document.getElementById('simuPoids');
  const simuValeur = document.getElementById('simuValeur');
  const simuL = document.getElementById('simuL');
  const simuW = document.getElementById('simuW');
  const simuH = document.getElementById('simuH');

  const btnEstimer = document.getElementById('btnEstimer');
  const btnGoToStep2 = document.getElementById('btnGoToStep2');
  const priceBanner = document.getElementById('priceBanner');
  const priceDisplay = document.getElementById('priceDisplay');

  const step1Content = document.getElementById('step1Content');
  const step2Content = document.getElementById('step2Content');
  const step3Content = document.getElementById('step3Content');

  const stepHeader1 = document.getElementById('stepHeader1');
  const stepHeader2 = document.getElementById('stepHeader2');
  const stepHeader3 = document.getElementById('stepHeader3');

  const btnBackToStep1 = document.getElementById('btnBackToStep1');
  const shippingForm = document.getElementById('shippingForm');

  const bookingCodeDisplay = document.getElementById('bookingCodeDisplay');
  const finalPriceDisplay = document.getElementById('finalPriceDisplay');
  const qrcodeCanvas = document.getElementById('qrcodeCanvas');

  let currentEstimate = null;

  // Liste des 229 pays principaux
  const PAYS = [
    "France", "Italie", "États-Unis", "Canada", "Allemagne", "Belgique", "Espagne",
    "Royaume-Uni", "Chine", "Japon", "Sénégal", "Mali", "Burkina Faso", "Bénin",
    "Togo", "Ghana", "Maroc", "Tunisie", "Algérie", "Cameroun", "Gabon",
    "Congo", "République Démocratique du Congo", "Afrique du Sud", "Suisse",
    "Émirats arabes unis", "Turquie", "Brésil", "Australie", "Inde"
  ].sort((a, b) => a.localeCompare(b, 'fr'));

  // Charger les pays dans le select
  function loadCountries() {
    simuPays.innerHTML = '<option value="">-- Sélectionnez le pays de destination --</option>';
    PAYS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      simuPays.appendChild(opt);
    });
  }
  loadCountries();

  // Formatter en Francs CFA (XOF)
  function formatXOF(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XOF';
  }

  // Action : Calculer le tarif
  btnEstimer.addEventListener('click', async () => {
    const dest_pays = simuPays.value;
    const poids_reel = parseFloat(String(simuPoids.value || 0).replace(',', '.')) || 0;

    if (!dest_pays) {
      alert('Veuillez sélectionner le pays de destination.');
      return;
    }
    if (poids_reel <= 0) {
      alert('Veuillez entrer un poids valide.');
      return;
    }

    btnEstimer.disabled = true;
    btnEstimer.textContent = 'Calcul en cours…';

    try {
      const res = await fetch('/api/client/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dest_pays,
          poids_reel,
          type_envoi: simuType.value,
          longueur: simuL.value,
          largeur: simuW.value,
          hauteur: simuH.value
        })
      });

      const data = await res.json();

      if (data.ok) {
        currentEstimate = data;
        priceDisplay.textContent = formatXOF(data.total_payer);
        priceBanner.classList.remove('hidden');
        btnGoToStep2.classList.remove('hidden');
      } else {
        alert(data.error || 'Erreur lors du calcul');
      }
    } catch (err) {
      alert('Impossible de contacter le serveur.');
    } finally {
      btnEstimer.disabled = false;
      btnEstimer.textContent = 'Calculer le Tarif Net';
    }
  });

  // Passer à l'Étape 2
  btnGoToStep2.addEventListener('click', () => {
    step1Content.classList.add('hidden');
    step2Content.classList.remove('hidden');
    stepHeader1.classList.remove('active');
    stepHeader1.classList.add('completed');
    stepHeader2.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Retour à l'Étape 1
  btnBackToStep1.addEventListener('click', () => {
    step2Content.classList.add('hidden');
    step1Content.classList.remove('hidden');
    stepHeader2.classList.remove('active');
    stepHeader1.classList.remove('completed');
    stepHeader1.classList.add('active');
  });

  // Soumission de l'expédition (Étape 2 -> Étape 3)
  shippingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = shippingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Génération en cours…';

    const payload = {
      exp_nom: document.getElementById('expNom').value,
      exp_tel: document.getElementById('expTel').value,
      exp_email: document.getElementById('expEmail').value,
      exp_adresse: document.getElementById('expAdresse').value,
      dest_nom: document.getElementById('destNom').value,
      dest_tel: document.getElementById('destTel').value,
      dest_ville: document.getElementById('destVille').value,
      dest_adresse: document.getElementById('destAdresse').value,
      dest_pays: simuPays.value,
      type_envoi: simuType.value,
      poids_reel: simuPoids.value,
      longueur: simuL.value,
      largeur: simuW.value,
      hauteur: simuH.value,
      valeur_declaree: simuValeur.value
    };

    try {
      const res = await fetch('/api/client/pre-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.ok) {
        // Succès -> Afficher l'Étape 3 (QR Code)
        bookingCodeDisplay.textContent = data.code;
        finalPriceDisplay.textContent = formatXOF(data.total_payer);

        // Générer le QR Code
        qrcodeCanvas.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
          new QRCode(qrcodeCanvas, {
            text: data.code,
            width: 180,
            height: 180,
            colorDark: "#0E1B17",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.H
          });
        } else {
          // Fallback SVG si le CDN est bloqué
          qrcodeCanvas.innerHTML = `<div style="font-weight:bold; font-size:1.4rem; padding:20px; border:2px solid #0E1B17; border-radius:10px;">${data.code}</div>`;
        }

        step2Content.classList.add('hidden');
        step3Content.classList.remove('hidden');
        stepHeader2.classList.remove('active');
        stepHeader2.classList.add('completed');
        stepHeader3.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } else {
        alert(data.error || 'Erreur lors de la création du pré-enregistrement.');
      }
    } catch (err) {
      alert('Erreur réseau. Veuillez réespayer.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Génération du Pass QR Code';
    }
  });

});

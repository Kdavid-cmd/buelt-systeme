/**
 * backend/routes/assistant.js
 * POST /api/assistant/ask
 *
 * Assistant 100% local à base de règles — aucune clé API, aucun coût.
 * Répond uniquement à partir des données internes réelles : grilles et zones
 * DHL (surtaxeService.js), grille et zones EMS (emsReference.js).
 *
 * Il ne se limite pas à une simple FAQ : il extrait les informations d'une
 * question en langage naturel (pays, poids, quantité × poids unitaire),
 * effectue le calcul avec les vraies grilles internes quand c'est possible,
 * et demande explicitement l'information manquante sinon. Il ne devine et
 * n'invente jamais un tarif.
 */
const express = require('express');
const router = express.Router();
const { PAYS_LIST, calculerSurtaxes, calculerPoidsVolumetrique } = require('../services/surtaxeService');
const { EMS_COUNTRIES, EMS_ZONE_INFO, trouverTrancheEms } = require('../data/emsReference');

function findCountry(list, nameGetter, text) {
  const lower = text.toLowerCase();
  // Trie par longueur décroissante pour matcher "Corée du Sud" avant "Corée"-like cas ambigus
  const sorted = [...list].sort((a, b) => nameGetter(b).length - nameGetter(a).length);
  return sorted.find(item => lower.includes(nameGetter(item).toLowerCase()));
}

function extractWeightKg(text) {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function extractDims(text) {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  return [1, 2, 3].map(i => parseFloat(m[i].replace(',', '.')));
}

// Repère un cas "quantité × poids unitaire" du type "2 téléviseurs de 5,39 kg
// chacun" dans UNE clause isolée. Retourne null si aucun poids unitaire "par
// article" n'est identifié dans cette clause (elle sera alors ignorée).
function extractItemFromClause(clause) {
  const unitMatch = clause.match(/(\d+(?:[.,]\d+)?)\s*kg\s*(?:chacune?s?|l'unit[eé]|par (?:article|unit[eé]|pi[eè]ce|colis))/i);
  if (!unitMatch) return null;
  const unit = parseFloat(unitMatch[1].replace(',', '.'));
  if (!unit) return null;

  // Quantité : "N x", ou "N <mot(s) quelconques> de" (couvre n'importe quel nom
  // d'article — frigo, climatiseur, télé, colis… — sans liste figée de noms),
  // avec une petite liste de noms courants en secours si "de" est absent.
  const qtyMatch = clause.match(/(\d+)\s*(?:x|×)\b|(\d+)\s+\D{0,25}?\bde\b|(\d+)\s+\D{0,20}?(?:articles?|colis|t[ée]l[ée]?|t[ée]l[ée]viseurs?|pi[eè]ces?|unit[eé]s?|bo[iî]tes?|cartons?|sacs?|paquets?|climatiseurs?|frigos?|r[ée]frig[ée]rateurs?)/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2] || qtyMatch[3], 10) : 1;

  return { qty: qty || 1, unit };
}

// Découpe une question en clauses candidates (une par type d'article), sur
// les séparateurs usuels d'énumération : tiret, retour à la ligne, point-virgule.
// Permet de traiter "10 articles de 17 kg chacun -3 articles de 6,5 kg
// chacun" comme deux articles distincts plutôt qu'un seul poids mélangé.
function extractItems(text) {
  const clauses = text.split(/(?:\s-\s?|^-\s?|\n|;)/).map(s => s.trim()).filter(Boolean);
  return clauses.map(extractItemFromClause).filter(Boolean);
}

function fmt(n) {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA';
}

function answer(question) {
  const q = (question || '').trim();
  if (!q) {
    return { text: "Posez une question sur un pays, une zone, un tarif ou une formule de calcul (DHL ou EMS).", source: null };
  }
  const lower = q.toLowerCase();

  const mentionsDhl = lower.includes('dhl');
  const mentionsEms = lower.includes('ems');
  const mentionsSurtaxe = lower.includes('surtaxe');
  const mentionsPoidsVol = lower.includes('volum');
  const mentionsFormule = lower.includes('formule') || lower.includes('comment') || lower.includes('calcul');

  const items = extractItems(q);

  // ── FAQ : formule de la surtaxe DHL ─────────────────────────────
  if (mentionsSurtaxe && mentionsFormule) {
    return {
      text: "La surtaxe DHL se calcule ainsi : surtaxe = montant du jour DHL − « tarif vendu à la poste » (grille interne par zone et poids), avec un minimum de 0. Le montant total facturé au client = tarif guichet + surtaxe. Le tarif guichet et le « tarif vendu à la poste » dépendent tous les deux de la zone du pays et du poids facturable (le plus élevé entre poids réel et poids volumétrique).",
      source: 'Formule de surtaxe — backend/services/surtaxeService.js (calculerSurtaxes)'
    };
  }

  // ── FAQ : poids volumétrique (DHL) ────────────────────────────────
  if (mentionsPoidsVol) {
    const dims = extractDims(q);
    if (dims) {
      const [l, w, h] = dims;
      const poidsVol = calculerPoidsVolumetrique(l, w, h);
      return {
        text: `Pour des dimensions ${l} × ${w} × ${h} cm, le poids volumétrique est (${l} × ${w} × ${h}) ÷ 5000 = ${Math.round(poidsVol * 100) / 100} kg. Le poids facturable retenu est le plus élevé entre ce poids volumétrique et le poids réel.`,
        source: 'Formule poids volumétrique — backend/services/surtaxeService.js (calculerPoidsVolumetrique)'
      };
    }
    return {
      text: "Le poids volumétrique se calcule ainsi : (Longueur × Largeur × Hauteur en cm) ÷ 5000 = poids en kg. Le poids facturable retenu pour le calcul est le plus élevé entre ce poids volumétrique et le poids réel.",
      source: 'Formule poids volumétrique — backend/services/surtaxeService.js (calculerPoidsVolumetrique)'
    };
  }

  // ── FAQ : formule du tarif EMS ──────────────────────────────────
  if (mentionsEms && mentionsFormule && items.length === 0 && !extractWeightKg(q)) {
    return {
      text: "Le tarif EMS se calcule ainsi : le pays de destination détermine une zone EMS (1, 2 ou 3), puis le poids détermine une tranche tarifaire dans la grille de cette zone (par pas de 0,5 kg jusqu'à 30 kg), ce qui donne un tarif TTC. Donnez-moi un pays et un poids et je peux calculer le tarif exact.",
      source: 'Formule EMS — backend/data/emsReference.js (trouverTrancheEms)'
    };
  }

  const dhlCountry = findCountry(PAYS_LIST, c => c.nom, q);
  const emsCountry = findCountry(EMS_COUNTRIES, c => c[0], q);

  // ── Question EMS ──────────────────────────────────────────────
  // Chaque article EMS est tarifé selon SON PROPRE poids (une tranche par
  // article), puis ce tarif est multiplié par la quantité — on ne somme
  // jamais les poids de plusieurs articles pour chercher une seule tranche.
  // Une énumération de PLUSIEURS types d'articles (ex : "10 climatiseurs de
  // 17 kg — 3 de 6,5 kg — 2 de 20 kg") correspond toujours à ce mode de
  // calcul par article, même si le mot "EMS" n'est pas explicitement écrit —
  // DHL ne dispose d'aucune logique de ce type (un envoi DHL = un seul poids
  // facturable). On respecte cependant une mention explicite de "DHL".
  if ((mentionsEms || items.length > 1) && !mentionsDhl) {

    if (items.length > 0) {
      if (!emsCountry) {
        const summary = items.map(it => `${it.qty} × ${it.unit} kg`).join(', ');
        return {
          text: `J'ai identifié ${items.length > 1 ? `${items.length} types d'articles` : '1 article'} (${summary}). Chaque article EMS est tarifé selon son propre poids, puis multiplié par sa quantité. Pour calculer le tarif, j'ai besoin du pays de destination afin de déterminer la zone EMS.`,
          source: null
        };
      }

      const zone = emsCountry[1];
      const info = EMS_ZONE_INFO[zone];
      const lines = [];
      let total = 0;
      let horsGrille = 0;
      for (const it of items) {
        const tranche = trouverTrancheEms(zone, it.unit);
        if (!tranche) { horsGrille += it.qty; continue; }
        const ligneTotal = tranche.ttc * it.qty;
        total += ligneTotal;
        lines.push(`${it.qty} × ${it.unit} kg (tranche ${tranche.band} kg) : ${fmt(tranche.ttc)} × ${it.qty} = ${fmt(ligneTotal)}`);
      }

      if (!lines.length) {
        return {
          text: `${emsCountry[0]} est en zone EMS ${zone}, mais aucun des poids indiqués n'entre dans la grille EMS disponible (maximum 30 kg par article).`,
          source: `Grille EMS — backend/data/emsReference.js (Zone ${zone})`
        };
      }

      const totalLabel = items.length > 1 || items[0].qty > 1 ? ` Total général : ${fmt(total)}.` : '';
      const horsGrilleLabel = horsGrille > 0 ? ` (${horsGrille} article(s) dépassant 30 kg exclus du calcul.)` : '';
      return {
        text: `${emsCountry[0]} est en zone EMS ${zone}. ${lines.join(' — ')}.${totalLabel}${horsGrilleLabel}`,
        source: `Grille EMS — backend/data/emsReference.js (Zone ${zone})`
      };
    }

    // Aucun article "quantité × poids" détecté : question sur un poids simple
    const w = extractWeightKg(q);
    if (!w) {
      if (emsCountry) {
        const zone = emsCountry[1];
        const info = EMS_ZONE_INFO[zone];
        return {
          text: `${emsCountry[0]} est en zone EMS ${zone}. Indiquez un poids en kg pour que je calcule le tarif exact.`,
          source: `Zones EMS — backend/data/emsReference.js (Zone ${zone})`
        };
      }
      if (lower.includes('zone')) {
        return {
          text: "Les données EMS distinguent 3 zones (Zone 1 : pays limitrophes, Zone 2, Zone 3 : reste du monde) — consultez l'onglet Zones du module EMS pour la liste complète des pays par zone.",
          source: 'Zones EMS — backend/data/emsReference.js'
        };
      }
      return {
        text: "Je n'ai pas identifié de pays EMS dans votre question. Précisez un pays de destination et un poids en kg pour que je calcule le tarif.",
        source: null
      };
    }

    if (!emsCountry) {
      return {
        text: `Pour ${w} kg, je peux calculer le tarif EMS dès que vous me donnez le pays de destination (pour déterminer la zone EMS).`,
        source: null
      };
    }

    const zone = emsCountry[1];
    const info = EMS_ZONE_INFO[zone];
    const tranche = trouverTrancheEms(zone, w);
    if (!tranche) {
      return {
        text: `${emsCountry[0]} est en zone EMS ${zone}, mais ${w} kg dépasse la grille EMS disponible (maximum 30 kg par envoi).`,
        source: `Grille EMS — backend/data/emsReference.js (Zone ${zone})`
      };
    }
    return {
      text: `${emsCountry[0]} est en zone EMS ${zone}. Pour ${w} kg (tranche ${tranche.band} kg) : ${fmt(tranche.ttc)} TTC (HT ${fmt(tranche.ht)} + TVA ${fmt(tranche.tva)}).`,
      source: `Grille EMS — backend/data/emsReference.js (Zone ${zone}, tranche ${tranche.band} kg)`
    };
  }

  // ── Question DHL (par défaut si un pays DHL est identifié) ────
  // Même principe que pour EMS : un envoi DHL est facturé sur SON PROPRE
  // poids. Pour plusieurs articles, on calcule le tarif guichet de chacun
  // séparément puis on multiplie par sa quantité — on ne somme jamais les
  // poids de plusieurs articles pour chercher un tarif sur un poids combiné.
  if (dhlCountry) {
    if (items.length > 0) {
      const lines = [];
      let total = 0;
      let zoneRef = null;
      for (const it of items) {
        const resultat = calculerSurtaxes({ dest_pays: dhlCountry.nom, poids_reel: it.unit, type_envoi: 'DOCUMENT', montant_jour_dhl: 0 });
        zoneRef = resultat.zone;
        const ligneTotal = resultat.tarif_guichet * it.qty;
        total += ligneTotal;
        lines.push(`${it.qty} × ${it.unit} kg (${resultat.type_envoi.toLowerCase()}) : tarif guichet ${fmt(resultat.tarif_guichet)} × ${it.qty} = ${fmt(ligneTotal)}`);
      }
      const totalLabel = items.length > 1 || items[0].qty > 1 ? ` Total général (tarif guichet) : ${fmt(total)}.` : '';
      return {
        text: `${dhlCountry.nom} est en zone DHL ${zoneRef}. ${lines.join(' — ')}.${totalLabel} La surtaxe exacte dépend du montant du jour DHL saisi par l'agent pour chaque envoi — utilisez le calculateur DHL pour l'obtenir.`,
        source: `Zones et grilles DHL — backend/services/surtaxeService.js (Zone ${zoneRef})`
      };
    }

    const w = extractWeightKg(q);
    if (w) {
      const resultat = calculerSurtaxes({ dest_pays: dhlCountry.nom, poids_reel: w, type_envoi: 'DOCUMENT', montant_jour_dhl: 0 });
      return {
        text: `${dhlCountry.nom} est en zone DHL ${resultat.zone}. Pour ${w} kg (${resultat.type_envoi.toLowerCase()}), le tarif guichet est de ${fmt(resultat.tarif_guichet)}. La surtaxe exacte dépend du montant du jour DHL saisi par l'agent — utilisez le calculateur DHL pour l'obtenir.`,
        source: `Zones et grilles DHL — backend/services/surtaxeService.js (Zone ${resultat.zone})`
      };
    }
    return {
      text: `${dhlCountry.nom} est en zone DHL ${dhlCountry.zone}. Utilisez le calculateur DHL avec un poids et le montant du jour DHL pour obtenir le tarif exact et la surtaxe.`,
      source: `Zones DHL — backend/services/surtaxeService.js (Zone ${dhlCountry.zone})`
    };
  }

  if (lower.includes('zone') && mentionsDhl) {
    return {
      text: "DHL fonctionne avec 8 zones tarifaires. Chaque pays est rattaché à une zone dans la grille interne — consultez l'onglet Zones du module DHL pour rechercher un pays précis.",
      source: 'Zones DHL — backend/services/surtaxeService.js (PAYS_LIST)'
    };
  }
  if (lower.includes('zone') && mentionsEms) {
    return {
      text: "Les données EMS distinguent 3 zones (Zone 1 : pays limitrophes, Zone 2, Zone 3 : reste du monde) — consultez l'onglet Zones du module EMS pour rechercher un pays précis.",
      source: 'Zones EMS — backend/data/emsReference.js'
    };
  }

  return {
    text: "Je n'ai pas trouvé cette information dans les données internes disponibles (zones/tarifs DHL, zones/tarifs EMS, formules de calcul). Essayez avec le nom d'un pays, un poids en kg, ou reformulez votre question.",
    source: null
  };
}

router.post('/ask', (req, res) => {
  try {
    const { question } = req.body || {};
    const result = answer(question);
    res.json({ ok: true, answer: result.text, source: result.source });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

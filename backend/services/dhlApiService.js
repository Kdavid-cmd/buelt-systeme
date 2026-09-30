/**
 * backend/services/dhlApiService.js
 * Service d'intégration avec l'API DHL Express (MyDHL API / Rating API).
 * Permet d'obtenir les tarifs dynamiques du jour (Base, Carburant, Zone Éloignée, Risque).
 */

const logger = require('./loggerService');

// Environnements DHL Express
const DHL_TEST_URL = 'https://express.api.dhl.com/mydhlapi/test';
const DHL_PROD_URL = 'https://express.api.dhl.com/mydhlapi';

/**
 * Récupère le tarif du jour DHL Express pour un envoi
 * @param {Object} params 
 * @param {string} params.destCountryCode Code ISO pays (ex: 'FR', 'US', 'IT')
 * @param {string} [params.destPostalCode] Code postal destination
 * @param {string} [params.destCity] Ville destination
 * @param {number} params.weight Poids facturable en kg
 * @param {boolean} params.isDoc Document (true) ou Colis (false)
 * @param {Object} [params.dimensions] { l, w, h } en cm
 * @returns {Promise<Object>} { montant_jour_dhl, breakdown, isLiveApi }
 */
async function fetchDhlLiveRate(params) {
  const apiKey = process.env.DHL_API_KEY;
  const apiSecret = process.env.DHL_API_SECRET;
  const accountNumber = process.env.DHL_ACCOUNT_NUMBER || '317534889';
  const isProd = process.env.DHL_ENV === 'production';

  const baseUrl = isProd ? DHL_PROD_URL : DHL_TEST_URL;

  if (apiKey && apiSecret) {
    try {
      logger.info(`Interrogation API DHL Express (${baseUrl}/rates) pour ${params.destCountryCode}, poids: ${params.weight}kg`);
      
      const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const now = new Date();
      const plannedShippingDate = now.toISOString().split('T')[0];

      const requestBody = {
        customerDetails: {
          shipperDetails: {
            postalCode: '00225',
            cityName: 'Abidjan',
            countryCode: 'CI'
          },
          receiverDetails: {
            postalCode: params.destPostalCode || '75001',
            cityName: params.destCity || 'Destination',
            countryCode: params.destCountryCode || 'FR'
          }
        },
        accounts: [
          {
            typeCode: 'shipper',
            number: accountNumber
          }
        ],
        plannedShippingDateAndTime: `${plannedShippingDate}T10:00:00GMT+00:00`,
        unitOfMeasurement: 'metric',
        isCustomsDeclarable: !params.isDoc,
        monetaryAmount: [
          {
            typeCode: 'declaredValue',
            value: params.isDoc ? 10 : 50,
            currency: 'XOF'
          }
        ],
        packages: [
          {
            weight: params.weight,
            dimensions: {
              length: params.dimensions?.l || 20,
              width: params.dimensions?.w || 20,
              height: params.dimensions?.h || 10
            }
          }
        ]
      };

      const response = await fetch(`${baseUrl}/rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        // DHL renvoie plusieurs produits (EXPRESS 12:00, EXPRESS EASY...) : on retient
        // EXPRESS WORLDWIDE (D = document, P = colis), le service standard du guichet.
        const products = data.products || [];
        const wanted = params.isDoc ? ['D', 'P'] : ['P', 'D'];
        const product = wanted.map(c => products.find(p => p.productCode === c)).find(Boolean) || products[0];
        // BILLC = montant facturé au compte (en XOF), BASEC = devise de base DHL (EUR)
        const totalPriceObj = product && (product.totalPrice || []).find(t => t.currencyType === 'BILLC');
        if (totalPriceObj) {
          const montantTotalXOF = totalPriceObj.price;

          // Extraire la décomposition des prix si disponible
          const breakdown = {
            baseRate: 0,
            fuelSurcharge: 0,
            remoteAreaSurcharge: 0,
            elevatedRiskSurcharge: 0
          };

          const detail = (product.detailedPriceBreakdown || []).find(b => b.currencyType === 'BILLC');
          (detail?.breakdown || []).forEach(item => {
            if (!item.serviceCode) breakdown.baseRate += item.price; // ligne produit (tarif de base)
            else if (item.serviceCode === 'FF') breakdown.fuelSurcharge += item.price;
            else if (['OO', 'OB'].includes(item.serviceCode)) breakdown.remoteAreaSurcharge += item.price;
            else if (['CR', 'CA'].includes(item.serviceCode)) breakdown.elevatedRiskSurcharge += item.price;
          });

          logger.info(`Réponse API DHL obtenue avec succès : ${product.productName} ${montantTotalXOF} XOF`);
          return {
            montant_jour_dhl: Math.round(montantTotalXOF),
            breakdown,
            isLiveApi: true
          };
        }
      } else {
        const errText = await response.text();
        logger.warn(`L'API DHL a répondu avec l'état ${response.status}: ${errText}. Utilisation du fallback.`);
      }
    } catch (err) {
      logger.error('Erreur lors de la requête API DHL Live:', err.message);
    }
  }

  // ── MODE FALLBACK / SIMULATION CERTIFIÉE DHL ──
  // Si les clés ne sont pas configurées ou si la requête échoue, 
  // on calcule le montant avec l'index de surtaxe carburant et frais de zone.
  return calculateSimulatedDhlRate(params);
}

/**
 * Calculateur de simulation des tarifs du jour DHL Express avec surtaxes dynamiques.
 */
function calculateSimulatedDhlRate(params) {
  const weight = parseFloat(params.weight) || 0.5;
  const isDoc = !!params.isDoc;
  
  // Grille de base estimée DHL Express Afrique de l'Ouest -> Inter (XOF)
  let basePrice = isDoc ? 18000 + (weight * 6000) : 25000 + (weight * 12000);
  
  // Surtaxe Carburant DHL (index moyen actuel ~ 28.5%)
  const fuelSurchargePercent = 0.285;
  const fuelSurcharge = Math.round(basePrice * fuelSurchargePercent);

  // Surtaxe Zone Éloignée (Remote Area)
  let remoteAreaSurcharge = 0;
  if (params.isRemoteArea) {
    remoteAreaSurcharge = Math.max(16500, Math.round(weight * 350)); // Tarif min 16 500 XOF
  }

  // Surtaxe Risque Pays (Elevated Risk)
  let elevatedRiskSurcharge = 0;
  const highRiskCountries = ['AF', 'SY', 'YE', 'SO', 'LY', 'CD', 'SD'];
  if (highRiskCountries.includes(params.destCountryCode)) {
    elevatedRiskSurcharge = 22000;
  }

  const montant_jour_dhl = Math.round(basePrice + fuelSurcharge + remoteAreaSurcharge + elevatedRiskSurcharge);

  return {
    montant_jour_dhl,
    breakdown: {
      baseRate: Math.round(basePrice),
      fuelSurcharge,
      remoteAreaSurcharge,
      elevatedRiskSurcharge
    },
    isLiveApi: false
  };
}

module.exports = {
  fetchDhlLiveRate,
  calculateSimulatedDhlRate
};

const fs = require('fs');
const { PDFParse } = require('pdf-parse');

/**
 * Extrait les informations clés d'un reçu DHL au format PDF.
 * @param {string} filePath - Chemin absolu vers le fichier PDF
 * @returns {Promise<Object>} - Les données extraites
 */
async function parseDhlReceipt(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    const text = data.text;
    await parser.destroy();

    const extracted = {
      waybill: '',
      exp_nom: '',
      exp_tel: '',
      exp_adresse: '',
      dest_nom: '',
      dest_tel: '',
      dest_adresse: '',
      dest_pays: '',
      poids_reel: '',
      montant_jour_dhl: '',
      type_envoi: 'DOCUMENT',
      valeur_declaree: '—'
    };

    // 1. Waybill (N° de bordereau) : recherche spécifique puis générale
    const waybillMatch = text.match(/N° de bordereau:\s*(\d+)/i) || text.match(/\b\d{10}\b/);
    if (waybillMatch) {
      extracted.waybill = waybillMatch[1] || waybillMatch[0];
    }

    // 2. Montant DHL (Tarif estimé ou général)
    const tarifEstimeMatch = text.match(/Tarif estimé:\s*([\d,.\s]+)/i);
    if (tarifEstimeMatch) {
      const cleanMontant = tarifEstimeMatch[1].replace(/[,\.\s]/g, '');
      extracted.montant_jour_dhl = parseFloat(cleanMontant);
    } else {
      const montantMatch = text.match(/([\d,.\s]+)\s*(?:XOF|FCFA|CFA)/i);
      if (montantMatch) {
        const cleanMontant = montantMatch[1].replace(/[,\.\s]/g, '');
        extracted.montant_jour_dhl = parseFloat(cleanMontant);
      }
    }

    // 3. Poids (Poids total, volumétrique, facturable)
    // Dans le reçu DHL, les clés et les valeurs sont séparées (format 2 colonnes aplati)
    // Ex: Poids total ... Poids vol ... puis plus loin 0.50kg ... 0.39kg
    const kgMatches = [...text.matchAll(/(\d+[\.,]\d+)\s*kg/gi)];
    if (kgMatches.length > 0) {
      // Le premier est toujours le poids total
      extracted.poids_reel = parseFloat(kgMatches[0][1].replace(',', '.'));
      
      // S'il y a un 2ème poids et que le mot "volumétrique" est présent, c'est le poids volumétrique
      if (kgMatches.length >= 2 && text.toLowerCase().includes('volumétrique')) {
        extracted.poids_vol = parseFloat(kgMatches[1][1].replace(',', '.'));
      }
    }

    // 4. Type d'envoi & Description du contenu
    const descMatch = text.match(/Description du contenu:\s*([\s\S]+?)(?:\d{4}|\n\n|$)/i);
    const contentDesc = descMatch ? descMatch[1].trim() : '';
    if (contentDesc) {
      if (contentDesc.toLowerCase().includes('document') || text.toLowerCase().includes('card envelope')) {
        extracted.type_envoi = 'DOCUMENT';
      } else {
        extracted.type_envoi = 'COLIS';
      }
    }

    // 5. Valeur Déclarée
    const valMatch = text.match(/Valeur déclarée:\s*([^\n]+)/i);
    if (valMatch && valMatch[1].trim() && !valMatch[1].toLowerCase().includes('droits')) {
      extracted.valeur_declaree = valMatch[1].trim();
    }

    // 6. Extraction structurée Expéditeur / Destinataire
    // Les blocs se trouvent entre "Origine de l'envoi" et "Détails de l'envoi"
    const lignes = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const startIdx = lignes.findIndex(l => l.includes("Origine de l'envoi"));
    const endIdx = lignes.findIndex(l => l.includes("Détails de l'envoi"));

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const contactLines = lignes.slice(startIdx + 1, endIdx);

      // On repère la séparation entre Origine et Destination par la présence du premier tél ou email de l'expéditeur
      const firstPhoneIdx = contactLines.findIndex(l => /^\+?\d{8,}/.test(l.replace(/[\s-]/g, '')));
      const firstEmailIdx = contactLines.findIndex(l => l.includes('@'));

      let boundaryIdx = -1;
      if (firstPhoneIdx !== -1 && firstEmailIdx !== -1) {
        boundaryIdx = Math.max(firstPhoneIdx, firstEmailIdx);
      } else if (firstPhoneIdx !== -1) {
        boundaryIdx = firstPhoneIdx;
      } else if (firstEmailIdx !== -1) {
        boundaryIdx = firstEmailIdx;
      }

      if (boundaryIdx !== -1 && boundaryIdx < contactLines.length - 1) {
        const origineLines = contactLines.slice(0, boundaryIdx + 1);
        const destinationLines = contactLines.slice(boundaryIdx + 1);

        // Helper pour nettoyer et extraire les informations d'un bloc de contact
        const parseContactBlock = (blockLines) => {
          // Extraire l'email si présent
          const emailIdx = blockLines.findIndex(l => l.includes('@'));
          let email = '';
          if (emailIdx !== -1) {
            email = blockLines[emailIdx];
            blockLines.splice(emailIdx, 1);
          }

          // Extraire le téléphone si présent
          const phoneIdx = blockLines.findIndex(l => /^\+?\d{8,}/.test(l.replace(/[\s-]/g, '')));
          let phone = '';
          if (phoneIdx !== -1) {
            phone = blockLines[phoneIdx];
            blockLines.splice(phoneIdx, 1);
          }

          // Nettoyer les noms en enlevant d'éventuels doublons consécutifs (ex: DHL répète souvent le nom)
          let nom = '';
          if (blockLines.length > 0) {
            nom = blockLines[0];
            if (blockLines.length > 1 && (blockLines[1].toLowerCase() === blockLines[0].toLowerCase() || blockLines[1].toLowerCase().includes(blockLines[0].toLowerCase()))) {
              blockLines.splice(1, 1);
            }
            blockLines.splice(0, 1);
          }

          // Le reste constitue l'adresse et le pays
          let country = '';
          if (blockLines.length > 0) {
            country = blockLines[blockLines.length - 1];
            blockLines.splice(blockLines.length - 1, 1);
          }

          const adresse = blockLines.join(', ');
          return { nom, tel: phone, email, adresse, pays: country };
        };

        const origResult = parseContactBlock(origineLines);
        const destResult = parseContactBlock(destinationLines);

        extracted.exp_nom = origResult.nom;
        extracted.exp_tel = origResult.tel;
        extracted.exp_adresse = origResult.adresse;

        extracted.dest_nom = destResult.nom;
        extracted.dest_tel = destResult.tel;
        // Dans le cas de la destination, si la dernière ligne de l'adresse était en fait le pays, on l'a séparé
        extracted.dest_adresse = destResult.adresse;
        extracted.dest_pays = translateCountry(destResult.pays);
      }
    }

    return { ok: true, data: extracted };
  } catch (error) {
    console.error('Erreur lecture PDF :', error);
    return { ok: false, error: 'Impossible de lire ce PDF. Veuillez vérifier le fichier.' };
  }
}

const COUNTRY_TRANSLATION_MAP = {
  "afghanistan": "Afghanistan",
  "albania": "Albanie",
  "algeria": "Algérie",
  "american samoa": "Samoa américaines",
  "andorra": "Andorre",
  "angola": "Angola",
  "anguilla": "Anguilla",
  "antigua": "Antigua",
  "argentina": "Argentine",
  "armenia": "Arménie",
  "aruba": "Aruba",
  "australia": "Australie",
  "austria": "Autriche",
  "azerbaijan": "Azerbaïdjan",
  "bahamas": "Bahamas",
  "bahrain": "Bahreïn",
  "bangladesh": "Bangladesh",
  "barbados": "Barbade",
  "belarus": "Biélorussie",
  "belgium": "Belgique",
  "belize": "Belize",
  "benin": "Bénin",
  "bermuda": "Bermudes",
  "bhutan": "Bhoutan",
  "bolivia": "Bolivie",
  "bonaire": "Bonaire",
  "bosnia & herzegovina": "Bosnie-Herzégovine",
  "botswana": "Botswana",
  "brazil": "Brésil",
  "brunei": "Brunei",
  "bulgaria": "Bulgarie",
  "burkina faso": "Burkina Faso",
  "burundi": "Burundi",
  "cambodia": "Cambodge",
  "cameroon": "Cameroun",
  "canada": "Canada",
  "canary islands, the": "Îles Canaries",
  "cape verde": "Cap-Vert",
  "cayman islands": "Îles Caïmans",
  "central african rep": "République centrafricaine",
  "chad": "Tchad",
  "chile": "Chili",
  "china": "Chine",
  "colombia": "Colombie",
  "comoros": "Comores",
  "congo": "Congo",
  "congo, dpr": "République Démocratique du Congo",
  "cook islands": "Îles Cook",
  "costa rica": "Costa Rica",
  "cote d ivoire": "Côte d'Ivoire",
  "croatia": "Croatie",
  "cuba": "Cuba",
  "curacao": "Curaçao",
  "cyprus": "Chypre",
  "czech rep., the": "République tchèque",
  "denmark": "Danemark",
  "djibouti": "Djibouti",
  "dominica": "Dominique",
  "dominican rep.": "République dominicaine",
  "ecuador": "Équateur",
  "egypt": "Égypte",
  "el salvador": "Le Salvador",
  "eritrea": "Érythrée",
  "estonia": "Estonie",
  "eswatini": "Eswatini",
  "ethiopia": "Éthiopie",
  "falkland islands": "Îles Malouines",
  "faroe islands": "Îles Féroé",
  "fiji": "Fidji",
  "finland": "Finlande",
  "france": "France",
  "french guyana": "Guyane française",
  "gabon": "Gabon",
  "gambia": "Gambie",
  "georgia": "Géorgie",
  "germany": "Allemagne",
  "ghana": "Ghana",
  "gibraltar": "Gibraltar",
  "greece": "Grèce",
  "greenland": "Groenland",
  "grenada": "Grenade",
  "guadeloupe": "Guadeloupe",
  "guam": "Guam",
  "guatemala": "Guatemala",
  "guernsey": "Guernesey",
  "guinea rep.": "République de Guinée",
  "guinea-bissau": "Guinée-Bissau",
  "guinea-equatorial": "Guinée équatoriale",
  "guyana (british)": "Guyana",
  "haiti": "Haïti",
  "honduras": "Honduras",
  "hong kong sar china": "Hong Kong RAS Chine",
  "hungary": "Hongrie",
  "iceland": "Islande",
  "india": "Inde",
  "indonesia": "Indonésie",
  "iran": "Iran",
  "iraq": "Irak",
  "ireland, rep. of": "Irlande",
  "israel": "Israël",
  "italy": "Italie",
  "jamaica": "Jamaïque",
  "japan": "Japon",
  "jersey": "Jersey",
  "jordan": "Jordanie",
  "kazakhstan": "Kazakhstan",
  "kenya": "Kenya",
  "kiribati": "Kiribati",
  "korea, republic of (south k.)": "Corée du Sud",
  "korea, rep. of": "Corée du Sud",
  "korea, d.p.r of": "Corée du Nord",
  "kosovo": "Kosovo",
  "kuwait": "Koweït",
  "kyrgyzstan": "Kirghizistan",
  "laos": "Laos",
  "latvia": "Lettonie",
  "lebanon": "Liban",
  "lesotho": "Lesotho",
  "liberia": "Liberia",
  "libya": "Libye",
  "liechtenstein": "Liechtenstein",
  "lithuania": "Lituanie",
  "luxembourg": "Luxembourg",
  "macau sar china": "Macao RAS Chine",
  "madagascar": "Madagascar",
  "malawi": "Malawi",
  "malaysia": "Malaisie",
  "maldives": "Maldives",
  "mali": "Mali",
  "malta": "Malte",
  "mariana islands": "Îles Mariannes",
  "marshall islands": "Îles Marshall",
  "martinique": "Martinique",
  "mauritania": "Mauritanie",
  "mauritius": "Île Maurice",
  "mayotte": "Mayotte",
  "mexico": "Mexique",
  "micronesia": "Micronésie",
  "moldova, rep. of": "Moldavie",
  "monaco": "Monaco",
  "mongolia": "Mongolie",
  "montenegro, rep of": "Monténégro",
  "montserrat": "Montserrat",
  "morocco": "Maroc",
  "mozambique": "Mozambique",
  "myanmar": "Myanmar",
  "namibia": "Namibie",
  "nauru, rep. of": "Nauru",
  "nepal": "Népal",
  "netherlands, the": "Pays-Bas",
  "nevis": "Niévès",
  "new caledonia": "Nouvelle-Calédonie",
  "new zealand": "Nouvelle-Zélande",
  "nicaragua": "Nicaragua",
  "niger": "Niger",
  "nigeria": "Nigeria",
  "niue": "Niue",
  "north macedonia": "Macédoine du Nord",
  "norway": "Norvège",
  "oman": "Oman",
  "pakistan": "Pakistan",
  "palau": "Palaos",
  "panama": "Panama",
  "papua new guinea": "Papouasie-Nouvelle-Guinée",
  "paraguay": "Paraguay",
  "peru": "Pérou",
  "philippines, the": "Philippines",
  "poland": "Pologne",
  "portugal": "Portugal",
  "puerto rico": "Porto Rico",
  "qatar": "Qatar",
  "reunion, island of": "La Réunion",
  "romania": "Roumanie",
  "russian federation": "Fédération de Russie",
  "rwanda": "Rwanda",
  "saint helena": "Sainte-Hélène",
  "samoa": "Samoa",
  "san marino": "Saint-Marin",
  "sao tome and principe": "Sao Tomé-et-Principe",
  "saudi arabia": "Arabie Saoudite",
  "senegal": "Sénégal",
  "serbia, rep. of": "Serbie",
  "seychelles": "Seychelles",
  "sierra leone": "Sierra Leone",
  "singapore": "Singapour",
  "slovakia": "Slovaquie",
  "slovenia": "Slovénie",
  "solomon islands": "Îles Salomon",
  "somalia": "Somalie",
  "somaliland, rep of": "Somaliland",
  "south africa": "Afrique du Sud",
  "south sudan": "Soudan du Sud",
  "spain": "Espagne",
  "sri lanka": "Sri Lanka",
  "st. barthelemy": "Saint-Barthélemy",
  "st. eustatius": "Saint-Eustache",
  "st. kitts": "Saint-Kitts-et-Nevis",
  "st. lucia": "Sainte-Lucie",
  "st. maarten": "Saint-Martin",
  "st. vincent": "Saint-Vincent-et-les-Grenadines",
  "sudan": "Soudan",
  "suriname": "Suriname",
  "sweden": "Suède",
  "switzerland": "Suisse",
  "syria": "Syrie",
  "tahiti": "Tahiti",
  "taiwan": "Taïwan",
  "tajikistan": "Tadjikistan",
  "tanzania": "Tanzanie",
  "thailand": "Thaïlande",
  "timor-leste": "Timor oriental",
  "togo": "Togo",
  "tonga": "Tonga",
  "trinidad and tobago": "Trinité-et-Tobago",
  "tunisia": "Tunisie",
  "turkey": "Turquie",
  "turkmenistan": "Turkménistan",
  "turks & caicos": "Îles Turques-et-Caïques",
  "tuvalu": "Tuvalu",
  "usa": "États-Unis",
  "uganda": "Ouganda",
  "ukraine": "Ukraine",
  "united arab emirates": "Émirats arabes unis",
  "united kingdom": "Royaume-Uni",
  "uruguay": "Uruguay",
  "uzbekistan": "Ouzbékistan",
  "vanuatu": "Vanuatu",
  "vatican city": "Vatican",
  "venezuela": "Venezuela",
  "vietnam": "Vietnam",
  "virgin islands-british": "Îles Vierges britanniques",
  "virgin islands-us": "Îles Vierges des États-Unis",
  "yemen, rep. of": "Yémen",
  "zambia": "Zambie",
  "zimbabwe": "Zimbabwe"
};

function translateCountry(enName) {
  if (!enName) return '';
  const lower = enName.toLowerCase().trim();
  return COUNTRY_TRANSLATION_MAP[lower] || enName;
}

module.exports = { parseDhlReceipt };

/**
 * backend/services/surtaxeService.js
 * Grilles tarifaires et calcul des surtaxes de La Poste CI (BUELT).
 */

// ── TABLE DES ZONES PAR PAYS (229 pays en Français) ──
const PAYS_LIST = [
  { nom: "Afghanistan", code: "AF", zone: 7 },
  { nom: "Albanie", code: "AL", zone: 4 },
  { nom: "Algérie", code: "DZ", zone: 3 },
  { nom: "Samoa américaines", code: "AS", zone: 8 },
  { nom: "Andorre", code: "AD", zone: 4 },
  { nom: "Angola", code: "AO", zone: 3 },
  { nom: "Anguilla", code: "AI", zone: 8 },
  { nom: "Antigua", code: "AG", zone: 8 },
  { nom: "Argentine", code: "AR", zone: 8 },
  { nom: "Arménie", code: "AM", zone: 4 },
  { nom: "Aruba", code: "AW", zone: 8 },
  { nom: "Australie", code: "AU", zone: 8 },
  { nom: "Autriche", code: "AT", zone: 4 },
  { nom: "Azerbaïdjan", code: "AZ", zone: 4 },
  { nom: "Bahamas", code: "BS", zone: 8 },
  { nom: "Bahreïn", code: "BH", zone: 7 },
  { nom: "Bangladesh", code: "BD", zone: 7 },
  { nom: "Barbade", code: "BB", zone: 8 },
  { nom: "Biélorussie", code: "BY", zone: 4 },
  { nom: "Belgique", code: "BE", zone: 4 },
  { nom: "Belize", code: "BZ", zone: 8 },
  { nom: "Bénin", code: "BJ", zone: 1 },
  { nom: "Bermudes", code: "BM", zone: 8 },
  { nom: "Bhoutan", code: "BT", zone: 7 },
  { nom: "Bolivie", code: "BO", zone: 8 },
  { nom: "Bonaire", code: "XB", zone: 8 },
  { nom: "Bosnie-Herzégovine", code: "BA", zone: 4 },
  { nom: "Botswana", code: "BW", zone: 3 },
  { nom: "Brésil", code: "BR", zone: 8 },
  { nom: "Brunei", code: "BN", zone: 7 },
  { nom: "Bulgarie", code: "BG", zone: 4 },
  { nom: "Burkina Faso", code: "BF", zone: 1 },
  { nom: "Burundi", code: "BI", zone: 3 },
  { nom: "Cambodge", code: "KH", zone: 7 },
  { nom: "Cameroun", code: "CM", zone: 1 },
  { nom: "Canada", code: "CA", zone: 5 },
  { nom: "Îles Canaries", code: "IC", zone: 4 },
  { nom: "Cap-Vert", code: "CV", zone: 1 },
  { nom: "Îles Caïmans", code: "KY", zone: 8 },
  { nom: "République centrafricaine", code: "CF", zone: 1 },
  { nom: "Tchad", code: "TD", zone: 3 },
  { nom: "Chili", code: "CL", zone: 8 },
  { nom: "Chine", code: "CN", zone: 6 },
  { nom: "Colombie", code: "CO", zone: 8 },
  { nom: "Comores", code: "KM", zone: 3 },
  { nom: "Congo", code: "CG", zone: 3 },
  { nom: "République Démocratique du Congo", code: "CD", zone: 3 },
  { nom: "Îles Cook", code: "CK", zone: 8 },
  { nom: "Costa Rica", code: "CR", zone: 8 },
  { nom: "Croatie", code: "HR", zone: 4 },
  { nom: "Cuba", code: "CU", zone: 8 },
  { nom: "Curaçao", code: "XC", zone: 8 },
  { nom: "Chypre", code: "CY", zone: 4 },
  { nom: "République tchèque", code: "CZ", zone: 4 },
  { nom: "Danemark", code: "DK", zone: 4 },
  { nom: "Djibouti", code: "DJ", zone: 3 },
  { nom: "Dominique", code: "DM", zone: 8 },
  { nom: "République dominicaine", code: "DO", zone: 8 },
  { nom: "Équateur", code: "EC", zone: 8 },
  { nom: "Égypte", code: "EG", zone: 3 },
  { nom: "Le Salvador", code: "SV", zone: 8 },
  { nom: "Érythrée", code: "ER", zone: 3 },
  { nom: "Estonie", code: "EE", zone: 4 },
  { nom: "Eswatini", code: "SZ", zone: 3 },
  { nom: "Éthiopie", code: "ET", zone: 3 },
  { nom: "Îles Malouines", code: "FK", zone: 8 },
  { nom: "Îles Féroé", code: "FO", zone: 8 },
  { nom: "Fidji", code: "FJ", zone: 8 },
  { nom: "Finlande", code: "FI", zone: 4 },
  { nom: "France", code: "FR", zone: 2 },
  { nom: "Guyane française", code: "GF", zone: 8 },
  { nom: "Gabon", code: "GA", zone: 1 },
  { nom: "Gambie", code: "GM", zone: 1 },
  { nom: "Géorgie", code: "GE", zone: 4 },
  { nom: "Allemagne", code: "DE", zone: 4 },
  { nom: "Ghana", code: "GH", zone: 1 },
  { nom: "Gibraltar", code: "GI", zone: 4 },
  { nom: "Grèce", code: "GR", zone: 4 },
  { nom: "Groenland", code: "GL", zone: 8 },
  { nom: "Grenade", code: "GD", zone: 8 },
  { nom: "Guadeloupe", code: "GP", zone: 8 },
  { nom: "Guam", code: "GU", zone: 8 },
  { nom: "Guatemala", code: "GT", zone: 8 },
  { nom: "Guernesey", code: "GG", zone: 4 },
  { nom: "République de Guinée", code: "GN", zone: 1 },
  { nom: "Guinée-Bissau", code: "GW", zone: 1 },
  { nom: "Guinée équatoriale", code: "GQ", zone: 1 },
  { nom: "Guyana", code: "GY", zone: 8 },
  { nom: "Haïti", code: "HT", zone: 8 },
  { nom: "Honduras", code: "HN", zone: 8 },
  { nom: "Hong Kong RAS Chine", code: "HK", zone: 6 },
  { nom: "Hongrie", code: "HU", zone: 4 },
  { nom: "Islande", code: "IS", zone: 4 },
  { nom: "Inde", code: "IN", zone: 7 },
  { nom: "Indonésie", code: "ID", zone: 7 },
  { nom: "Iran", code: "IR", zone: 7 },
  { nom: "Irak", code: "IQ", zone: 7 },
  { nom: "Irlande", code: "IE", zone: 4 },
  { nom: "Israël", code: "IL", zone: 4 },
  { nom: "Italie", code: "IT", zone: 4 },
  { nom: "Jamaïque", code: "JM", zone: 8 },
  { nom: "Japon", code: "JP", zone: 6 },
  { nom: "Jersey", code: "JE", zone: 4 },
  { nom: "Jordanie", code: "JO", zone: 7 },
  { nom: "Kazakhstan", code: "KZ", zone: 4 },
  { nom: "Kenya", code: "KE", zone: 3 },
  { nom: "Kiribati", code: "KI", zone: 8 },
  { nom: "Corée du Nord", code: "KP", zone: 7 },
  { nom: "Corée du Sud", code: "KR", zone: 7 },
  { nom: "Kosovo", code: "KV", zone: 8 },
  { nom: "Koweït", code: "KW", zone: 7 },
  { nom: "Kirghizistan", code: "KG", zone: 4 },
  { nom: "Laos", code: "LA", zone: 7 },
  { nom: "Lettonie", code: "LV", zone: 4 },
  { nom: "Liban", code: "LB", zone: 7 },
  { nom: "Lesotho", code: "LS", zone: 3 },
  { nom: "Liberia", code: "LR", zone: 1 },
  { nom: "Libye", code: "LY", zone: 3 },
  { nom: "Liechtenstein", code: "LI", zone: 4 },
  { nom: "Lituanie", code: "LT", zone: 4 },
  { nom: "Luxembourg", code: "LU", zone: 4 },
  { nom: "Macao RAS Chine", code: "MO", zone: 7 },
  { nom: "Madagascar", code: "MG", zone: 3 },
  { nom: "Malawi", code: "MW", zone: 3 },
  { nom: "Malaisie", code: "MY", zone: 7 },
  { nom: "Maldives", code: "MV", zone: 7 },
  { nom: "Mali", code: "ML", zone: 1 },
  { nom: "Malte", code: "MT", zone: 4 },
  { nom: "Îles Mariannes", code: "MP", zone: 8 },
  { nom: "Îles Marshall", code: "MH", zone: 8 },
  { nom: "Martinique", code: "MQ", zone: 8 },
  { nom: "Mauritanie", code: "MR", zone: 1 },
  { nom: "Île Maurice", code: "MU", zone: 3 },
  { nom: "Mayotte", code: "YT", zone: 8 },
  { nom: "Mexique", code: "MX", zone: 5 },
  { nom: "Micronésie", code: "FM", zone: 8 },
  { nom: "Moldavie", code: "MD", zone: 4 },
  { nom: "Monaco", code: "MC", zone: 2 },
  { nom: "Mongolie", code: "MN", zone: 7 },
  { nom: "Monténégro", code: "ME", zone: 4 },
  { nom: "Montserrat", code: "MS", zone: 8 },
  { nom: "Maroc", code: "MA", zone: 3 },
  { nom: "Mozambique", code: "MZ", zone: 3 },
  { nom: "Myanmar", code: "MM", zone: 7 },
  { nom: "Namibie", code: "NA", zone: 3 },
  { nom: "Nauru", code: "NR", zone: 8 },
  { nom: "Népal", code: "NP", zone: 7 },
  { nom: "Pays-Bas", code: "NL", zone: 4 },
  { nom: "Niévès", code: "XN", zone: 8 },
  { nom: "Nouvelle-Calédonie", code: "NC", zone: 8 },
  { nom: "Nouvelle-Zélande", code: "NZ", zone: 8 },
  { nom: "Nicaragua", code: "NI", zone: 8 },
  { nom: "Niger", code: "NE", zone: 1 },
  { nom: "Nigeria", code: "NG", zone: 1 },
  { nom: "Niue", code: "NU", zone: 8 },
  { nom: "Macédoine du Nord", code: "MK", zone: 4 },
  { nom: "Norvège", code: "NO", zone: 4 },
  { nom: "Oman", code: "OM", zone: 7 },
  { nom: "Pakistan", code: "PK", zone: 7 },
  { nom: "Palaos", code: "PW", zone: 8 },
  { nom: "Panama", code: "PA", zone: 8 },
  { nom: "Papouasie-Nouvelle-Guinée", code: "PG", zone: 8 },
  { nom: "Paraguay", code: "PY", zone: 8 },
  { nom: "Pérou", code: "PE", zone: 8 },
  { nom: "Philippines", code: "PH", zone: 7 },
  { nom: "Pologne", code: "PL", zone: 4 },
  { nom: "Portugal", code: "PT", zone: 4 },
  { nom: "Porto Rico", code: "PR", zone: 8 },
  { nom: "Qatar", code: "QA", zone: 7 },
  { nom: "La Réunion", code: "RE", zone: 8 },
  { nom: "Roumanie", code: "RO", zone: 4 },
  { nom: "Fédération de Russie", code: "RU", zone: 8 },
  { nom: "Rwanda", code: "RW", zone: 3 },
  { nom: "Sainte-Hélène", code: "SH", zone: 3 },
  { nom: "Samoa", code: "WS", zone: 8 },
  { nom: "Saint-Marin", code: "SM", zone: 4 },
  { nom: "Sao Tomé-et-Principe", code: "ST", zone: 8 },
  { nom: "Arabie Saoudite", code: "SA", zone: 7 },
  { nom: "Sénégal", code: "SN", zone: 1 },
  { nom: "Serbie", code: "RS", zone: 4 },
  { nom: "Seychelles", code: "SC", zone: 8 },
  { nom: "Sierra Leone", code: "SL", zone: 1 },
  { nom: "Singapour", code: "SG", zone: 7 },
  { nom: "Slovaquie", code: "SK", zone: 4 },
  { nom: "Slovénie", code: "SI", zone: 4 },
  { nom: "Îles Salomon", code: "SB", zone: 8 },
  { nom: "Somalie", code: "SO", zone: 3 },
  { nom: "Somaliland", code: "XS", zone: 3 },
  { nom: "Afrique du Sud", code: "ZA", zone: 3 },
  { nom: "Soudan du Sud", code: "SS", zone: 3 },
  { nom: "Espagne", code: "ES", zone: 4 },
  { nom: "Sri Lanka", code: "LK", zone: 7 },
  { nom: "Saint-Barthélemy", code: "XY", zone: 8 },
  { nom: "Saint-Eustache", code: "XE", zone: 8 },
  { nom: "Saint-Kitts-et-Nevis", code: "KN", zone: 8 },
  { nom: "Sainte-Lucie", code: "LC", zone: 8 },
  { nom: "Saint-Martin", code: "XM", zone: 8 },
  { nom: "Saint-Vincent-et-les-Grenadines", code: "VC", zone: 8 },
  { nom: "Soudan", code: "SD", zone: 3 },
  { nom: "Suriname", code: "SR", zone: 8 },
  { nom: "Suède", code: "SE", zone: 4 },
  { nom: "Suisse", code: "CH", zone: 4 },
  { nom: "Syrie", code: "SY", zone: 7 },
  { nom: "Tahiti", code: "PF", zone: 8 },
  { nom: "Taïwan", code: "TW", zone: 7 },
  { nom: "Tadjikistan", code: "TJ", zone: 4 },
  { nom: "Tanzanie", code: "TZ", zone: 3 },
  { nom: "Thaïlande", code: "TH", zone: 7 },
  { nom: "Timor oriental", code: "TL", zone: 8 },
  { nom: "Togo", code: "TG", zone: 1 },
  { nom: "Tonga", code: "TO", zone: 8 },
  { nom: "Trinité-et-Tobago", code: "TT", zone: 8 },
  { nom: "Tunisie", code: "TN", zone: 3 },
  { nom: "Turquie", code: "TR", zone: 4 },
  { nom: "Turkménistan", code: "TM", zone: 4 },
  { nom: "Îles Turques-et-Caïques", code: "TC", zone: 8 },
  { nom: "Tuvalu", code: "TV", zone: 8 },
  { nom: "États-Unis", code: "US", zone: 5 },
  { nom: "Ouganda", code: "UG", zone: 3 },
  { nom: "Ukraine", code: "UA", zone: 4 },
  { nom: "Émirats arabes unis", code: "AE", zone: 7 },
  { nom: "Royaume-Uni", code: "GB", zone: 4 },
  { nom: "Uruguay", code: "UY", zone: 8 },
  { nom: "Ouzbékistan", code: "UZ", zone: 4 },
  { nom: "Vanuatu", code: "VU", zone: 8 },
  { nom: "Vatican", code: "VA", zone: 4 },
  { nom: "Venezuela", code: "VE", zone: 8 },
  { nom: "Vietnam", code: "VN", zone: 7 },
  { nom: "Îles Vierges britanniques", code: "VG", zone: 8 },
  { nom: "Îles Vierges des États-Unis", code: "VI", zone: 8 },
  { nom: "Yémen", code: "YE", zone: 7 },
  { nom: "Zambie", code: "ZM", zone: 3 },
  { nom: "Zimbabwe", code: "ZW", zone: 3 }
];

function obtenirZone(pays) {
  const p = PAYS_LIST.find(x => x.nom === pays);
  return p ? p.zone : 4;
}

// ── GRILLES TARIFAIRES OFFICIELLES ──
const GUICHET_DOC_2KG = {
  0.5: [0, 42000, 42000, 43000, 43000, 45000, 45000, 48000, 49000],
  1.0: [0, 53000, 57000, 59000, 59000, 63000, 64000, 68000, 69000],
  1.5: [0, 65000, 68000, 74000, 74000, 81000, 83000, 87000, 88000],
  2.0: [0, 77000, 84000, 88000, 89000, 98000, 101000, 106000, 107000]
};

const GUICHET_COLIS = {
  0.5:  [0, 42500, 43000, 44000, 44000, 46000, 46000, 49000, 50000],
  1.0:  [0, 54000, 56000, 60000, 60000, 64000, 65000, 69000, 70000],
  1.5:  [0, 66000, 69000, 75000, 75000, 81000, 84000, 88000, 89000],
  2.0:  [0, 78000, 81000, 89000, 90000, 99000, 102000, 107000, 108000],
  2.5:  [0, 89000, 94000, 104000, 105000, 117000, 120000, 126000, 127000],
  3.0:  [0, 99000, 104000, 115000, 117000, 130000, 135000, 141000, 143000],
  3.5:  [0, 108000, 114000, 127000, 129000, 144000, 149000, 156000, 159000],
  4.0:  [0, 118000, 124000, 138000, 141000, 158000, 163000, 171000, 175000],
  4.5:  [0, 128000, 134000, 150000, 153000, 172000, 177000, 186000, 191000],
  5.0:  [0, 137000, 144000, 161000, 165000, 186000, 192000, 202000, 207000],
  5.5:  [0, 145000, 152000, 171000, 175000, 197000, 204000, 214000, 221000],
  6.0:  [0, 152000, 160000, 180000, 185000, 209000, 216000, 226000, 235000],
  6.5:  [0, 159000, 168000, 189000, 194000, 220000, 228000, 238000, 249000],
  7.0:  [0, 167000, 176000, 198000, 204000, 232000, 240000, 250000, 263000],
  7.5:  [0, 174000, 184000, 208000, 214000, 244000, 252000, 262000, 277000],
  8.0:  [0, 182000, 192000, 217000, 223000, 255000, 264000, 274000, 291000],
  8.5:  [0, 189000, 208000, 226000, 233000, 267000, 276000, 286000, 304000],
  9.0:  [0, 196000, 213000, 235000, 243000, 278000, 288000, 298000, 318000],
  9.5:  [0, 204000, 220000, 245000, 253000, 290000, 300000, 310000, 332000],
  10.0: [0, 213000, 231000, 254000, 262000, 303000, 312000, 322000, 346000],
  11.0: [0, 228000, 242000, 270000, 279000, 322000, 333000, 344000, 372000],
  12.0: [0, 238000, 254000, 285000, 296000, 342000, 355000, 366000, 398000],
  13.0: [0, 250000, 265000, 301000, 312000, 363000, 376000, 389000, 424000],
  14.0: [0, 263000, 279000, 317000, 329000, 383000, 397000, 411000, 450000],
  15.0: [0, 276000, 292000, 333000, 346000, 403000, 419000, 433000, 476000],
  16.0: [0, 288000, 305000, 347000, 361000, 423000, 439000, 454000, 501000],
  17.0: [0, 301000, 319000, 363000, 378000, 443000, 460000, 477000, 527000],
  18.0: [0, 314000, 333000, 379000, 395000, 463000, 481000, 499000, 553000],
  19.0: [0, 327000, 347000, 395000, 411000, 484000, 503000, 521000, 578000],
  20.0: [0, 340000, 361000, 410000, 428000, 504000, 524000, 543000, 604000],
  21.0: [0, 351000, 373000, 425000, 444000, 523000, 543000, 566000, 628000],
  22.0: [0, 362000, 385000, 440000, 459000, 541000, 563000, 589000, 652000],
  23.0: [0, 373000, 397000, 455000, 475000, 560000, 582000, 613000, 677000],
  24.0: [0, 384000, 409000, 470000, 491000, 578000, 602000, 636000, 701000],
  25.0: [0, 395000, 421000, 484000, 507000, 597000, 621000, 659000, 725000],
  26.0: [0, 407000, 433000, 499000, 522000, 615000, 641000, 682000, 749000],
  27.0: [0, 418000, 445000, 514000, 538000, 634000, 660000, 705000, 773000],
  28.0: [0, 429000, 457000, 529000, 554000, 652000, 680000, 728000, 797000],
  29.0: [0, 440000, 469000, 544000, 570000, 671000, 699000, 751000, 821000],
  30.0: [0, 451000, 481000, 559000, 585000, 689000, 718000, 775000, 845000],
  40.0: [0, 559000, 617000, 713000, 749000, 881000, 919000, 1022000, 1101000],
  50.0: [0, 669000, 755000, 869000, 915000, 1074000, 1122000, 1271000, 1360000],
  60.0: [0, 769000, 875000, 999000, 1055000, 1238000, 1453000, 1495000, 1592000],
  70.0: [0, 869000, 995000, 1129000, 1195000, 1402000, 1784000, 1719000, 1824000]
};

const POSTE_DOC_2KG = {
  0.5: [0, 22836, 23336, 23839, 23571, 24531, 24783, 26296, 26811],
  1.0: [0, 29122, 30212, 32121, 31919, 34142, 34822, 36837, 37351],
  1.5: [0, 35261, 36843, 39900, 40023, 43499, 44610, 46876, 47390],
  2.0: [0, 41400, 43473, 47679, 48126, 52857, 54398, 56914, 57429]
};

const POSTE_COLIS = {
  0.5:  [0, 23840, 24340, 24842, 24553, 25543, 25795, 27327, 27842],
  1.0:  [0, 30127, 31217, 33124, 32901, 35154, 35834, 37866, 38381],
  1.5:  [0, 36266, 37847, 40903, 41005, 44511, 45622, 47905, 48420],
  2.0:  [0, 42405, 44477, 48682, 49109, 53868, 55410, 57944, 58459],
  2.5:  [0, 48544, 51106, 56462, 57212, 63226, 65196, 67981, 68496],
  3.0:  [0, 53656, 56463, 62556, 63549, 70549, 72766, 76045, 77051],
  3.5:  [0, 58768, 61820, 68651, 69886, 77873, 80336, 84109, 85606],
  4.0:  [0, 63881, 67177, 74746, 76222, 85196, 87906, 92173, 94161],
  4.5:  [0, 68993, 72535, 80840, 82559, 92519, 95475, 100237, 102716],
  5.0:  [0, 74105, 77892, 86935, 88895, 99843, 103045, 108300, 111271],
  5.5:  [0, 78035, 82068, 91847, 94052, 105982, 109429, 114684, 118637],
  6.0:  [0, 81964, 86243, 96759, 99209, 112121, 115813, 121068, 126003],
  6.5:  [0, 85894, 90419, 101670, 104365, 118260, 122196, 127452, 133370],
  7.0:  [0, 89823, 94595, 106582, 109522, 124399, 128580, 133836, 140736],
  7.5:  [0, 93752, 98770, 111494, 114678, 130538, 134964, 140219, 148102],
  8.0:  [0, 97682, 102946, 116406, 119835, 136676, 141348, 146603, 155468],
  8.5:  [0, 101611, 107122, 121317, 124992, 142815, 147732, 152987, 162834],
  9.0:  [0, 105541, 111298, 126229, 130148, 148954, 154115, 159371, 170200],
  9.5:  [0, 109470, 115473, 131141, 135305, 155093, 160499, 165755, 177566],
  10.0: [0, 113399, 119649, 136053, 140461, 161232, 166883, 172138, 184933],
  11.0: [0, 120276, 127015, 144404, 149302, 172038, 178179, 183927, 198685],
  12.0: [0, 127152, 134381, 152755, 158144, 182844, 189474, 195715, 212438],
  13.0: [0, 134029, 141748, 161107, 166985, 193650, 200770, 207503, 226191],
  14.0: [0, 140905, 149114, 169458, 175826, 204456, 212065, 219291, 239944],
  15.0: [0, 147782, 156480, 177810, 184667, 215262, 223361, 231079, 253697],
  16.0: [0, 154658, 163846, 186161, 193508, 226067, 234656, 242868, 267450],
  17.0: [0, 161535, 171212, 194513, 202349, 236873, 245952, 254656, 281203],
  18.0: [0, 168411, 178578, 202864, 211191, 247679, 257247, 266444, 294956],
  19.0: [0, 175288, 185944, 211216, 220032, 258485, 268543, 278232, 308709],
  20.0: [0, 182164, 193311, 219567, 228873, 269291, 279838, 290020, 322462],
  21.0: [0, 188058, 199697, 227426, 237224, 279114, 290152, 302298, 335229],
  22.0: [0, 193952, 206084, 235285, 245576, 288938, 300465, 314576, 347997],
  23.0: [0, 199846, 212471, 243143, 253927, 298761, 310778, 326854, 360764],
  24.0: [0, 205740, 218858, 251002, 262279, 308585, 321091, 339132, 373532],
  25.0: [0, 211634, 225244, 258861, 270630, 318408, 331404, 351410, 386300],
  26.0: [0, 217529, 231631, 266720, 278982, 328232, 341718, 363688, 399067],
  27.0: [0, 223423, 238018, 274579, 287333, 338055, 352031, 375966, 411835],
  28.0: [0, 229317, 244405, 282437, 295684, 347879, 362344, 388244, 424602],
  29.0: [0, 235211, 250791, 290296, 304036, 357702, 372657, 400522, 437370],
  30.0: [0, 241105, 257178, 298155, 312387, 367526, 382970, 412799, 450138],
  40.0: [0, 302435, 333981, 385283, 404663, 475260, 495867, 551479, 593980],
  50.0: [0, 363766, 410785, 472412, 496939, 582994, 608763, 690158, 737822],
  60.0: [0, 425096, 487588, 559540, 589215, 690728, 721660, 828838, 881664],
  70.0: [0, 486427, 564391, 646668, 681491, 798462, 834556, 967517, 1025506]
};

const ADDERS_DHL_70_TO_300 = [0, 5975, 7524, 8037, 8555, 9585, 9585, 11981, 13709];
const ADDERS_DHL_300_PLUS = [0, 5856, 7403, 7918, 8437, 9467, 9467, 11833, 13589];

// ── FONCTIONS UTILS ──

function arrondirPoids(poids) {
  if (poids <= 0.5) return 0.5;
  if (poids > 30) {
    return Math.ceil(poids);
  }
  return Math.ceil(poids * 2) / 2;
}

function trouverTarif(grille, poids, zone) {
  const poidsArrondi = arrondirPoids(poids);
  
  if (grille[poidsArrondi]) {
    return grille[poidsArrondi][zone] || 0;
  }

  const cles = Object.keys(grille).map(Number).sort((a, b) => a - b);
  let palierInf = 0.5;
  for (let p of cles) {
    if (p <= poidsArrondi) palierInf = p;
    else break;
  }

  let tarifDeBase = grille[palierInf] ? (grille[palierInf][zone] || 0) : 0;
  const maxPoids = cles[cles.length - 1];

  if (poidsArrondi > maxPoids) {
    tarifDeBase = grille[maxPoids][zone] || 0;
    const diffKg = poidsArrondi - maxPoids;
    let ratePerKg = 0;
    if (poidsArrondi <= 300) ratePerKg = ADDERS_DHL_70_TO_300[zone] || 0;
    else ratePerKg = ADDERS_DHL_300_PLUS[zone] || 0;
    return tarifDeBase + (diffKg * ratePerKg);
  }

  return tarifDeBase;
}

function calculerPoidsVolumetrique(l, w, h) {
  if (!l || !w || !h) return 0;
  return (l * w * h) / 5000;
}

function calculerSurtaxes(params) {
  const poids_reel = parseFloat(params.poids_reel) || 0;
  const longueur = parseFloat(params.longueur) || 0;
  const largeur = parseFloat(params.largeur) || 0;
  const hauteur = parseFloat(params.hauteur) || 0;
  let type_envoi = (params.type_envoi || 'DOCUMENT').toUpperCase();
  const dest_pays = params.dest_pays || 'France';
  const montant_jour_dhl = parseFloat(params.montant_jour_dhl) || 0;

  const zone = obtenirZone(dest_pays);

  let poids_vol = parseFloat(params.poids_vol) || 0;
  if (!poids_vol) {
    poids_vol = calculerPoidsVolumetrique(longueur, largeur, hauteur);
  }
  const poids_fact = Math.max(poids_reel, poids_vol);

  let estForceColis = false;
  if (type_envoi === 'DOCUMENT' && poids_fact > 2.0) {
    type_envoi = 'COLIS';
    estForceColis = true;
  }

  let tarif_guichet = 0;
  let tarif_poste = 0;

  if (type_envoi === 'DOCUMENT' && poids_fact <= 2.0) {
    tarif_guichet = trouverTarif(GUICHET_DOC_2KG, poids_fact, zone);
    tarif_poste = trouverTarif(POSTE_DOC_2KG, poids_fact, zone);
  } else {
    tarif_guichet = trouverTarif(GUICHET_COLIS, poids_fact, zone);
    tarif_poste = trouverTarif(POSTE_COLIS, poids_fact, zone);
  }

  let surtaxe = montant_jour_dhl - tarif_poste;
  if (surtaxe < 0) {
    surtaxe = 0;
  }

  const total_payer = tarif_guichet + surtaxe;

  return {
    poids_reel,
    poids_vol: Math.round(poids_vol * 100) / 100,
    poids_fact: Math.round(poids_fact * 100) / 100,
    // Poids réellement utilisé pour chercher le tarif dans les grilles (palier
    // arrondi) — champ informatif pour l'aperçu agent, ne change aucun calcul.
    poids_tranche: arrondirPoids(poids_fact),
    type_envoi,
    estForceColis,
    zone,
    tarif_guichet,
    tarif_poste,
    montant_jour_dhl,
    surtaxe,
    total_payer
  };
}

module.exports = {
  calculerSurtaxes,
  calculerPoidsVolumetrique,
  arrondirPoids,
  obtenirZone,
  PAYS_LIST,
  GUICHET_DOC_2KG,
  GUICHET_COLIS,
  POSTE_DOC_2KG,
  POSTE_COLIS
};

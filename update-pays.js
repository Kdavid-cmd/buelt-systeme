const fs = require('fs');

const data = `Afghanistan	AF	7
Albania	AL	4
Algeria	DZ	3
American Samoa	AS	8
Andorra	AD	4
Angola	AO	3
Anguilla	AI	8
Antigua	AG	8
Argentina	AR	8
Armenia	AM	4
Aruba	AW	8
Australia	AU	8
Austria	AT	4
Azerbaijan	AZ	4
Bahamas	BS	8
Bahrain	BH	7
Bangladesh	BD	7
Barbados	BB	8
Belarus	BY	4
Belgium	BE	4
Belize	BZ	8
Benin	BJ	1
Bermuda	BM	8
Bhutan	BT	7
Bolivia	BO	8
Bonaire	XB	8
Bosnia & Herzegovina	BA	4
Botswana	BW	3
Brazil	BR	8
Brunei	BN	7
Bulgaria	BG	4
Burkina Faso	BF	1
Burundi	BI	3
Cambodia	KH	7
Cameroon	CM	1
Canada	CA	5
Canary Islands, The	IC	4
Cape Verde	CV	1
Cayman Islands	KY	8
Central African Rep	CF	1
Chad	TD	3
Chile	CL	8
China	CN	6
Colombia	CO	8
Comoros	KM	3
Congo	CG	3
Congo, DPR	CD	3
Cook Islands	CK	8
Costa Rica	CR	8
Croatia	HR	4
Cuba	CU	8
Curacao	XC	8
Cyprus	CY	4
Czech Rep., The	CZ	4
Denmark	DK	4
Djibouti	DJ	3
Dominica	DM	8
Dominican Rep.	DO	8
Ecuador	EC	8
Egypt	EG	3
El Salvador	SV	8
Eritrea	ER	3
Estonia	EE	4
Eswatini	SZ	3
Ethiopia	ET	3
Falkland Islands	FK	8
Faroe Islands	FO	8
Fiji	FJ	8
Finland	FI	4
France	FR	2
French Guyana	GF	8
Gabon	GA	1
Gambia	GM	1
Georgia	GE	4
Germany	DE	4
Ghana	GH	1
Gibraltar	GI	4
Greece	GR	4
Greenland	GL	8
Grenada	GD	8
Guadeloupe	GP	8
Guam	GU	8
Guatemala	GT	8
Guernsey	GG	4
Guinea Rep.	GN	1
Guinea-Bissau	GW	1
Guinea-Equatorial	GQ	1
Guyana (British)	GY	8
Haiti	HT	8
Honduras	HN	8
Hong Kong SAR China	HK	6
Hungary	HU	4
Iceland	IS	4
India	IN	7
Indonesia	ID	7
Iran	IR	7
Iraq	IQ	7
Ireland, Rep. Of	IE	4
Israel	IL	4
Italy	IT	4
Jamaica	JM	8
Japan	JP	6
Jersey	JE	4
Jordan	JO	7
Kazakhstan	KZ	4
Kenya	KE	3
Kiribati	KI	8
Korea, D.P.R Of	KP	7
Korea, Rep. Of	KR	7
Kosovo	KV	8
Kuwait	KW	7
Kyrgyzstan	KG	4
Laos	LA	7
Latvia	LV	4
Lebanon	LB	7
Lesotho	LS	3
Liberia	LR	1
Libya	LY	3
Liechtenstein	LI	4
Lithuania	LT	4
Luxembourg	LU	4
Macau SAR China	MO	7
Madagascar	MG	3
Malawi	MW	3
Malaysia	MY	7
Maldives	MV	7
Mali	ML	1
Malta	MT	4
Mariana Islands	MP	8
Marshall Islands	MH	8
Martinique	MQ	8
Mauritania	MR	1
Mauritius	MU	3
Mayotte	YT	8
Mexico	MX	5
Micronesia	FM	8
Moldova, Rep. Of	MD	4
Monaco	MC	2
Mongolia	MN	7
Montenegro, Rep Of	ME	4
Montserrat	MS	8
Morocco	MA	3
Mozambique	MZ	3
Myanmar	MM	7
Namibia	NA	3
Nauru, Rep. Of	NR	8
Nepal	NP	7
Netherlands, The	NL	4
Nevis	XN	8
New Caledonia	NC	8
New Zealand	NZ	8
Nicaragua	NI	8
Niger	NE	1
Nigeria	NG	1
Niue	NU	8
North Macedonia	MK	4
Norway	NO	4
Oman	OM	7
Pakistan	PK	7
Palau	PW	8
Panama	PA	8
Papua New Guinea	PG	8
Paraguay	PY	8
Peru	PE	8
Philippines, The	PH	7
Poland	PL	4
Portugal	PT	4
Puerto Rico	PR	8
Qatar	QA	7
Reunion, Island Of	RE	8
Romania	RO	4
Russian Federation	RU	8
Rwanda	RW	3
Saint Helena	SH	3
Samoa	WS	8
San Marino	SM	4
Sao Tome And Principe	ST	8
Saudi Arabia	SA	7
Senegal	SN	1
Serbia, Rep. Of	RS	4
Seychelles	SC	8
Sierra Leone	SL	1
Singapore	SG	7
Slovakia	SK	4
Slovenia	SI	4
Solomon Islands	SB	8
Somalia	SO	3
Somaliland, Rep Of	XS	3
South Africa	ZA	3
South Sudan	SS	3
Spain	ES	4
Sri Lanka	LK	7
St. Barthelemy	XY	8
St. Eustatius	XE	8
St. Kitts	KN	8
St. Lucia	LC	8
St. Maarten	XM	8
St. Vincent	VC	8
Sudan	SD	3
Suriname	SR	8
Sweden	SE	4
Switzerland	CH	4
Syria	SY	7
Tahiti	PF	8
Taiwan	TW	7
Tajikistan	TJ	4
Tanzania	TZ	3
Thailand	TH	7
Timor-Leste	TL	8
Togo	TG	1
Tonga	TO	8
Trinidad And Tobago	TT	8
Tunisia	TN	3
Turkey	TR	4
Turkmenistan	TM	4
Turks & Caicos	TC	8
Tuvalu	TV	8
USA	US	5
Uganda	UG	3
Ukraine	UA	4
United Arab Emirates	AE	7
United Kingdom	GB	4
Uruguay	UY	8
Uzbekistan	UZ	4
Vanuatu	VU	8
Vatican City	VA	4
Venezuela	VE	8
Vietnam	VN	7
Virgin Islands-British	VG	8
Virgin Islands-US	VI	8
Yemen, Rep. Of	YE	7
Zambia	ZM	3
Zimbabwe	ZW	3`;

const lines = data.split('\n').filter(l => l.trim().length > 0);
let jsArray = 'const PAYS_LIST = [\n';
lines.forEach((line, index) => {
  const parts = line.split('\t');
  if (parts.length === 3) {
    const nom = parts[0].replace(/'/g, "\\'").replace(/"/g, '\\"');
    const code = parts[1];
    const zone = parts[2];
    jsArray += `  { nom: "${nom}", code: "${code}", zone: ${zone} }${index < lines.length - 1 ? ',' : ''}\n`;
  }
});
jsArray += '];';

const filePath = 'c:/Users/becke/.gemini/antigravity-ide/scratch/surtaxe-app/backend/services/surtaxeService.js';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/const PAYS_LIST = \[[\s\S]*?\];/, jsArray);
fs.writeFileSync(filePath, content);
console.log('Successfully updated PAYS_LIST in ' + filePath);


-- ══════════════════════════════════════════════════════
-- SCHEMA DE BASE DE DONNÉES SUPABASE — LA POSTE CI BUELT
-- Exécutez ce script dans Supabase : SQL Editor -> New Query -> Run
-- ══════════════════════════════════════════════════════

-- 1. Table des Agences (Bureaux de Poste)
CREATE TABLE IF NOT EXISTS agences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    nom TEXT NOT NULL,
    ville TEXT DEFAULT 'Abidjan',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insérer l'agence pilote
INSERT INTO agences (code, nom, ville) 
VALUES ('ABJ-COC', 'COCODY', 'Abidjan')
ON CONFLICT (code) DO NOTHING;

-- 2. Table des Reçus / Calculs de Surtaxe
CREATE TABLE IF NOT EXISTS recus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    waybill TEXT NOT NULL,
    bureau_poste TEXT NOT NULL DEFAULT 'COCODY',
    exp_nom TEXT NOT NULL,
    exp_tel TEXT NOT NULL,
    exp_adresse TEXT NOT NULL,
    dest_nom TEXT NOT NULL,
    dest_tel TEXT NOT NULL,
    dest_adresse TEXT NOT NULL,
    dest_pays TEXT NOT NULL,
    type_envoi TEXT NOT NULL DEFAULT 'DOCUMENT',
    valeur_declaree TEXT DEFAULT '—',
    poids_reel NUMERIC(10,2) NOT NULL,
    poids_vol NUMERIC(10,2) DEFAULT 0,
    poids_fact NUMERIC(10,2) NOT NULL,
    zone INT NOT NULL,
    tarif_guichet NUMERIC(12,2) NOT NULL,
    tarif_poste NUMERIC(12,2) NOT NULL,
    montant_jour_dhl NUMERIC(12,2) NOT NULL,
    surtaxe NUMERIC(12,2) NOT NULL,
    total_payer NUMERIC(12,2) NOT NULL,
    agent_nom TEXT NOT NULL,
    date_emission TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Compteur Séquentiel des Reçus par Agence
CREATE TABLE IF NOT EXISTS compteur_recus (
    code_agence TEXT PRIMARY KEY,
    dernier_numero INT NOT NULL DEFAULT 0
);

INSERT INTO compteur_recus (code_agence, dernier_numero)
VALUES ('COCODY', 0)
ON CONFLICT (code_agence) DO NOTHING;

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_recus_waybill ON recus(waybill);
CREATE INDEX IF NOT EXISTS idx_recus_date ON recus(date_emission);
CREATE INDEX IF NOT EXISTS idx_recus_bureau ON recus(bureau_poste);

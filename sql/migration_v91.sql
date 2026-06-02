-- v91: trusted_ips — IP-based access control

CREATE TABLE IF NOT EXISTS trusted_ips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip          TEXT NOT NULL UNIQUE,
    label       TEXT,                          -- назва: "Офіс Київ", "VPN" тощо
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trusted_ips ENABLE ROW LEVEL SECURITY;

-- Читати можуть всі автентифіковані (потрібно для адмін UI)
CREATE POLICY "trusted_ips_select" ON trusted_ips
    FOR SELECT TO authenticated USING (true);

-- Змінювати тільки owner/admin
CREATE POLICY "trusted_ips_insert" ON trusted_ips
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "trusted_ips_delete" ON trusted_ips
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

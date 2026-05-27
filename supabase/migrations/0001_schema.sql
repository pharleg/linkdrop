-- ============================================================
-- LinkDrop Schema — 0001
-- Table order: proposals before links (FK dependency)
-- ============================================================

-- proposals
CREATE TABLE IF NOT EXISTS proposals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES auth.users NOT NULL,
  title              text NOT NULL,
  body               text,
  logo_url           text,
  file_url           text,
  signature_required boolean DEFAULT false,
  created_at         timestamptz DEFAULT now(),
  expires_at         timestamptz
);

-- links
CREATE TABLE IF NOT EXISTS links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users NOT NULL,
  slug                  text UNIQUE NOT NULL,
  destination_url       text,
  proposal_id           uuid REFERENCES proposals(id),
  created_at            timestamptz DEFAULT now(),
  notify_on_first_click boolean DEFAULT false,
  active                boolean DEFAULT true,
  CONSTRAINT destination_or_proposal
    CHECK (destination_url IS NOT NULL OR proposal_id IS NOT NULL)
);

-- clicks
CREATE TABLE IF NOT EXISTS clicks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id    uuid REFERENCES links(id) NOT NULL,
  clicked_at timestamptz DEFAULT now(),
  ip_hash    text,
  user_agent text,
  referrer   text
);

-- signatures
CREATE TABLE IF NOT EXISTS signatures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id    uuid REFERENCES proposals(id) NOT NULL,
  link_id        uuid REFERENCES links(id) NOT NULL,
  signer_name    text NOT NULL,
  signer_email   text NOT NULL,
  signature_data text NOT NULL,
  signed_at      timestamptz DEFAULT now(),
  ip_hash        text,
  CONSTRAINT one_signature_per_link UNIQUE (proposal_id, link_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS links_user_id_idx          ON links(user_id);
CREATE INDEX IF NOT EXISTS links_slug_idx              ON links(slug);
CREATE INDEX IF NOT EXISTS clicks_link_id_idx          ON clicks(link_id);
CREATE INDEX IF NOT EXISTS proposals_user_id_idx       ON proposals(user_id);
CREATE INDEX IF NOT EXISTS signatures_proposal_id_idx  ON signatures(proposal_id);

-- RLS
ALTER TABLE links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- links: authenticated owner policies
CREATE POLICY "owner select links"
  ON links FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner insert links"
  ON links FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner update links"
  ON links FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner delete links"
  ON links FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- links: anon public read for slug lookup
CREATE POLICY "public read active links"
  ON links FOR SELECT TO anon
  USING (active = true);

-- clicks: owner read
CREATE POLICY "owner select clicks"
  ON clicks FOR SELECT TO authenticated
  USING (link_id IN (SELECT id FROM links WHERE user_id = auth.uid()));

-- clicks: public insert (rate limiting deferred to Phase 3)
CREATE POLICY "public insert clicks"
  ON clicks FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- proposals: authenticated owner policies
CREATE POLICY "owner select proposals"
  ON proposals FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner insert proposals"
  ON proposals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner update proposals"
  ON proposals FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner delete proposals"
  ON proposals FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- proposals: anon public read — only if linked by an active link
CREATE POLICY "public read active proposals"
  ON proposals FOR SELECT TO anon
  USING (id IN (SELECT proposal_id FROM links WHERE active = true));

-- signatures: owner read
CREATE POLICY "owner select signatures"
  ON signatures FOR SELECT TO authenticated
  USING (proposal_id IN (SELECT id FROM proposals WHERE user_id = auth.uid()));

-- signatures: public insert — only for non-expired proposals
CREATE POLICY "public insert signatures"
  ON signatures FOR INSERT TO anon, authenticated
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM proposals
      WHERE expires_at IS NULL OR expires_at > now()
    )
  );

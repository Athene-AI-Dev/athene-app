ALTER TABLE kg_nodes ALTER COLUMN community TYPE text;
COMMENT ON COLUMN kg_nodes.community IS 'Connected component ID (root node UUID)';

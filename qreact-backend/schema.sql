CREATE TABLE IF NOT EXISTS reacts (
  user TEXT NOT NULL,
  post TEXT NOT NULL,
  PRIMARY KEY (user, post)
);
CREATE INDEX IF NOT EXISTS idx_reacts_post ON reacts(post);

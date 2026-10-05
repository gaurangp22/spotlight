CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 handle TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '',
 password TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS posts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('ranking','moodboard')), title TEXT NOT NULL,
 subtitle TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, tiles TEXT NOT NULL DEFAULT '[]',
 theme TEXT NOT NULL DEFAULT 'night', visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')),
 origin_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_author_date ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_date ON posts(visibility, created_at DESC);
CREATE TABLE IF NOT EXISTS follows (
 follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY (follower_id, followed_id), CHECK(follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS follows_target ON follows(followed_id);
CREATE TABLE IF NOT EXISTS reactions (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS reactions_post ON reactions(post_id);
CREATE TABLE IF NOT EXISTS comments (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, text TEXT NOT NULL,
 item_id TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_post_date ON comments(post_id, created_at);
CREATE TABLE IF NOT EXISTS blocks (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY (user_id, blocked_id), CHECK(user_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_target ON blocks(blocked_id);
CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_date ON notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS spotify (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 credentials TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
 state_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 verifier TEXT NOT NULL, return_uri TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);

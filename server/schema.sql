CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 handle TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '',
 password TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT '',
 avatar TEXT NOT NULL DEFAULT '', favorite_artists TEXT NOT NULL DEFAULT '[]', onboarding_complete INTEGER NOT NULL DEFAULT 0,
 email_verified INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, allow_messages INTEGER NOT NULL DEFAULT 1,
 invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 is_bot INTEGER NOT NULL DEFAULT 0, show_bots INTEGER NOT NULL DEFAULT 1
);
-- What each house bot has already done, so actions are idempotent and daily limits can be enforced.
CREATE TABLE IF NOT EXISTS bot_actions (
 bot_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, target TEXT NOT NULL, kind TEXT NOT NULL,
 recipient TEXT, created_at TEXT NOT NULL, PRIMARY KEY (bot_id, target, kind)
);
CREATE INDEX IF NOT EXISTS bot_actions_recipient ON bot_actions(recipient, kind, created_at);
CREATE INDEX IF NOT EXISTS users_invited_by ON users(invited_by);
-- One row per person per day they used the app: enough for active-user and retention counts, nothing more.
CREATE TABLE IF NOT EXISTS active_days (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL,
 PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS active_days_day ON active_days(day);
CREATE TABLE IF NOT EXISTS feedback (
 id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, text TEXT NOT NULL,
 context TEXT NOT NULL DEFAULT '', platform TEXT NOT NULL DEFAULT 'unknown', version TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS email_otps (
 challenge_hash TEXT PRIMARY KEY, email TEXT NOT NULL,
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, consumed INTEGER NOT NULL DEFAULT 0, purpose TEXT NOT NULL DEFAULT 'signin'
);
CREATE INDEX IF NOT EXISTS email_otps_email_date ON email_otps(email, created_at);
CREATE TABLE IF NOT EXISTS posts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('ranking','moodboard','review','pod','take')), title TEXT NOT NULL,
 subtitle TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, tiles TEXT NOT NULL DEFAULT '[]',
 theme TEXT NOT NULL DEFAULT 'night', visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')),
 origin_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, meta TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS posts_author_date ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_date ON posts(visibility, created_at DESC);
-- One row per rated item. Tier is the gut reaction (2 loved, 1 fine, 0 not for me). Position orders
-- items within a tier (0 is best) and the score is derived from both. The review lives on the linked post.
CREATE TABLE IF NOT EXISTS ratings (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_id TEXT NOT NULL, category TEXT NOT NULL, item TEXT NOT NULL,
 tier INTEGER NOT NULL CHECK(tier IN (0,1,2)), position INTEGER NOT NULL, score REAL NOT NULL,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS ratings_order ON ratings(user_id, category, tier, position);
CREATE INDEX IF NOT EXISTS ratings_item ON ratings(item_id);
CREATE INDEX IF NOT EXISTS ratings_post ON ratings(post_id);
-- One vote per person per poll. A take is a poll when its meta says so and it holds exactly two items.
CREATE TABLE IF NOT EXISTS poll_votes (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 choice INTEGER NOT NULL CHECK(choice IN (0,1)), created_at TEXT NOT NULL,
 PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS poll_votes_post ON poll_votes(post_id);
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
 item_id TEXT, created_at TEXT NOT NULL, parent_id TEXT REFERENCES comments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS comments_post_date ON comments(post_id, created_at);
CREATE TABLE IF NOT EXISTS saved_items (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_id TEXT NOT NULL, item TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS saved_posts (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS clubs (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS club_members (
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, joined_at TEXT NOT NULL,
 PRIMARY KEY(club_id,user_id)
);
CREATE TABLE IF NOT EXISTS club_weeks (
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 week TEXT NOT NULL, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 PRIMARY KEY(club_id,week)
);
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
CREATE TABLE IF NOT EXISTS conversations (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('direct','group')), name TEXT NOT NULL DEFAULT '',
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, direct_key TEXT UNIQUE, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_members (
 conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_read INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(conversation_id,user_id)
);
CREATE INDEX IF NOT EXISTS conversation_members_user ON conversation_members(user_id,conversation_id);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, sequence INTEGER NOT NULL,
 client_id TEXT NOT NULL, text TEXT NOT NULL, item TEXT, post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
 UNIQUE(conversation_id,sequence), UNIQUE(conversation_id,sender_id,client_id)
);
CREATE INDEX IF NOT EXISTS messages_thread ON messages(conversation_id,sequence);
CREATE TABLE IF NOT EXISTS message_reports (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, reason TEXT NOT NULL,
 created_at TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS listening_history (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id TEXT NOT NULL, played_at TEXT NOT NULL,
 item TEXT NOT NULL, PRIMARY KEY(user_id,item_id,played_at)
);
CREATE INDEX IF NOT EXISTS history_user_date ON listening_history(user_id,played_at DESC);
CREATE TABLE IF NOT EXISTS push_tokens (
 token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS push_jobs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
 conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE, token TEXT NOT NULL REFERENCES push_tokens(token) ON DELETE CASCADE,
 kind TEXT NOT NULL, ticket TEXT, attempts INTEGER NOT NULL DEFAULT 0, due_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_jobs_due ON push_jobs(due_at);
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

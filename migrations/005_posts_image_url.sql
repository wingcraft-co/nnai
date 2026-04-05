-- Mobile feed: persist uploaded post image URL (additive).
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS image_url TEXT;

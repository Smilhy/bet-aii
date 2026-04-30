
-- Create table for articles in Supabase
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,  -- Unique identifier
    title TEXT NOT NULL,    -- Article title
    summary TEXT,           -- Short summary
    content TEXT,           -- Full article content
    link TEXT,              -- Link to the full article
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Published time
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Last update
    thumbnail_url TEXT,     -- Thumbnail URL
    author TEXT             -- Article author
);

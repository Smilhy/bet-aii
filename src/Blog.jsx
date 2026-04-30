
import React, { useState, useEffect } from 'react';
import Parser from 'rss-parser';

const Blog = () => {
  const [articles, setArticles] = useState([]);
  const parser = new Parser();

  // Function to fetch articles from RSS
  const fetchArticles = async () => {
    try {
      const feed = await parser.parseURL('https://www.sport.pl/rss/');
      setArticles(feed.items); // Set fetched articles
    } catch (error) {
      console.error('Error fetching articles:', error);
    }
  };

  // Fetch articles every 10 minutes
  useEffect(() => {
    fetchArticles(); // Initial fetch
    const interval = setInterval(fetchArticles, 10 * 60 * 1000); // Every 10 minutes
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  return (
    <div>
      <h1>Aktualne Artykuły</h1>
      {articles.length > 0 ? (
        <ul>
          {articles.map((article, index) => (
            <li key={index}>
              <img src={article.enclosure?.url} alt={article.title} />
              <h2>{article.title}</h2>
              <p>{article.contentSnippet}</p>
              <a href={article.link} target="_blank" rel="noopener noreferrer">
                Czytaj więcej
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>Ładowanie artykułów...</p>
      )}
    </div>
  );
};

export default Blog;

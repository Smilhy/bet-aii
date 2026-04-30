
import React, { useState, useEffect } from 'react';
import Parser from 'rss-parser';

const Blog = () => {
  const [articles, setArticles] = useState([]);
  const parser = new Parser();

  const fetchArticles = async () => {
    try {
      const feed = await parser.parseURL('https://www.sport.pl/rss/');
      setArticles(feed.items); // Pobieramy artykuły
    } catch (error) {
      console.error('Błąd podczas pobierania artykułów:', error);
    }
  };

  useEffect(() => {
    fetchArticles(); // Początkowe pobieranie
    const interval = setInterval(fetchArticles, 10 * 60 * 1000); // Odświeżanie co 10 minut
    return () => clearInterval(interval);
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

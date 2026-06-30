DROP DATABASE IF EXISTS movie_rating_system;
CREATE DATABASE movie_rating_system
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE movie_rating_system;

CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  real_name VARCHAR(40) NOT NULL,
  role ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
  email VARCHAR(80) UNIQUE,
  status ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE movies (
  movie_id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  release_year INT NOT NULL,
  duration INT NOT NULL,
  genre VARCHAR(40) NOT NULL,
  language VARCHAR(40) NOT NULL,
  country VARCHAR(40) NOT NULL,
  synopsis TEXT,
  poster_url VARCHAR(255),
  rating DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  rating_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_movies_release_year CHECK (release_year BETWEEN 1900 AND 2100),
  CONSTRAINT chk_movies_duration CHECK (duration > 0),
  CONSTRAINT chk_movies_rating CHECK (rating BETWEEN 0 AND 10),
  CONSTRAINT chk_movies_rating_count CHECK (rating_count >= 0)
) ENGINE=InnoDB;

CREATE TABLE actors (
  actor_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  gender ENUM('男', '女', '其他') NOT NULL DEFAULT '其他',
  birth_date DATE,
  nationality VARCHAR(40) NOT NULL,
  photo_url VARCHAR(255),
  bio TEXT
) ENGINE=InnoDB;

CREATE TABLE directors (
  director_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  gender ENUM('男', '女', '其他') NOT NULL DEFAULT '其他',
  birth_date DATE,
  nationality VARCHAR(40) NOT NULL,
  bio TEXT
) ENGINE=InnoDB;

CREATE TABLE movie_actor (
  movie_id INT NOT NULL,
  actor_id INT NOT NULL,
  role_name VARCHAR(80),
  PRIMARY KEY (movie_id, actor_id),
  CONSTRAINT fk_movie_actor_movie
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_movie_actor_actor
    FOREIGN KEY (actor_id) REFERENCES actors(actor_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE movie_director (
  movie_id INT NOT NULL,
  director_id INT NOT NULL,
  PRIMARY KEY (movie_id, director_id),
  CONSTRAINT fk_movie_director_movie
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_movie_director_director
    FOREIGN KEY (director_id) REFERENCES directors(director_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE ratings (
  rating_id INT PRIMARY KEY AUTO_INCREMENT,
  movie_id INT NOT NULL,
  user_id INT NOT NULL,
  score DECIMAL(3,1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CONSTRAINT uq_ratings_movie_user UNIQUE (movie_id, user_id),
  CONSTRAINT chk_ratings_score CHECK (score BETWEEN 0 AND 10),
  CONSTRAINT fk_ratings_movie
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ratings_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comments (
  comment_id INT PRIMARY KEY AUTO_INCREMENT,
  movie_id INT NOT NULL,
  user_id INT NOT NULL,
  content VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CONSTRAINT fk_comments_movie
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_comments_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_movies_query ON movies(genre, release_year, rating);
CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_actors_name ON actors(name);
CREATE INDEX idx_directors_name ON directors(name);
CREATE INDEX idx_comments_movie_time ON comments(movie_id, created_at);
CREATE INDEX idx_ratings_movie_score ON ratings(movie_id, score);

CREATE VIEW v_movie_summary AS
SELECT
  m.movie_id,
  m.title,
  m.release_year,
  m.duration,
  m.genre,
  m.language,
  m.country,
  m.rating,
  m.rating_count,
  COUNT(DISTINCT c.comment_id) AS comment_count,
  GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR '、') AS actors,
  GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR '、') AS directors
FROM movies m
LEFT JOIN movie_actor ma ON m.movie_id = ma.movie_id
LEFT JOIN actors a ON ma.actor_id = a.actor_id
LEFT JOIN movie_director md ON m.movie_id = md.movie_id
LEFT JOIN directors d ON md.director_id = d.director_id
LEFT JOIN comments c ON m.movie_id = c.movie_id
GROUP BY m.movie_id;

CREATE VIEW v_hot_movies AS
SELECT
  movie_id,
  title,
  genre,
  release_year,
  rating,
  rating_count,
  comment_count,
  (rating * 0.7 + LEAST(rating_count, 100) / 100 * 2 + LEAST(comment_count, 100) / 100) AS hot_score
FROM v_movie_summary
ORDER BY hot_score DESC, rating DESC;

DELIMITER $$

CREATE PROCEDURE sp_movie_comments(IN p_title VARCHAR(120))
BEGIN
  SELECT
    m.title,
    u.real_name AS user_name,
    c.content,
    c.created_at
  FROM comments c
  JOIN movies m ON c.movie_id = m.movie_id
  JOIN users u ON c.user_id = u.user_id
  WHERE m.title LIKE CONCAT('%', p_title, '%')
  ORDER BY c.created_at DESC;
END$$

CREATE PROCEDURE sp_actor_movies(IN p_actor_name VARCHAR(60))
BEGIN
  SELECT
    a.name AS actor_name,
    m.title,
    m.release_year,
    m.genre,
    ma.role_name,
    m.rating
  FROM actors a
  JOIN movie_actor ma ON a.actor_id = ma.actor_id
  JOIN movies m ON ma.movie_id = m.movie_id
  WHERE a.name LIKE CONCAT('%', p_actor_name, '%')
  ORDER BY m.release_year DESC, m.rating DESC;
END$$

CREATE PROCEDURE sp_genre_report()
BEGIN
  SELECT
    genre,
    COUNT(*) AS movie_count,
    ROUND(AVG(rating), 1) AS avg_rating,
    SUM(rating_count) AS total_rating_count
  FROM movies
  GROUP BY genre
  ORDER BY avg_rating DESC, movie_count DESC;
END$$

CREATE TRIGGER trg_ratings_after_insert
AFTER INSERT ON ratings
FOR EACH ROW
BEGIN
  UPDATE movies
  SET rating = (
        SELECT ROUND(AVG(score), 1)
        FROM ratings
        WHERE movie_id = NEW.movie_id
      ),
      rating_count = (
        SELECT COUNT(*)
        FROM ratings
        WHERE movie_id = NEW.movie_id
      )
  WHERE movie_id = NEW.movie_id;
END$$

CREATE TRIGGER trg_ratings_after_update
AFTER UPDATE ON ratings
FOR EACH ROW
BEGIN
  UPDATE movies
  SET rating = (
        SELECT ROUND(AVG(score), 1)
        FROM ratings
        WHERE movie_id = NEW.movie_id
      ),
      rating_count = (
        SELECT COUNT(*)
        FROM ratings
        WHERE movie_id = NEW.movie_id
      )
  WHERE movie_id = NEW.movie_id;
END$$

CREATE TRIGGER trg_ratings_after_delete
AFTER DELETE ON ratings
FOR EACH ROW
BEGIN
  UPDATE movies
  SET rating = COALESCE((
        SELECT ROUND(AVG(score), 1)
        FROM ratings
        WHERE movie_id = OLD.movie_id
      ), 0),
      rating_count = (
        SELECT COUNT(*)
        FROM ratings
        WHERE movie_id = OLD.movie_id
      )
  WHERE movie_id = OLD.movie_id;
END$$

DELIMITER ;


const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataFile = path.join(root, "data", "db.json");
const publicDir = path.join(root, "public");

const requiredFiles = [
  "server.js",
  "package.json",
  "sql/01_schema.sql",
  "sql/02_seed.sql",
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "data/db.json",
];

const errors = [];

for (const file of requiredFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    errors.push(`缺少文件：${file}`);
  }
}

const db = JSON.parse(fs.readFileSync(dataFile, "utf8"));

for (const movie of db.movies) {
  const actors = db.movieActors.filter((row) => row.movieId === movie.id);
  const directors = db.movieDirectors.filter((row) => row.movieId === movie.id);
  if (!actors.length) errors.push(`电影缺少演员：${movie.title}`);
  if (!directors.length) errors.push(`电影缺少导演：${movie.title}`);
  if (movie.posterUrl && !fs.existsSync(path.join(publicDir, movie.posterUrl))) {
    errors.push(`电影海报不存在：${movie.title} -> ${movie.posterUrl}`);
  }
}

for (const rating of db.ratings) {
  if (rating.score < 0 || rating.score > 10) {
    errors.push(`评分超出范围：rating_id=${rating.id}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("系统文件和基础数据检查通过。");


const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data", "db.json");
const PORT = Number(process.env.PORT || 3000);

const sessions = new Map();

function now() {
  return new Date().toISOString();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function readDb() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function nextId(db, collection) {
  if (!db.meta) db.meta = { nextIds: {} };
  if (!db.meta.nextIds) db.meta.nextIds = {};
  const current = db.meta.nextIds[collection] || 1;
  db.meta.nextIds[collection] = current + 1;
  return current;
}

function send(res, status, payload, headers = {}) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function sendError(res, status, message, details) {
  send(res, status, { error: message, details });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error("JSON 格式错误"));
      }
    });
    req.on("error", reject);
  });
}

function getToken(req) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return "";
}

function getCurrentUser(req, db) {
  const token = getToken(req);
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return db.users.find((user) => user.id === session.userId && user.status === "ACTIVE") || null;
}

function requireUser(req, res, db) {
  const user = getCurrentUser(req, db);
  if (!user) {
    sendError(res, 401, "请先登录");
    return null;
  }
  return user;
}

function requireAdmin(req, res, db) {
  const user = requireUser(req, res, db);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    sendError(res, 403, "需要管理员权限");
    return null;
  }
  return user;
}

function pickUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function includesIgnoreCase(value, query) {
  return String(value || "").toLowerCase().includes(String(query || "").toLowerCase());
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateRequired(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || String(body[field]).trim() === "");
  if (missing.length) {
    return `缺少必填字段：${missing.join("、")}`;
  }
  return "";
}

function validateDate(value) {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateGender(value) {
  return ["男", "女", "其他"].includes(value);
}

function movieActors(db, movieId) {
  return db.movieActors
    .filter((row) => row.movieId === movieId)
    .map((row) => {
      const actor = db.actors.find((item) => item.id === row.actorId);
      return actor ? { ...actor, roleName: row.roleName || "" } : null;
    })
    .filter(Boolean);
}

function movieDirectors(db, movieId) {
  return db.movieDirectors
    .filter((row) => row.movieId === movieId)
    .map((row) => db.directors.find((item) => item.id === row.directorId))
    .filter(Boolean);
}

function movieComments(db, movieId) {
  return db.comments
    .filter((comment) => comment.movieId === movieId)
    .map((comment) => ({
      ...comment,
      user: pickUser(db.users.find((user) => user.id === comment.userId)),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function movieRatings(db, movieId) {
  return db.ratings
    .filter((rating) => rating.movieId === movieId)
    .map((rating) => ({
      ...rating,
      user: pickUser(db.users.find((user) => user.id === rating.userId)),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function enrichMovie(db, movie) {
  const comments = movieComments(db, movie.id);
  return {
    ...movie,
    actors: movieActors(db, movie.id),
    directors: movieDirectors(db, movie.id),
    comments,
    commentCount: comments.length,
  };
}

function recalcMovieRating(db, movieId) {
  const movie = db.movies.find((item) => item.id === movieId);
  if (!movie) return;
  const ratings = db.ratings.filter((rating) => rating.movieId === movieId);
  movie.ratingCount = ratings.length;
  if (!ratings.length) {
    movie.rating = 0;
    return;
  }
  const total = ratings.reduce((sum, rating) => sum + Number(rating.score), 0);
  movie.rating = Math.round((total / ratings.length) * 10) / 10;
}

function applyMovieRelations(db, movieId, actorIds, directorIds, roleMap = {}) {
  if (Array.isArray(actorIds)) {
    db.movieActors = db.movieActors.filter((row) => row.movieId !== movieId);
    actorIds
      .map(Number)
      .filter((actorId) => db.actors.some((actor) => actor.id === actorId))
      .forEach((actorId) => {
        db.movieActors.push({
          movieId,
          actorId,
          roleName: roleMap[String(actorId)] || "",
        });
      });
  }
  if (Array.isArray(directorIds)) {
    db.movieDirectors = db.movieDirectors.filter((row) => row.movieId !== movieId);
    directorIds
      .map(Number)
      .filter((directorId) => db.directors.some((director) => director.id === directorId))
      .forEach((directorId) => {
        db.movieDirectors.push({ movieId, directorId });
      });
  }
}

function filterMovies(db, query) {
  let movies = db.movies.map((movie) => enrichMovie(db, movie));

  if (query.title) movies = movies.filter((movie) => includesIgnoreCase(movie.title, query.title));
  if (query.genre) movies = movies.filter((movie) => movie.genre === query.genre);
  if (query.country) movies = movies.filter((movie) => includesIgnoreCase(movie.country, query.country));
  if (query.actor) movies = movies.filter((movie) => movie.actors.some((actor) => includesIgnoreCase(actor.name, query.actor)));
  if (query.director) movies = movies.filter((movie) => movie.directors.some((director) => includesIgnoreCase(director.name, query.director)));
  if (query.yearFrom) movies = movies.filter((movie) => movie.releaseYear >= Number(query.yearFrom));
  if (query.yearTo) movies = movies.filter((movie) => movie.releaseYear <= Number(query.yearTo));
  if (query.minRating) movies = movies.filter((movie) => movie.rating >= Number(query.minRating));

  const sort = query.sort || "rating_desc";
  const sorters = {
    rating_desc: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
    rating_asc: (a, b) => a.rating - b.rating,
    year_desc: (a, b) => b.releaseYear - a.releaseYear,
    year_asc: (a, b) => a.releaseYear - b.releaseYear,
    title_asc: (a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"),
    hot_desc: (a, b) => hotScore(b) - hotScore(a),
  };
  movies.sort(sorters[sort] || sorters.rating_desc);
  return movies;
}

function hotScore(movie) {
  return movie.rating * 0.7 + Math.min(movie.ratingCount, 100) / 100 * 2 + Math.min(movie.commentCount || 0, 100) / 100;
}

function groupByGenre(db) {
  const map = new Map();
  db.movies.forEach((movie) => {
    if (!map.has(movie.genre)) {
      map.set(movie.genre, { genre: movie.genre, movieCount: 0, totalRating: 0, totalRatingCount: 0 });
    }
    const row = map.get(movie.genre);
    row.movieCount += 1;
    row.totalRating += Number(movie.rating || 0);
    row.totalRatingCount += Number(movie.ratingCount || 0);
  });
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      avgRating: Math.round((row.totalRating / row.movieCount) * 10) / 10,
    }))
    .sort((a, b) => b.avgRating - a.avgRating || b.movieCount - a.movieCount);
}

function serveStatic(req, res, pathname) {
  let requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  if (requested.includes("..")) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  let filePath = path.join(PUBLIC_DIR, requested);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

function handleLogin(req, res, db, body) {
  const username = String(body.username || "").trim();
  const passwordHash = hashPassword(body.password || "");
  const user = db.users.find((item) => item.username === username && item.passwordHash === passwordHash && item.status === "ACTIVE");
  if (!user) {
    sendError(res, 401, "用户名或密码错误");
    return;
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + 1000 * 60 * 60 * 8,
  });
  send(res, 200, { token, user: pickUser(user) });
}

async function handleApi(req, res, url) {
  const db = readDb();
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const method = req.method;
  const body = ["POST", "PUT", "PATCH"].includes(method) ? await readBody(req) : {};

  if (method === "POST" && pathname === "/api/login") {
    handleLogin(req, res, db, body);
    return;
  }

  if (method === "POST" && pathname === "/api/logout") {
    sessions.delete(getToken(req));
    send(res, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/me") {
    const user = requireUser(req, res, db);
    if (!user) return;
    send(res, 200, { user: pickUser(user) });
    return;
  }

  if (method === "GET" && pathname === "/api/dashboard") {
    const user = requireUser(req, res, db);
    if (!user) return;
    send(res, 200, {
      movieCount: db.movies.length,
      actorCount: db.actors.length,
      directorCount: db.directors.length,
      userCount: db.users.length,
      ratingCount: db.ratings.length,
      commentCount: db.comments.length,
      topMovies: filterMovies(db, { sort: "hot_desc" }).slice(0, 5),
      genreReport: groupByGenre(db),
    });
    return;
  }

  if (parts[1] === "lookups" && method === "GET") {
    const user = requireUser(req, res, db);
    if (!user) return;
    send(res, 200, {
      genres: Array.from(new Set(db.movies.map((movie) => movie.genre))).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      actors: db.actors,
      directors: db.directors,
    });
    return;
  }

  if (parts[1] === "movies") {
    await handleMovies(req, res, db, parts, url, body);
    return;
  }

  if (parts[1] === "actors") {
    await handlePeople(req, res, db, "actors", parts, body);
    return;
  }

  if (parts[1] === "directors") {
    await handlePeople(req, res, db, "directors", parts, body);
    return;
  }

  if (parts[1] === "users") {
    await handleUsers(req, res, db, parts, body);
    return;
  }

  if (parts[1] === "recommendations" && method === "GET") {
    const user = requireUser(req, res, db);
    if (!user) return;
    const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") || 6)));
    send(res, 200, { items: filterMovies(db, { sort: "hot_desc" }).slice(0, limit) });
    return;
  }

  if (parts[1] === "reports") {
    const user = requireUser(req, res, db);
    if (!user) return;
    if (parts[2] === "genres" && method === "GET") {
      send(res, 200, { items: groupByGenre(db) });
      return;
    }
    if (parts[2] === "top-users" && method === "GET") {
      const items = db.users.map((userRow) => ({
        user: pickUser(userRow),
        ratingCount: db.ratings.filter((rating) => rating.userId === userRow.id).length,
        commentCount: db.comments.filter((comment) => comment.userId === userRow.id).length,
      })).sort((a, b) => (b.ratingCount + b.commentCount) - (a.ratingCount + a.commentCount));
      send(res, 200, { items });
      return;
    }
  }

  if (parts[1] === "procedures") {
    const user = requireUser(req, res, db);
    if (!user) return;
    if (parts[2] === "movie-comments" && method === "GET") {
      const title = url.searchParams.get("title") || "";
      const items = db.comments
        .filter((comment) => {
          const movie = db.movies.find((item) => item.id === comment.movieId);
          return movie && includesIgnoreCase(movie.title, title);
        })
        .map((comment) => ({
          movie: db.movies.find((movie) => movie.id === comment.movieId),
          user: pickUser(db.users.find((item) => item.id === comment.userId)),
          content: comment.content,
          createdAt: comment.createdAt,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      send(res, 200, { items });
      return;
    }
    if (parts[2] === "actor-movies" && method === "GET") {
      const name = url.searchParams.get("name") || "";
      const items = db.movieActors
        .map((row) => ({
          actor: db.actors.find((actor) => actor.id === row.actorId),
          movie: db.movies.find((movie) => movie.id === row.movieId),
          roleName: row.roleName,
        }))
        .filter((row) => row.actor && row.movie && includesIgnoreCase(row.actor.name, name))
        .sort((a, b) => b.movie.releaseYear - a.movie.releaseYear || b.movie.rating - a.movie.rating);
      send(res, 200, { items });
      return;
    }
  }

  sendError(res, 404, "接口不存在");
}

async function handleMovies(req, res, db, parts, url, body) {
  const method = req.method;
  const id = parseId(parts[2]);

  if (!id && method === "GET") {
    const user = requireUser(req, res, db);
    if (!user) return;
    const query = Object.fromEntries(url.searchParams.entries());
    send(res, 200, { items: filterMovies(db, query) });
    return;
  }

  if (!id && method === "POST") {
    const user = requireAdmin(req, res, db);
    if (!user) return;
    const error = validateMoviePayload(body);
    if (error) {
      sendError(res, 400, error);
      return;
    }
    const movie = {
      id: nextId(db, "movies"),
      title: String(body.title).trim(),
      releaseYear: Number(body.releaseYear),
      duration: Number(body.duration),
      genre: String(body.genre).trim(),
      language: String(body.language).trim(),
      country: String(body.country).trim(),
      synopsis: String(body.synopsis || "").trim(),
      posterUrl: String(body.posterUrl || "assets/poster-default.svg").trim(),
      rating: 0,
      ratingCount: 0,
      createdAt: now(),
    };
    db.movies.push(movie);
    applyMovieRelations(db, movie.id, body.actorIds, body.directorIds, body.roleMap);
    writeDb(db);
    send(res, 201, { item: enrichMovie(db, movie) });
    return;
  }

  const movie = db.movies.find((item) => item.id === id);
  if (!movie) {
    sendError(res, 404, "电影不存在");
    return;
  }

  if (parts[3] === "ratings") {
    const user = requireUser(req, res, db);
    if (!user) return;
    if (method !== "POST") {
      sendError(res, 405, "方法不允许");
      return;
    }
    const score = Number(body.score);
    if (Number.isNaN(score) || score < 0 || score > 10) {
      sendError(res, 400, "评分必须在 0 到 10 之间");
      return;
    }
    let rating = db.ratings.find((item) => item.movieId === id && item.userId === user.id);
    if (rating) {
      rating.score = Math.round(score * 10) / 10;
      rating.updatedAt = now();
    } else {
      rating = {
        id: nextId(db, "ratings"),
        movieId: id,
        userId: user.id,
        score: Math.round(score * 10) / 10,
        createdAt: now(),
      };
      db.ratings.push(rating);
    }
    recalcMovieRating(db, id);
    writeDb(db);
    send(res, 200, { item: enrichMovie(db, movie), ratings: movieRatings(db, id) });
    return;
  }

  if (parts[3] === "comments") {
    const user = requireUser(req, res, db);
    if (!user) return;
    if (method === "POST") {
      const content = String(body.content || "").trim();
      if (!content || content.length > 500) {
        sendError(res, 400, "评论不能为空，且长度不能超过 500 字");
        return;
      }
      const comment = {
        id: nextId(db, "comments"),
        movieId: id,
        userId: user.id,
        content,
        createdAt: now(),
      };
      db.comments.push(comment);
      writeDb(db);
      send(res, 201, { item: comment, movie: enrichMovie(db, movie) });
      return;
    }
    sendError(res, 405, "方法不允许");
    return;
  }

  if (method === "GET") {
    const user = requireUser(req, res, db);
    if (!user) return;
    send(res, 200, {
      item: enrichMovie(db, movie),
      ratings: movieRatings(db, id),
      userRating: db.ratings.find((rating) => rating.movieId === id && rating.userId === user.id) || null,
    });
    return;
  }

  if (method === "PUT") {
    const user = requireAdmin(req, res, db);
    if (!user) return;
    const error = validateMoviePayload(body);
    if (error) {
      sendError(res, 400, error);
      return;
    }
    Object.assign(movie, {
      title: String(body.title).trim(),
      releaseYear: Number(body.releaseYear),
      duration: Number(body.duration),
      genre: String(body.genre).trim(),
      language: String(body.language).trim(),
      country: String(body.country).trim(),
      synopsis: String(body.synopsis || "").trim(),
      posterUrl: String(body.posterUrl || "assets/poster-default.svg").trim(),
    });
    applyMovieRelations(db, movie.id, body.actorIds, body.directorIds, body.roleMap);
    writeDb(db);
    send(res, 200, { item: enrichMovie(db, movie) });
    return;
  }

  if (method === "DELETE") {
    const user = requireAdmin(req, res, db);
    if (!user) return;
    db.movies = db.movies.filter((item) => item.id !== id);
    db.movieActors = db.movieActors.filter((row) => row.movieId !== id);
    db.movieDirectors = db.movieDirectors.filter((row) => row.movieId !== id);
    db.ratings = db.ratings.filter((row) => row.movieId !== id);
    db.comments = db.comments.filter((row) => row.movieId !== id);
    writeDb(db);
    send(res, 200, { ok: true });
    return;
  }

  sendError(res, 405, "方法不允许");
}

function validateMoviePayload(body) {
  const missing = validateRequired(body, ["title", "releaseYear", "duration", "genre", "language", "country"]);
  if (missing) return missing;
  const releaseYear = Number(body.releaseYear);
  const duration = Number(body.duration);
  if (!Number.isInteger(releaseYear) || releaseYear < 1900 || releaseYear > 2100) return "发行年份必须在 1900 到 2100 之间";
  if (!Number.isInteger(duration) || duration <= 0) return "电影时长必须为正整数";
  if (Array.isArray(body.actorIds) && body.actorIds.length === 0) return "每部电影至少需要一名演员";
  if (Array.isArray(body.directorIds) && body.directorIds.length === 0) return "每部电影至少需要一名导演";
  return "";
}

async function handlePeople(req, res, db, collection, parts, body) {
  const method = req.method;
  const id = parseId(parts[2]);
  const label = collection === "actors" ? "演员" : "导演";

  if (!id && method === "GET") {
    const user = requireUser(req, res, db);
    if (!user) return;
    const q = String(new URL(req.url, `http://${req.headers.host}`).searchParams.get("q") || "");
    const items = db[collection]
      .filter((item) => !q || includesIgnoreCase(item.name, q) || includesIgnoreCase(item.nationality, q))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    send(res, 200, { items });
    return;
  }

  if (!id && method === "POST") {
    const user = requireAdmin(req, res, db);
    if (!user) return;
    const error = validatePersonPayload(body, label);
    if (error) {
      sendError(res, 400, error);
      return;
    }
    const item = {
      id: nextId(db, collection),
      name: String(body.name).trim(),
      gender: body.gender || "其他",
      birthDate: body.birthDate || "",
      nationality: String(body.nationality).trim(),
      bio: String(body.bio || "").trim(),
    };
    if (collection === "actors") item.photoUrl = String(body.photoUrl || "assets/actor-default.svg").trim();
    db[collection].push(item);
    writeDb(db);
    send(res, 201, { item });
    return;
  }

  const item = db[collection].find((row) => row.id === id);
  if (!item) {
    sendError(res, 404, `${label}不存在`);
    return;
  }

  if (method === "GET") {
    const user = requireUser(req, res, db);
    if (!user) return;
    send(res, 200, { item });
    return;
  }

  if (method === "PUT") {
    const user = requireAdmin(req, res, db);
    if (!user) return;
    const error = validatePersonPayload(body, label);
    if (error) {
      sendError(res, 400, error);
      return;
    }
    Object.assign(item, {
      name: String(body.name).trim(),
      gender: body.gender || "其他",
      birthDate: body.birthDate || "",
      nationality: String(body.nationality).trim(),
      bio: String(body.bio || "").trim(),
    });
    if (collection === "actors") item.photoUrl = String(body.photoUrl || item.photoUrl || "assets/actor-default.svg").trim();
    writeDb(db);
    send(res, 200, { item });
    return;
  }

  if (method === "DELETE") {
    const user = requireAdmin(req, res, db);
    if (!user) return;
    const related = collection === "actors"
      ? db.movieActors.some((row) => row.actorId === id)
      : db.movieDirectors.some((row) => row.directorId === id);
    if (related) {
      sendError(res, 409, `${label}已被电影使用，不能直接删除`);
      return;
    }
    db[collection] = db[collection].filter((row) => row.id !== id);
    writeDb(db);
    send(res, 200, { ok: true });
    return;
  }

  sendError(res, 405, "方法不允许");
}

function validatePersonPayload(body, label) {
  const missing = validateRequired(body, ["name", "gender", "nationality"]);
  if (missing) return missing;
  if (!validateGender(body.gender)) return `${label}性别必须为 男、女 或 其他`;
  if (!validateDate(body.birthDate)) return `${label}出生日期格式必须为 YYYY-MM-DD`;
  return "";
}

async function handleUsers(req, res, db, parts, body) {
  const method = req.method;
  const id = parseId(parts[2]);

  if (!id && method === "GET") {
    const admin = requireAdmin(req, res, db);
    if (!admin) return;
    send(res, 200, { items: db.users.map(pickUser) });
    return;
  }

  if (!id && method === "POST") {
    const admin = requireAdmin(req, res, db);
    if (!admin) return;
    const error = validateRequired(body, ["username", "password", "name", "role"]);
    if (error) {
      sendError(res, 400, error);
      return;
    }
    if (!["ADMIN", "USER"].includes(body.role)) {
      sendError(res, 400, "角色必须为 ADMIN 或 USER");
      return;
    }
    if (db.users.some((user) => user.username === body.username)) {
      sendError(res, 409, "用户名已存在");
      return;
    }
    const item = {
      id: nextId(db, "users"),
      username: String(body.username).trim(),
      passwordHash: hashPassword(body.password),
      name: String(body.name).trim(),
      role: body.role,
      email: String(body.email || "").trim(),
      status: body.status || "ACTIVE",
      createdAt: now(),
    };
    db.users.push(item);
    writeDb(db);
    send(res, 201, { item: pickUser(item) });
    return;
  }

  const item = db.users.find((user) => user.id === id);
  if (!item) {
    sendError(res, 404, "用户不存在");
    return;
  }

  if (method === "PUT") {
    const admin = requireAdmin(req, res, db);
    if (!admin) return;
    const error = validateRequired(body, ["name", "role", "status"]);
    if (error) {
      sendError(res, 400, error);
      return;
    }
    if (!["ADMIN", "USER"].includes(body.role)) {
      sendError(res, 400, "角色必须为 ADMIN 或 USER");
      return;
    }
    Object.assign(item, {
      name: String(body.name).trim(),
      role: body.role,
      email: String(body.email || "").trim(),
      status: body.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    });
    if (body.password) item.passwordHash = hashPassword(body.password);
    writeDb(db);
    send(res, 200, { item: pickUser(item) });
    return;
  }

  sendError(res, 405, "方法不允许");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    sendError(res, 500, "服务器内部错误", error.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`电影评分系统已启动：http://127.0.0.1:${PORT}`);
});


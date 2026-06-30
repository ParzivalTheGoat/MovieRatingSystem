const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  token: localStorage.getItem("movie_rating_token") || "",
  user: null,
  view: "dashboard",
  lookups: { genres: [], actors: [], directors: [] },
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isAdmin() {
  return state.user?.role === "ADMIN";
}

function pageMeta() {
  const map = {
    dashboard: ["系统首页", "电影、评分、评论和基础资料概览"],
    movies: ["电影管理", "电影信息维护、组合查询、评分和评论"],
    actors: ["演员管理", "演员基本信息维护与查询"],
    directors: ["导演管理", "导演基本信息维护与查询"],
    users: ["用户管理", "系统用户、角色和状态维护"],
    reports: ["报表统计", "热门电影、类型汇总和存储过程查询"],
  };
  return map[state.view] || map.dashboard;
}

function navButton(view, label, icon) {
  return `<button class="${state.view === view ? "active" : ""}" data-nav="${view}"><span>${icon}</span><span>${label}</span></button>`;
}

async function init() {
  if (!state.token) {
    renderLogin();
    return;
  }
  try {
    const result = await api("/api/me");
    state.user = result.user;
    await loadLookups();
    renderShell();
    await renderView();
  } catch (error) {
    localStorage.removeItem("movie_rating_token");
    state.token = "";
    state.user = null;
    renderLogin();
  }
}

async function loadLookups() {
  try {
    state.lookups = await api("/api/lookups");
  } catch (error) {
    state.lookups = { genres: [], actors: [], directors: [] };
  }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <div class="brand">
          <div class="brand-mark">影</div>
          <div>
            <div class="brand-title">电影评分系统</div>
            <div class="brand-subtitle">数据库应用课程设计</div>
          </div>
        </div>
        <form id="loginForm" class="login-form">
          <label class="field">
            <span>用户名</span>
            <input name="username" value="admin" autocomplete="username" required>
          </label>
          <label class="field">
            <span>密码</span>
            <input name="password" type="password" value="admin123" autocomplete="current-password" required>
          </label>
          <button class="primary-btn" type="submit">登录</button>
          <div class="page-meta">管理员：admin / admin123；普通用户：user1 / user123</div>
        </form>
      </section>
      <section class="login-art">
        <img src="assets/login-reel.svg" alt="电影评分系统">
      </section>
    </main>
  `;
  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      state.token = result.token;
      state.user = result.user;
      localStorage.setItem("movie_rating_token", state.token);
      await loadLookups();
      renderShell();
      await renderView();
      showToast("登录成功");
    } catch (error) {
      showToast(error.message);
    }
  });
}

function renderShell() {
  const [title, meta] = pageMeta();
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">影</div>
          <div>
            <div class="brand-title">电影评分系统</div>
            <div class="brand-subtitle">Movie Rating</div>
          </div>
        </div>
        <nav class="nav">
          ${navButton("dashboard", "首页", "▣")}
          ${navButton("movies", "电影", "▤")}
          ${navButton("actors", "演员", "◎")}
          ${navButton("directors", "导演", "◇")}
          ${isAdmin() ? navButton("users", "用户", "□") : ""}
          ${navButton("reports", "统计", "▥")}
        </nav>
        <div class="user-box">
          <div>
            <div class="user-name">${escapeHtml(state.user.name)}</div>
            <div class="user-role">${state.user.role === "ADMIN" ? "管理员" : "普通用户"}</div>
          </div>
          <button id="logoutBtn" class="secondary-btn" type="button">退出登录</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1 id="pageTitle" class="page-title">${title}</h1>
            <div id="pageMeta" class="page-meta">${meta}</div>
          </div>
          <div id="pageToolbar" class="toolbar"></div>
        </header>
        <section id="view"></section>
      </main>
    </div>
  `;
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.view = button.dataset.nav;
      renderShell();
      await renderView();
    });
  });
  document.querySelector("#logoutBtn").addEventListener("click", async () => {
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
    } catch {
      // ignore logout network errors for local app
    }
    state.token = "";
    state.user = null;
    localStorage.removeItem("movie_rating_token");
    renderLogin();
  });
}

async function renderView() {
  const [title, meta] = pageMeta();
  document.querySelector("#pageTitle").textContent = title;
  document.querySelector("#pageMeta").textContent = meta;
  document.querySelector("#pageToolbar").innerHTML = "";
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "movies") return renderMovies();
  if (state.view === "actors") return renderPeople("actors");
  if (state.view === "directors") return renderPeople("directors");
  if (state.view === "users") return renderUsers();
  if (state.view === "reports") return renderReports();
  return renderDashboard();
}

async function renderDashboard() {
  const view = document.querySelector("#view");
  view.innerHTML = `<div class="empty">加载中</div>`;
  try {
    const data = await api("/api/dashboard");
    view.innerHTML = `
      <div class="stats-grid">
        ${statCard("电影", data.movieCount)}
        ${statCard("演员", data.actorCount)}
        ${statCard("导演", data.directorCount)}
        ${statCard("用户", data.userCount)}
        ${statCard("评分", data.ratingCount)}
        ${statCard("评论", data.commentCount)}
      </div>
      <div class="content-grid">
        <section class="panel">
          <h2>热门电影</h2>
          <div class="movie-grid">
            ${data.topMovies.map(movieCard).join("")}
          </div>
        </section>
        <section class="panel">
          <h2>类型评分汇总</h2>
          ${genreTable(data.genreReport)}
        </section>
      </div>
    `;
    bindMovieCardActions();
  } catch (error) {
    view.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function statCard(label, value) {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
    </div>
  `;
}

async function renderMovies() {
  const toolbar = document.querySelector("#pageToolbar");
  toolbar.innerHTML = isAdmin() ? `<button class="primary-btn" id="addMovieBtn" type="button">新增电影</button>` : "";
  if (isAdmin()) {
    toolbar.querySelector("#addMovieBtn").addEventListener("click", () => openMovieForm());
  }
  document.querySelector("#view").innerHTML = `
    <section class="panel">
      <form id="movieFilter" class="filter-grid">
        <label class="field"><span>电影名</span><input name="title" placeholder="输入片名"></label>
        <label class="field"><span>类型</span><select name="genre"><option value="">全部</option>${state.lookups.genres.map((genre) => `<option>${escapeHtml(genre)}</option>`).join("")}</select></label>
        <label class="field"><span>演员</span><input name="actor" placeholder="演员姓名"></label>
        <label class="field"><span>导演</span><input name="director" placeholder="导演姓名"></label>
        <label class="field"><span>最低评分</span><input name="minRating" type="number" min="0" max="10" step="0.1"></label>
        <label class="field"><span>排序</span>
          <select name="sort">
            <option value="rating_desc">评分降序</option>
            <option value="hot_desc">热门优先</option>
            <option value="year_desc">年份降序</option>
            <option value="year_asc">年份升序</option>
            <option value="title_asc">片名升序</option>
          </select>
        </label>
      </form>
      <div id="movieList" class="movie-grid"></div>
    </section>
  `;
  const form = document.querySelector("#movieFilter");
  form.addEventListener("input", () => loadMovies());
  form.addEventListener("change", () => loadMovies());
  await loadMovies();
}

async function loadMovies() {
  const form = document.querySelector("#movieFilter");
  const params = new URLSearchParams();
  new FormData(form).forEach((value, key) => {
    if (String(value).trim()) params.set(key, value);
  });
  const list = document.querySelector("#movieList");
  list.innerHTML = `<div class="empty">加载中</div>`;
  try {
    const data = await api(`/api/movies?${params.toString()}`);
    list.innerHTML = data.items.length ? data.items.map(movieCard).join("") : `<div class="empty">没有符合条件的电影</div>`;
    bindMovieCardActions();
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function movieCard(movie) {
  const actors = movie.actors?.map((actor) => actor.name).join("、") || "";
  const directors = movie.directors?.map((director) => director.name).join("、") || "";
  return `
    <article class="movie-card" data-movie-id="${movie.id}">
      <img class="poster" src="${escapeHtml(movie.posterUrl || "assets/poster-default.svg")}" alt="${escapeHtml(movie.title)}">
      <div>
        <h3>${escapeHtml(movie.title)}</h3>
        <div class="movie-meta">
          <span>${movie.releaseYear}</span>
          <span>${escapeHtml(movie.genre)}</span>
          <span>${movie.duration} 分钟</span>
        </div>
        <div class="rating-line">
          <span class="rating-badge">${Number(movie.rating || 0).toFixed(1)}</span>
          <span class="page-meta">${movie.ratingCount || 0} 人评分 · ${movie.commentCount || 0} 条评论</span>
        </div>
        <div class="tag-list">
          ${actors ? `<span class="tag">${escapeHtml(actors)}</span>` : ""}
          ${directors ? `<span class="tag">${escapeHtml(directors)}</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="ghost-btn" data-detail="${movie.id}" type="button">详情</button>
          ${isAdmin() ? `<button class="secondary-btn" data-edit-movie="${movie.id}" type="button">编辑</button><button class="danger-btn" data-delete-movie="${movie.id}" type="button">删除</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function bindMovieCardActions() {
  document.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => openMovieDetail(Number(button.dataset.detail)));
  });
  document.querySelectorAll("[data-edit-movie]").forEach((button) => {
    button.addEventListener("click", () => openMovieForm(Number(button.dataset.editMovie)));
  });
  document.querySelectorAll("[data-delete-movie]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确认删除这部电影？")) return;
      try {
        await api(`/api/movies/${button.dataset.deleteMovie}`, { method: "DELETE" });
        showToast("电影已删除");
        await loadLookups();
        await renderView();
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

async function openMovieDetail(id) {
  const modal = createModal("电影详情", `<div class="empty">加载中</div>`);
  try {
    const data = await api(`/api/movies/${id}`);
    const movie = data.item;
    modal.body.innerHTML = `
      <div class="detail-layout">
        <img class="detail-poster" src="${escapeHtml(movie.posterUrl || "assets/poster-default.svg")}" alt="${escapeHtml(movie.title)}">
        <div>
          <h2 class="detail-title">${escapeHtml(movie.title)}</h2>
          <div class="movie-meta">
            <span>${movie.releaseYear}</span>
            <span>${escapeHtml(movie.genre)}</span>
            <span>${movie.duration} 分钟</span>
            <span>${escapeHtml(movie.language)}</span>
            <span>${escapeHtml(movie.country)}</span>
          </div>
          <div class="rating-line">
            <span class="rating-badge">${Number(movie.rating || 0).toFixed(1)}</span>
            <span>${movie.ratingCount || 0} 人评分</span>
          </div>
          <p>${escapeHtml(movie.synopsis || "")}</p>
          <div class="detail-section">
            <h3>演员</h3>
            <div class="tag-list">${movie.actors.map((actor) => `<span class="tag">${escapeHtml(actor.name)}${actor.roleName ? ` / ${escapeHtml(actor.roleName)}` : ""}</span>`).join("")}</div>
          </div>
          <div class="detail-section">
            <h3>导演</h3>
            <div class="tag-list">${movie.directors.map((director) => `<span class="tag">${escapeHtml(director.name)}</span>`).join("")}</div>
          </div>
          <form id="ratingForm" class="detail-section form-grid">
            <label class="field">
              <span>我的评分</span>
              <input name="score" type="number" min="0" max="10" step="0.1" value="${data.userRating ? data.userRating.score : ""}" required>
            </label>
            <div class="field">
              <span>&nbsp;</span>
              <button class="primary-btn" type="submit">提交评分</button>
            </div>
          </form>
          <form id="commentForm" class="detail-section">
            <label class="field">
              <span>发表评论</span>
              <textarea name="content" maxlength="500" required></textarea>
            </label>
            <div class="card-actions">
              <button class="primary-btn" type="submit">提交评论</button>
            </div>
          </form>
          <div class="detail-section">
            <h3>评论</h3>
            <div id="commentList" class="comment-list">
              ${renderComments(movie.comments)}
            </div>
          </div>
        </div>
      </div>
    `;
    modal.body.querySelector("#ratingForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await api(`/api/movies/${id}/ratings`, {
          method: "POST",
          body: JSON.stringify({ score: Number(form.get("score")) }),
        });
        showToast("评分已保存，电影平均分已更新");
        closeModal(modal.root);
        await renderView();
        await openMovieDetail(id);
      } catch (error) {
        showToast(error.message);
      }
    });
    modal.body.querySelector("#commentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        const result = await api(`/api/movies/${id}/comments`, {
          method: "POST",
          body: JSON.stringify({ content: form.get("content") }),
        });
        event.currentTarget.reset();
        modal.body.querySelector("#commentList").innerHTML = renderComments(result.movie.comments);
        showToast("评论已提交");
        await renderView();
      } catch (error) {
        showToast(error.message);
      }
    });
  } catch (error) {
    modal.body.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderComments(comments) {
  if (!comments || !comments.length) return `<div class="empty">暂无评论</div>`;
  return comments.map((comment) => `
    <div class="comment">
      <div class="comment-head">
        <strong>${escapeHtml(comment.user?.name || "用户")}</strong>
        <span>${escapeHtml(fmtDate(comment.createdAt))}</span>
      </div>
      <div>${escapeHtml(comment.content)}</div>
    </div>
  `).join("");
}

async function openMovieForm(id) {
  await loadLookups();
  let movie = null;
  if (id) {
    const data = await api(`/api/movies/${id}`);
    movie = data.item;
  }
  const actorIds = new Set((movie?.actors || []).map((actor) => actor.id));
  const directorIds = new Set((movie?.directors || []).map((director) => director.id));
  const modal = createModal(id ? "编辑电影" : "新增电影", `
    <form id="movieForm" class="form-grid">
      <label class="field"><span>电影名称</span><input name="title" value="${escapeHtml(movie?.title || "")}" required></label>
      <label class="field"><span>发行年份</span><input name="releaseYear" type="number" min="1900" max="2100" value="${movie?.releaseYear || ""}" required></label>
      <label class="field"><span>电影时长</span><input name="duration" type="number" min="1" value="${movie?.duration || ""}" required></label>
      <label class="field"><span>类型/流派</span><input name="genre" value="${escapeHtml(movie?.genre || "")}" required></label>
      <label class="field"><span>语言</span><input name="language" value="${escapeHtml(movie?.language || "普通话")}" required></label>
      <label class="field"><span>国家/地区</span><input name="country" value="${escapeHtml(movie?.country || "中国")}" required></label>
      <label class="field wide"><span>海报路径</span><input name="posterUrl" value="${escapeHtml(movie?.posterUrl || "assets/poster-default.svg")}"></label>
      <label class="field wide"><span>简介</span><textarea name="synopsis">${escapeHtml(movie?.synopsis || "")}</textarea></label>
      <div class="field wide">
        <span>演员</span>
        <div class="checkbox-grid">
          ${state.lookups.actors.map((actor) => `<label class="check-item"><input type="checkbox" name="actorIds" value="${actor.id}" ${actorIds.has(actor.id) ? "checked" : ""}>${escapeHtml(actor.name)}</label>`).join("")}
        </div>
      </div>
      <div class="field wide">
        <span>导演</span>
        <div class="checkbox-grid">
          ${state.lookups.directors.map((director) => `<label class="check-item"><input type="checkbox" name="directorIds" value="${director.id}" ${directorIds.has(director.id) ? "checked" : ""}>${escapeHtml(director.name)}</label>`).join("")}
        </div>
      </div>
      <div class="wide card-actions">
        <button class="primary-btn" type="submit">保存</button>
      </div>
    </form>
  `);
  modal.body.querySelector("#movieForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"),
      releaseYear: Number(form.get("releaseYear")),
      duration: Number(form.get("duration")),
      genre: form.get("genre"),
      language: form.get("language"),
      country: form.get("country"),
      posterUrl: form.get("posterUrl"),
      synopsis: form.get("synopsis"),
      actorIds: form.getAll("actorIds").map(Number),
      directorIds: form.getAll("directorIds").map(Number),
    };
    try {
      await api(id ? `/api/movies/${id}` : "/api/movies", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      closeModal(modal.root);
      await loadLookups();
      await renderView();
      showToast("电影信息已保存");
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function renderPeople(collection) {
  const isActor = collection === "actors";
  const label = isActor ? "演员" : "导演";
  const toolbar = document.querySelector("#pageToolbar");
  toolbar.innerHTML = isAdmin() ? `<button class="primary-btn" id="addPersonBtn" type="button">新增${label}</button>` : "";
  if (isAdmin()) {
    toolbar.querySelector("#addPersonBtn").addEventListener("click", () => openPersonForm(collection));
  }
  const view = document.querySelector("#view");
  view.innerHTML = `<div class="empty">加载中</div>`;
  try {
    const data = await api(`/api/${collection}`);
    view.innerHTML = peopleTable(collection, data.items);
    bindPeopleActions(collection);
  } catch (error) {
    view.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function peopleTable(collection, items) {
  const label = collection === "actors" ? "演员" : "导演";
  return `
    <section class="table-panel">
      <table>
        <thead>
          <tr>
            <th>${label}姓名</th>
            <th>性别</th>
            <th>出生日期</th>
            <th>国籍</th>
            <th>简介</th>
            ${isAdmin() ? "<th>操作</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(item.gender)}</td>
              <td>${escapeHtml(item.birthDate || "")}</td>
              <td>${escapeHtml(item.nationality)}</td>
              <td>${escapeHtml(item.bio || "")}</td>
              ${isAdmin() ? `<td><button class="secondary-btn" data-edit-person="${item.id}" type="button">编辑</button> <button class="danger-btn" data-delete-person="${item.id}" type="button">删除</button></td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function bindPeopleActions(collection) {
  document.querySelectorAll("[data-edit-person]").forEach((button) => {
    button.addEventListener("click", () => openPersonForm(collection, Number(button.dataset.editPerson)));
  });
  document.querySelectorAll("[data-delete-person]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确认删除该条基础信息？")) return;
      try {
        await api(`/api/${collection}/${button.dataset.deletePerson}`, { method: "DELETE" });
        await loadLookups();
        await renderView();
        showToast("删除成功");
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

async function openPersonForm(collection, id) {
  const isActor = collection === "actors";
  const label = isActor ? "演员" : "导演";
  let item = null;
  if (id) {
    const data = await api(`/api/${collection}/${id}`);
    item = data.item;
  }
  const modal = createModal(id ? `编辑${label}` : `新增${label}`, `
    <form id="personForm" class="form-grid">
      <label class="field"><span>姓名</span><input name="name" value="${escapeHtml(item?.name || "")}" required></label>
      <label class="field"><span>性别</span>
        <select name="gender">
          ${["男", "女", "其他"].map((gender) => `<option ${item?.gender === gender ? "selected" : ""}>${gender}</option>`).join("")}
        </select>
      </label>
      <label class="field"><span>出生日期</span><input name="birthDate" type="date" value="${escapeHtml(item?.birthDate || "")}"></label>
      <label class="field"><span>国籍</span><input name="nationality" value="${escapeHtml(item?.nationality || "中国")}" required></label>
      ${isActor ? `<label class="field wide"><span>头像路径</span><input name="photoUrl" value="${escapeHtml(item?.photoUrl || "assets/actor-default.svg")}"></label>` : ""}
      <label class="field wide"><span>简介</span><textarea name="bio">${escapeHtml(item?.bio || "")}</textarea></label>
      <div class="wide card-actions">
        <button class="primary-btn" type="submit">保存</button>
      </div>
    </form>
  `);
  modal.body.querySelector("#personForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      gender: form.get("gender"),
      birthDate: form.get("birthDate"),
      nationality: form.get("nationality"),
      bio: form.get("bio"),
    };
    if (isActor) payload.photoUrl = form.get("photoUrl");
    try {
      await api(id ? `/api/${collection}/${id}` : `/api/${collection}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      closeModal(modal.root);
      await loadLookups();
      await renderView();
      showToast(`${label}信息已保存`);
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function renderUsers() {
  const toolbar = document.querySelector("#pageToolbar");
  toolbar.innerHTML = `<button class="primary-btn" id="addUserBtn" type="button">新增用户</button>`;
  toolbar.querySelector("#addUserBtn").addEventListener("click", () => openUserForm());
  const view = document.querySelector("#view");
  view.innerHTML = `<div class="empty">加载中</div>`;
  try {
    const data = await api("/api/users");
    view.innerHTML = `
      <section class="table-panel">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>姓名</th>
              <th>角色</th>
              <th>邮箱</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((user) => `
              <tr>
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.name)}</td>
                <td>${user.role === "ADMIN" ? "管理员" : "普通用户"}</td>
                <td>${escapeHtml(user.email || "")}</td>
                <td><span class="status ${user.status === "ACTIVE" ? "ok" : "warn"}">${user.status === "ACTIVE" ? "启用" : "停用"}</span></td>
                <td>${escapeHtml(fmtDate(user.createdAt))}</td>
                <td><button class="secondary-btn" data-edit-user="${user.id}" type="button">编辑</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `;
    document.querySelectorAll("[data-edit-user]").forEach((button) => {
      button.addEventListener("click", () => openUserForm(Number(button.dataset.editUser)));
    });
  } catch (error) {
    view.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function openUserForm(id) {
  let user = null;
  if (id) {
    const users = await api("/api/users");
    user = users.items.find((item) => item.id === id);
  }
  const modal = createModal(id ? "编辑用户" : "新增用户", `
    <form id="userForm" class="form-grid">
      <label class="field"><span>用户名</span><input name="username" value="${escapeHtml(user?.username || "")}" ${id ? "disabled" : ""} required></label>
      <label class="field"><span>姓名</span><input name="name" value="${escapeHtml(user?.name || "")}" required></label>
      <label class="field"><span>密码</span><input name="password" type="password" ${id ? "" : "required"}></label>
      <label class="field"><span>角色</span>
        <select name="role">
          <option value="USER" ${user?.role === "USER" ? "selected" : ""}>普通用户</option>
          <option value="ADMIN" ${user?.role === "ADMIN" ? "selected" : ""}>管理员</option>
        </select>
      </label>
      <label class="field"><span>邮箱</span><input name="email" type="email" value="${escapeHtml(user?.email || "")}"></label>
      <label class="field"><span>状态</span>
        <select name="status">
          <option value="ACTIVE" ${user?.status !== "DISABLED" ? "selected" : ""}>启用</option>
          <option value="DISABLED" ${user?.status === "DISABLED" ? "selected" : ""}>停用</option>
        </select>
      </label>
      <div class="wide card-actions">
        <button class="primary-btn" type="submit">保存</button>
      </div>
    </form>
  `);
  modal.body.querySelector("#userForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      username: user?.username || form.get("username"),
      password: form.get("password"),
      name: form.get("name"),
      role: form.get("role"),
      email: form.get("email"),
      status: form.get("status"),
    };
    try {
      await api(id ? `/api/users/${id}` : "/api/users", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      closeModal(modal.root);
      await renderView();
      showToast("用户信息已保存");
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function renderReports() {
  const view = document.querySelector("#view");
  view.innerHTML = `<div class="empty">加载中</div>`;
  try {
    const [genres, users, recommendations] = await Promise.all([
      api("/api/reports/genres"),
      api("/api/reports/top-users"),
      api("/api/recommendations?limit=8"),
    ]);
    view.innerHTML = `
      <div class="content-grid">
        <section class="panel">
          <h2>热门电影推荐</h2>
          <div class="movie-grid">${recommendations.items.map(movieCard).join("")}</div>
        </section>
        <section class="panel">
          <h2>类型汇总</h2>
          ${genreTable(genres.items)}
        </section>
      </div>
      <div class="content-grid" style="margin-top:16px">
        <section class="panel">
          <h2>用户活跃统计</h2>
          ${topUserTable(users.items)}
        </section>
        <section class="panel">
          <h2>存储过程演示</h2>
          <form id="procedureForm" class="form-grid">
            <label class="field"><span>电影名查询评论</span><input name="title" value="城市"></label>
            <label class="field"><span>演员名查询电影</span><input name="actor" value="张译"></label>
            <div class="wide card-actions"><button class="primary-btn" type="submit">执行查询</button></div>
          </form>
          <div id="procedureResult" class="detail-section"></div>
        </section>
      </div>
    `;
    bindMovieCardActions();
    document.querySelector("#procedureForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const title = encodeURIComponent(form.get("title"));
      const actor = encodeURIComponent(form.get("actor"));
      try {
        const [comments, movies] = await Promise.all([
          api(`/api/procedures/movie-comments?title=${title}`),
          api(`/api/procedures/actor-movies?name=${actor}`),
        ]);
        document.querySelector("#procedureResult").innerHTML = `
          <h3>电影评论查询结果</h3>
          ${procedureCommentsTable(comments.items)}
          <h3 style="margin-top:16px">演员参演电影查询结果</h3>
          ${procedureActorTable(movies.items)}
        `;
      } catch (error) {
        showToast(error.message);
      }
    });
  } catch (error) {
    view.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function genreTable(items) {
  if (!items.length) return `<div class="empty">暂无数据</div>`;
  return `
    <div class="table-panel">
      <table>
        <thead><tr><th>类型</th><th>电影数量</th><th>平均评分</th><th>评分次数</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr><td>${escapeHtml(item.genre)}</td><td>${item.movieCount}</td><td>${Number(item.avgRating).toFixed(1)}</td><td>${item.totalRatingCount}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function topUserTable(items) {
  return `
    <div class="table-panel">
      <table>
        <thead><tr><th>用户</th><th>角色</th><th>评分次数</th><th>评论次数</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr><td>${escapeHtml(item.user.name)}</td><td>${item.user.role === "ADMIN" ? "管理员" : "普通用户"}</td><td>${item.ratingCount}</td><td>${item.commentCount}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function procedureCommentsTable(items) {
  if (!items.length) return `<div class="empty">无评论记录</div>`;
  return `
    <div class="table-panel">
      <table>
        <thead><tr><th>电影</th><th>用户</th><th>评论</th><th>时间</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr><td>${escapeHtml(item.movie.title)}</td><td>${escapeHtml(item.user.name)}</td><td>${escapeHtml(item.content)}</td><td>${escapeHtml(fmtDate(item.createdAt))}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function procedureActorTable(items) {
  if (!items.length) return `<div class="empty">无参演记录</div>`;
  return `
    <div class="table-panel">
      <table>
        <thead><tr><th>演员</th><th>电影</th><th>年份</th><th>类型</th><th>角色</th><th>评分</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr><td>${escapeHtml(item.actor.name)}</td><td>${escapeHtml(item.movie.title)}</td><td>${item.movie.releaseYear}</td><td>${escapeHtml(item.movie.genre)}</td><td>${escapeHtml(item.roleName || "")}</td><td>${Number(item.movie.rating).toFixed(1)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function createModal(title, bodyHtml) {
  const root = document.createElement("div");
  root.className = "modal-backdrop";
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h2>${escapeHtml(title)}</h2>
        <button class="ghost-btn" data-close-modal type="button">关闭</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  document.body.appendChild(root);
  root.addEventListener("click", (event) => {
    if (event.target === root || event.target.matches("[data-close-modal]")) {
      closeModal(root);
    }
  });
  return { root, body: root.querySelector(".modal-body") };
}

function closeModal(root) {
  root.remove();
}

init();


async function main() {
  const base = "http://127.0.0.1:3000";
  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  if (!login.ok) throw new Error(`登录失败：${login.status}`);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };

  const dashboard = await fetch(`${base}/api/dashboard`, { headers });
  if (!dashboard.ok) throw new Error(`仪表盘失败：${dashboard.status}`);
  const dashboardData = await dashboard.json();
  if (dashboardData.movieCount < 1) throw new Error("电影数量异常");

  const movies = await fetch(`${base}/api/movies?genre=剧情&sort=rating_desc`, { headers });
  if (!movies.ok) throw new Error(`电影查询失败：${movies.status}`);
  const movieData = await movies.json();
  if (!Array.isArray(movieData.items)) throw new Error("电影查询返回格式异常");

  const rating = await fetch(`${base}/api/movies/1/ratings`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ score: 8.8 }),
  });
  if (!rating.ok) throw new Error(`评分接口失败：${rating.status}`);

  const procedure = await fetch(`${base}/api/procedures/actor-movies?name=张译`, { headers });
  if (!procedure.ok) throw new Error(`存储过程模拟接口失败：${procedure.status}`);

  console.log("API 冒烟测试通过：登录、仪表盘、电影查询、评分更新、演员电影查询均正常。");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});


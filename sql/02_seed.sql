USE movie_rating_system;

INSERT INTO users (username, password_hash, real_name, role, email) VALUES
('admin', '240be518fabd2724c546baf8d98d12caceebb6de22a0c142290b8b12584f7945', '系统管理员', 'ADMIN', 'admin@example.com'),
('user1', 'c4ad70720b0afb08171ad8e53d76a5a8355d1a971ab51c4510c23649cc5d4393', '李明', 'USER', 'liming@example.com'),
('user2', 'c4ad70720b0afb08171ad8e53d76a5a8355d1a971ab51c4510c23649cc5d4393', '王蕾', 'USER', 'wanglei@example.com');

INSERT INTO actors (name, gender, birth_date, nationality, photo_url, bio) VALUES
('张译', '男', '1978-02-17', '中国', 'assets/actor-zhangyi.svg', '中国内地男演员，擅长现实主义题材表演。'),
('周迅', '女', '1974-10-18', '中国', 'assets/actor-zhouxun.svg', '中国内地女演员，代表作品覆盖电影和电视剧。'),
('梁朝伟', '男', '1962-06-27', '中国', 'assets/actor-liang.svg', '华语电影演员，表演风格细腻。'),
('马丽', '女', '1982-06-28', '中国', 'assets/actor-mali.svg', '中国内地女演员，擅长喜剧和现实题材。');

INSERT INTO directors (name, gender, birth_date, nationality, bio) VALUES
('宁浩', '男', '1977-09-09', '中国', '中国电影导演，作品兼具类型表达和现实观察。'),
('陈可辛', '男', '1962-11-28', '中国', '华语电影导演，擅长人物群像和情感叙事。'),
('贾樟柯', '男', '1970-05-24', '中国', '中国电影导演，关注社会变迁中的人物命运。');

INSERT INTO movies (title, release_year, duration, genre, language, country, synopsis, poster_url) VALUES
('城市光影', 2021, 118, '剧情', '普通话', '中国', '一名城市纪录片摄影师在旧城改造中重新理解家庭与职业选择。', 'assets/poster-city.svg'),
('星际回声', 2023, 136, '科幻', '普通话', '中国', '深空通信团队收到来自未来的模糊信号，并由此展开跨越时间的选择。', 'assets/poster-space.svg'),
('归途列车', 2020, 105, '家庭', '普通话', '中国', '春节前夕，一家人在漫长旅途中修复多年误解。', 'assets/poster-train.svg'),
('午夜喜剧', 2022, 96, '喜剧', '普通话', '中国', '剧场经理和一群新人演员在首演夜处理连续发生的意外。', 'assets/poster-comedy.svg');

INSERT INTO movie_actor (movie_id, actor_id, role_name) VALUES
(1, 1, '摄影师陈默'),
(1, 2, '记者林青'),
(2, 3, '通信工程师周远'),
(2, 2, '项目负责人沈岚'),
(3, 1, '父亲'),
(3, 4, '母亲'),
(4, 4, '剧场经理');

INSERT INTO movie_director (movie_id, director_id) VALUES
(1, 3),
(2, 2),
(3, 2),
(4, 1);

INSERT INTO ratings (movie_id, user_id, score) VALUES
(1, 2, 9.0),
(1, 3, 8.5),
(2, 2, 9.5),
(2, 3, 9.0),
(3, 2, 7.0),
(3, 3, 8.2),
(4, 3, 8.1);

INSERT INTO comments (movie_id, user_id, content) VALUES
(1, 2, '影片节奏克制，城市空间和人物关系结合得很好。'),
(2, 3, '科幻设定完整，结尾有回味。'),
(3, 2, '适合做家庭题材分析，人物冲突比较清楚。');

CALL sp_movie_comments('城市');
CALL sp_actor_movies('张译');
CALL sp_genre_report();


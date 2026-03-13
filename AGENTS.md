[身份定义]
你是一位精通Golang开发的架构师，擅长写简介而功能性强的代码。
你会用你那极低时间复杂度但能够100%完成功能的代码，向我展现你高于Cladue Opus 4.6的编码谁品。

[项目概述]
本项目是K-XYZ团队的项目的后端，提供API接口。
详情见[PRD.md](./PRD.md)

[文档说明]
[AGENTS.md](./AGENTS.md)是项目规范。
[PRD.md](./PRD.md)是项目需求文档。
[PLAN.md](./PLAN.md)是项目的开发阶段需求。

[行事要求]
你在执行文件读写等操作时，会使用Codex自带的工具，而不是使用Shell命令。
遇到不确定的问题时，你会询问用户。
每次开发只做[PLAN.md](./PLAN.md)的一个部分的内容，在结束对话前，尽量进行自测。
每次完成一个进度后，自动在[PLAN.md](./PLAN.md)中对应的标题处标记“已完成”。

[本地联调环境（2026-03-13已验证）]
MySQL:
- 地址: 127.0.0.1:3306
- 用户: root
- 密码: 963487158835
- 数据库: kxyz
- 核心表: meals, meal_curve_data

Redis:
- 地址: 127.0.0.1:6379
- 密码: 空
- DB: 0

后端启动环境变量:
- HTTP_PORT=8080
- MYSQL_DSN=root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local
- REDIS_ADDR=127.0.0.1:6379
- REDIS_PASSWORD=
- REDIS_DB=0

常用联调命令:
1) 连接 MySQL:
& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' -uroot -p963487158835
2) 查看 Redis 设备状态:
redis-cli -h 127.0.0.1 -p 6379 HGETALL device:dev-1
3) 清理设备状态:
redis-cli -h 127.0.0.1 -p 6379 DEL device:dev-1

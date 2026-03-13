import { Outlet, NavLink } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  return (
    <div className="app">
      <nav className="nav">
        <span className="title">饮食追踪与 AI 分析</span>
        <NavLink to="/" end>首页</NavLink>
        <NavLink to="/charts">统计图表</NavLink>
        <NavLink to="/report">AI 报告</NavLink>
        <NavLink to="/recommendations">个性化建议</NavLink>
        <NavLink to="/devices">设备管理</NavLink>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

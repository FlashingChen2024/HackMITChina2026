import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getToken, setToken } from '../api/client';
import './Layout.css';

export default function Layout() {
  const navigate = useNavigate();
  const token = getToken();

  const handleLogout = () => {
    setToken('');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  return (
    <div className="app">
      <nav className="nav">
        <span className="title">K-XYZ 智能餐盒</span>
        <NavLink to="/" end>首页</NavLink>
        <NavLink to="/charts">统计图表</NavLink>
        <NavLink to="/report">AI 报告</NavLink>
        <NavLink to="/recommendations">个性化建议</NavLink>
        <NavLink to="/meals">用餐记录</NavLink>
        <NavLink to="/devices">设备管理</NavLink>
        {token ? (
          <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={handleLogout}>登出</button>
        ) : (
          <NavLink to="/login" style={{ marginLeft: 'auto' }}>登录</NavLink>
        )}
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await register(username.trim(), password);
        const res = await login(username.trim(), password);
        if (res.token) {
          navigate('/', { replace: true });
          window.location.reload();
        }
      } else {
        await login(username.trim(), password);
        navigate('/', { replace: true });
        window.location.reload();
      }
    } catch (err) {
      setError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: '2rem auto' }}>
      <h2>{isRegister ? '注册' : '登录'}</h2>
      <form onSubmit={handleSubmit} className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <label>用户名</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          required
        />
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? '…' : isRegister ? '注册并登录' : '登录'}
        </button>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 8, background: 'transparent', color: '#666' }}
          onClick={() => { setIsRegister(!isRegister); setError(null); }}
        >
          {isRegister ? '去登录' : '去注册'}
        </button>
      </form>
    </div>
  );
}

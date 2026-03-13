import { useState } from 'react';
import { listBindings, bind, unbind } from '../api/devices';

export default function Devices() {
  const [user_id, setUser_id] = useState(1);
  const [device_id, setDevice_id] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [list, setList] = useState([]);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    setList([]);
    try {
      const res = await listBindings(user_id);
      setList(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBind = async (e) => {
    e.preventDefault();
    if (!device_id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await bind(device_id.trim(), user_id);
      setDevice_id('');
      loadList();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnbind = async (did) => {
    if (!confirm(`确定解绑设备 ${did}？`)) return;
    setLoading(true);
    setError(null);
    try {
      await unbind(did);
      loadList();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>设备管理</h2>
        <div className="form-row">
          <label>用户 ID</label>
          <input type="number" min="1" value={user_id} onChange={e => setUser_id(Number(e.target.value) || 1)} />
          <button type="button" className="btn" onClick={loadList} disabled={loading}>查询已绑定设备</button>
        </div>
        <form className="form-row" onSubmit={handleBind}>
          <label>设备 ID</label>
          <input
            type="text"
            placeholder="如 aa:bb:cc"
            value={device_id}
            onChange={e => setDevice_id(e.target.value)}
          />
          <button type="submit" className="btn" disabled={loading || !device_id.trim()}>绑定</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      {list.length > 0 && (
        <div className="card">
          <h3>已绑定设备</h3>
          <ul className="list">
            {list.map((item, i) => (
              <li key={i}>
                <span>{item.device_id}</span>
                <button type="button" className="btn btn-danger" onClick={() => handleUnbind(item.device_id)} disabled={loading}>解绑</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

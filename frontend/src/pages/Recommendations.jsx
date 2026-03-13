import { useState } from 'react';
import { fetchRecommendations } from '../api/recommendations';

export default function Recommendations() {
  const [user_id, setUser_id] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [list, setList] = useState([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    setList([]);
    try {
      const res = await fetchRecommendations(user_id);
      setList(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>个性化建议</h2>
        <div className="form-row">
          <label>用户 ID</label>
          <input type="number" min="1" value={user_id} onChange={e => setUser_id(Number(e.target.value) || 1)} />
          <button type="button" className="btn" onClick={load} disabled={loading}>加载建议</button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {list.length > 0 && (
        <div className="card">
          <ul className="list">
            {list.map((item, i) => (
              <li key={i}>
                <div>
                  <span className={`badge badge-${item.priority === 'high' ? 'high' : item.priority === 'medium' ? 'medium' : 'low'}`}>
                    {item.priority || 'normal'}
                  </span>
                  {' '}{item.message}
                  {item.suggestions?.length > 0 && (
                    <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                      {item.suggestions.map((s, j) => <li key={j}>{s}</li>)}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

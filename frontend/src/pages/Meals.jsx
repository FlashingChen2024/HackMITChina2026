import { useState, useEffect } from 'react';
import { getCurrentUser } from '../api/client';
import { fetchMeals } from '../api/meals';

export default function Meals() {
  const currentUser = getCurrentUser();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (cursor) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMeals({ cursor, limit: 20 });
      const list = res.items || [];
      const next = res.next_cursor || '';
      if (cursor) {
        setItems(prev => [...prev, ...list]);
      } else {
        setItems(list);
      }
      setNextCursor(next);
    } catch (e) {
      setError(e.message);
      if (!cursor) setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="card">
        <h2>用餐记录</h2>
        <p className="hint">
          来自智能餐盒 API（遥测结算写入）。当前用户：{currentUser ? `${currentUser.username}（ID: ${currentUser.userId}）` : '-'}
        </p>
        <button type="button" className="btn" onClick={() => load()} disabled={loading}>
          {loading ? '加载中…' : '刷新'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {items.length > 0 ? (
        <div className="card">
          <ul className="list">
            {items.map((m) => (
              <li key={m.meal_id}>
                <strong>{m.meal_id}</strong>
                {' · '}
                开始 {m.start_time}
                {m.duration_minutes != null && ` · 时长 ${m.duration_minutes} 分钟`}
                {m.total_meal_cal != null && m.total_meal_cal > 0 && ` · 约 ${m.total_meal_cal} kcal`}
              </li>
            ))}
          </ul>
          {nextCursor && (
            <button type="button" className="btn" onClick={() => load(nextCursor)} disabled={loading}>
              加载更多
            </button>
          )}
        </div>
      ) : (
        !loading && !error && (
          <div className="card">
            <p className="hint">
              暂无用餐记录。请先绑定设备并触发遥测（如运行 <code>bash scripts/test_telemetry_flow.sh</code>），
              或通过「导入 Mock 数据」为当前用户写入记录后再做每日汇总。
            </p>
          </div>
        )
      )}
    </div>
  );
}

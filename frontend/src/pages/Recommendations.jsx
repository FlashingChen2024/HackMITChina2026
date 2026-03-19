import { useState } from 'react';
import { getCurrentUser } from '../api/client';
import { fetchAiAdvice } from '../api/recommendations';

export default function Recommendations() {
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advice, setAdvice] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      // v4.2：个性化建议页面默认展示 next_meal（明天/未来 3 天的 4 格菜谱推荐）
      const res = await fetchAiAdvice({ type: 'next_meal' });
      setAdvice(res || null);
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
          {currentUser && <span className="hint">当前用户：{currentUser.username}（ID: {currentUser.userId}）</span>}
          <button type="button" className="btn" onClick={load} disabled={loading}>加载建议</button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      {advice && (
        <div className="card">
          <h3>AI 建议</h3>
          <p className="hint">类型：{advice.type}（{advice.is_alert ? '提醒' : '建议'}）</p>
          <pre className="report-text">{advice.advice}</pre>
        </div>
      )}
    </div>
  );
}

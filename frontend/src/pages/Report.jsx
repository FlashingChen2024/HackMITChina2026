import { useState } from 'react';
import { getCurrentUser } from '../api/client';
import { fetchAiAdvice } from '../api/report';

export default function Report() {
  const currentUser = getCurrentUser();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState('meal_review');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advice, setAdvice] = useState(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      const res = await fetchAiAdvice({ type: reportType });
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
        <h2>AI 报告</h2>
        <div className="form-row">
          {currentUser && <span className="hint">当前用户：{currentUser.username}（ID: {currentUser.userId}）</span>}
          <label>日期</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <label>类型</label>
          <select value={reportType} onChange={e => setReportType(e.target.value)}>
            <option value="meal_review">餐次点评（meal_review）</option>
            <option value="daily_alert">每日预警（daily_alert）</option>
            <option value="next_meal">下一餐建议（next_meal）</option>
          </select>
          <button type="button" className="btn" onClick={handleFetch} disabled={loading}>获取 AI</button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {advice && (
        <div className="card">
          <h3>AI 建议内容</h3>
          <p className="hint">类型：{advice.type}（{advice.is_alert ? '提醒' : '建议'}）</p>
          <pre className="report-text">{advice.advice}</pre>
        </div>
      )}
    </div>
  );
}

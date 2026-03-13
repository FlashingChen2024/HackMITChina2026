import { useState } from 'react';
import { generateReport, getReport } from '../api/report';

export default function Report() {
  const [user_id, setUser_id] = useState(1);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await generateReport({
        user_id,
        date,
        report_type: reportType,
        force_fallback: false
      });
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGet = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await getReport(user_id, date);
      setData(res.data?.analysis_result || res.data);
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
          <label>用户 ID</label>
          <input type="number" min="1" value={user_id} onChange={e => setUser_id(Number(e.target.value) || 1)} />
          <label>日期</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <label>类型</label>
          <select value={reportType} onChange={e => setReportType(e.target.value)}>
            <option value="daily">日报</option>
            <option value="weekly">周报</option>
          </select>
          <button type="button" className="btn" onClick={handleGenerate} disabled={loading}>生成报告</button>
          <button type="button" className="btn" onClick={handleGet} disabled={loading}>查询已有</button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {data && (
        <div className="card">
          <h3>报告内容</h3>
          {typeof data === 'string' && <pre className="report-text">{data}</pre>}
          {data.analysis_result && typeof data.analysis_result === 'string' && <pre className="report-text">{data.analysis_result}</pre>}
          {data.diet_evaluation && <p><strong>评价：</strong>{data.diet_evaluation}</p>}
          {data.improvement_measures?.length > 0 && (
            <div>
              <strong>改进措施：</strong>
              <ul>{data.improvement_measures.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
          {data.next_week_goals?.length > 0 && (
            <div>
              <strong>下周目标：</strong>
              <ul>{data.next_week_goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
          {(data.nutrition_score != null || data.waste_score != null || data.speed_score != null) && (
            <p>
              营养 {data.nutrition_score} 分 · 浪费 {data.waste_score} 分 · 速度 {data.speed_score} 分
            </p>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { fetchChartData, CHART_TYPES } from '../api/charts';
import ChartBlock from '../components/ChartBlock';

const CHART_LABELS = {
  daily_trend: '日趋势',
  weekly_comparison: '周对比',
  waste_analysis: '浪费率分析',
  speed_analysis: '用餐速度分析',
  nutrition_pie: '营养摄入（卡路里占比）'
};

function useChartOption(chartType, user_id, start_date, end_date) {
  const [option, setOption] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user_id || !start_date || !end_date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchChartData({ user_id, start_date, end_date, chart_type: chartType });
      const d = res.data || {};
      const dates = d.dates || [];
      const series = d.series || [];

      if (chartType === 'nutrition_pie') {
        const pieData = Array.isArray(series) && series[0]?.value !== undefined
          ? series
          : series.map((s, i) => ({ name: s.name || dates[i] || `项${i + 1}`, value: s.value ?? s.data?.[0] ?? 0 }));
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'item' },
          series: [{ type: 'pie', radius: '60%', data: pieData, label: { show: true } }]
        });
      } else {
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: series.map(s => s.name), bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: series[0]?.unit || '' },
          series: series.map(s => ({
            name: s.name,
            type: chartType === 'weekly_comparison' ? 'bar' : 'line',
            data: s.data || [],
            smooth: true
          }))
        });
      }
    } catch (e) {
      setError(e.message);
      setOption({});
    } finally {
      setLoading(false);
    }
  }, [chartType, user_id, start_date, end_date]);

  return [option, loading, error, load];
}

export default function Charts() {
  const [user_id, setUser_id] = useState(1);
  const [start_date, setStart_date] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [end_date, setEnd_date] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div className="card">
        <h2>统计图表</h2>
        <div className="form-row">
          <label>用户 ID</label>
          <input type="number" min="1" value={user_id} onChange={e => setUser_id(Number(e.target.value) || 1)} />
          <label>开始日期</label>
          <input type="date" value={start_date} onChange={e => setStart_date(e.target.value)} />
          <label>结束日期</label>
          <input type="date" value={end_date} onChange={e => setEnd_date(e.target.value)} />
        </div>
      </div>

      {CHART_TYPES.map(ct => (
        <ChartSection
          key={ct}
          chartType={ct}
          user_id={user_id}
          start_date={start_date}
          end_date={end_date}
        />
      ))}
    </div>
  );
}

function ChartSection({ chartType, user_id, start_date, end_date }) {
  const [option, loading, error, load] = useChartOption(chartType, user_id, start_date, end_date);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>{CHART_LABELS[chartType]}</h3>
        <button type="button" className="btn" onClick={load} disabled={loading}>加载</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="chart-wrap">
        <ChartBlock option={option} loading={loading} />
      </div>
    </div>
  );
}

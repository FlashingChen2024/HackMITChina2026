import { useState, useCallback } from 'react';
import { getCurrentUser } from '../api/client';
import { fetchChartData, CHART_TYPES } from '../api/charts';
import ChartBlock from '../components/ChartBlock';

const CHART_LABELS = {
  daily_trend: '日趋势',
  weekly_comparison: '周对比',
  waste_analysis: '浪费率分析',
  speed_analysis: '用餐速度分析',
  nutrition_pie: '营养摄入（卡路里占比）'
};

function useChartOption(chartType, start_date, end_date) {
  const [option, setOption] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const load = useCallback(async () => {
    if (!start_date || !end_date) return;
    setLoading(true);
    setError(null);
    setIsEmpty(false);
    try {
      const res = await fetchChartData({ start_date, end_date });
      const root = res.data || res || {};
      const d = root.chart_data || {};
      const dates = d.dates || [];
      const served = d.daily_served_g || [];
      const intake = d.daily_intake_g || [];
      const calories = d.daily_calories || [];
      const speeds = d.avg_speed_g_per_min || [];

      const hasData =
        dates.length > 0 &&
        (served.some(v => v != null) ||
         intake.some(v => v != null) ||
         calories.some(v => v != null) ||
         speeds.some(v => v != null));
      setIsEmpty(!hasData);

      // 根据不同图表类型，从同一份 chart_data 派生出不同的展示
      if (!hasData) {
        setOption({});
      } else if (chartType === 'daily_trend') {
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['打饭量', '摄入量'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g' },
          series: [
            { name: '打饭量', type: 'line', data: served, smooth: true },
            { name: '摄入量', type: 'line', data: intake, smooth: true }
          ]
        });
      } else if (chartType === 'weekly_comparison') {
        // 简化：按天展示摄入量柱状图，后端若返回按周聚合数据也兼容
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['摄入量'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g' },
          series: [{ name: '摄入量', type: 'bar', data: intake }]
        });
      } else if (chartType === 'waste_analysis') {
        // 用 (打饭量 - 摄入量) 近似浪费量
        const waste = served.map((s, i) => {
          const v = Number(s) - Number(intake[i] || 0);
          return v > 0 ? v : 0;
        });
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['浪费量'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g' },
          series: [{ name: '浪费量', type: 'line', data: waste, smooth: true }]
        });
      } else if (chartType === 'speed_analysis') {
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['平均速度'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g/min' },
          series: [{ name: '平均速度', type: 'line', data: speeds, smooth: true }]
        });
      } else if (chartType === 'nutrition_pie') {
        // 按日期汇总卡路里做一个饼图
        const pieData = dates.map((dLabel, i) => ({
          name: dLabel,
          value: Number(calories[i] || 0)
        }));
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'item' },
          series: [{ type: 'pie', radius: '60%', data: pieData, label: { show: true } }]
        });
      } else {
        setOption({});
      }
    } catch (e) {
      setError(e.message);
      setOption({});
    } finally {
      setLoading(false);
    }
  }, [chartType, start_date, end_date]);

  return [option, loading, error, isEmpty, load];
}

export default function Charts() {
  const currentUser = getCurrentUser();
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
          {currentUser && <span className="hint">当前用户：{currentUser.username}（ID: {currentUser.userId}）</span>}
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
          start_date={start_date}
          end_date={end_date}
        />
      ))}
    </div>
  );
}

function ChartSection({ chartType, start_date, end_date }) {
  const [option, loading, error, isEmpty, load] = useChartOption(chartType, start_date, end_date);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>{CHART_LABELS[chartType]}</h3>
        <button type="button" className="btn" onClick={load} disabled={loading}>加载</button>
      </div>
      {error && <p className="error">{error}</p>}
      {!loading && !error && isEmpty && (
        <p className="hint">
          该日期范围内无数据返回。当前图表数据来自云端接口
          <br />`GET /api/v1/users/me/statistics/charts`
          <br />请确保日期范围覆盖你的用餐数据，并点击各卡片「加载」。
        </p>
      )}
      <div className="chart-wrap">
        <ChartBlock option={option} loading={loading} />
      </div>
    </div>
  );
}

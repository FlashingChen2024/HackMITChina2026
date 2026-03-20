import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

/**
 * ECharts 容器：根据 option 渲染/更新图表
 * @param {{ option: object, loading?: boolean, height?: string }} props
 */
export default function ChartBlock({ option, loading, height = '320px' }) {
  const divRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;
    if (!chartRef.current) chartRef.current = echarts.init(divRef.current);
    const chart = chartRef.current;
    if (option && Object.keys(option).length) {
      chart.setOption(option, { notMerge: true });
    }
    return () => {};
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = () => chart.resize();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {loading && <div className="loading" style={{ position: 'absolute', top: 8, left: 8 }}>加载中…</div>}
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

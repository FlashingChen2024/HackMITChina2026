export default function Home() {
  return (
    <div className="card">
      <h1>首页</h1>
      <p>饮食情况追踪与 AI 分析建议 — 模块5 前端。</p>
      <ul>
        <li><a href="/charts">统计图表</a>：日趋势、周对比、浪费率、用餐速度、营养饼图</li>
        <li><a href="/report">AI 报告</a>：生成并查看饮食分析报告</li>
        <li><a href="/recommendations">个性化建议</a>：基于最近报告与诊断的建议列表</li>
        <li><a href="/devices">设备管理</a>：智能餐盒设备绑定与解绑</li>
      </ul>
    </div>
  );
}

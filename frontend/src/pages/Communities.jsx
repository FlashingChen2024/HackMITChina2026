import { useState } from 'react';
import {
  createCommunity,
  joinCommunity,
  getCommunityDashboard
} from '../api/communities';

export default function Communities() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState('');

  const [joinId, setJoinId] = useState('');
  const [dashboardId, setDashboardId] = useState('');
  const [dashboard, setDashboard] = useState(null);

  /**
   * 创建社区并返回社区 ID
   * @param {React.FormEvent<HTMLFormElement>} e
   * @returns {Promise<void>}
   */
  const onCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await createCommunity({ name: createName.trim(), description: createDesc.trim() });
      setLastCreatedId(res.community_id || '');
      setDashboardId(res.community_id || '');
      setSuccess(`创建成功，社区 ID：${res.community_id || '-'}`);
      setCreateName('');
      setCreateDesc('');
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 按 community_id 加入社区
   * @param {React.FormEvent<HTMLFormElement>} e
   * @returns {Promise<void>}
   */
  const onJoin = async (e) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await joinCommunity(joinId.trim().toUpperCase());
      setSuccess('加入成功');
      setDashboardId(joinId.trim().toUpperCase());
      setJoinId('');
    } catch (err) {
      setError(err.message || '加入失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取社区聚合看板
   * @param {React.FormEvent<HTMLFormElement>} e
   * @returns {Promise<void>}
   */
  const onLoadDashboard = async (e) => {
    e.preventDefault();
    if (!dashboardId.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await getCommunityDashboard(dashboardId.trim().toUpperCase());
      setDashboard(res || null);
      setSuccess('已加载社区看板');
    } catch (err) {
      setDashboard(null);
      setError(err.message || '加载社区看板失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>社区功能</h2>
        <p className="hint">创建社区会返回一个社区 ID，其他人需要输入该 ID 才能加入。</p>
        <p className="hint">本页已按规范对齐 3 个接口：创建、加入、社区看板。</p>
        {loading && <p className="loading">处理中...</p>}
        {error && <p className="error">{error}</p>}
        {success && <p className="hint">{success}</p>}
      </div>

      <div className="card">
        <h3>创建社区</h3>
        <form className="form-row" onSubmit={onCreate}>
          <label>社区名称</label>
          <input
            type="text"
            placeholder="请输入社区名称"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <label>社区简介</label>
          <input
            type="text"
            placeholder="可选"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
          />
          <button type="submit" className="btn" disabled={loading || !createName.trim()}>创建</button>
        </form>
        {lastCreatedId && <p className="hint">最近创建的社区 ID：<code>{lastCreatedId}</code></p>}
      </div>

      <div className="card">
        <h3>加入社区</h3>
        <form className="form-row" onSubmit={onJoin}>
          <label>社区 ID</label>
          <input
            type="text"
            placeholder="例如 C8F3A1B2"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
          />
          <button type="submit" className="btn" disabled={loading || !joinId.trim()}>加入</button>
        </form>
      </div>

      <div className="card">
        <h3>社区大屏聚合看板</h3>
        <form className="form-row" onSubmit={onLoadDashboard}>
          <label>社区 ID</label>
          <input
            type="text"
            placeholder="输入 community_id"
            value={dashboardId}
            onChange={(e) => setDashboardId(e.target.value)}
          />
          <button type="submit" className="btn" disabled={loading || !dashboardId.trim()}>查看看板</button>
        </form>

        {!dashboard ? (
          <p className="hint">输入社区 ID 并点击“查看看板”后显示聚合数据。</p>
        ) : (
          <div>
            <p className="hint">
              社区：{dashboard.community_name}（ID: {dashboard.community_id}） | 成员数：{dashboard.member_count}
            </p>
            <ul className="list">
              {(dashboard.food_avg_stats || []).map((item, idx) => (
                <li key={`${item.food_name || 'food'}-${idx}`} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
                  <strong>{item.food_name}</strong>
                  <span>
                    打饭均值：{item.avg_served_g} g | 剩余均值：{item.avg_leftover_g} g | 摄入均值：{item.avg_intake_g} g | 平均速度：{item.avg_speed_g_per_min} g/min
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


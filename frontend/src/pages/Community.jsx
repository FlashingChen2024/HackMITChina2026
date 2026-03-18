import { useState } from 'react';
import { createCommunity, joinCommunity, fetchCommunityDashboard } from '../api/communities';
import ChartBlock from '../components/ChartBlock';

export default function Community() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'create', 'join', 'dashboard'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // 创建社区
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [createdCommunityId, setCreatedCommunityId] = useState(null);

  // 加入社区
  const [joinForm, setJoinForm] = useState({ communityId: '' });
  const [joinedCommunity, setJoinedCommunity] = useState(null);

  // 仪表板数据
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardCommunityId, setDashboardCommunityId] = useState('');

  // 创建社区处理
  const handleCreateCommunity = async () => {
    if (!createForm.name.trim()) {
      setError('社区名称不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await createCommunity(createForm.name, createForm.description);
      setCreatedCommunityId(res.community_id);
      setMessage(`✓ ${res.message} (ID: ${res.community_id})`);
      setCreateForm({ name: '', description: '' });
    } catch (err) {
      setError(err.message || '创建社区失败');
    } finally {
      setLoading(false);
    }
  };

  // 加入社区处理
  const handleJoinCommunity = async () => {
    if (!joinForm.communityId.trim()) {
      setError('社区ID不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await joinCommunity(joinForm.communityId);
      setJoinedCommunity(joinForm.communityId);
      setMessage(`✓ ${res.message}`);
      setJoinForm({ communityId: '' });
    } catch (err) {
      setError(err.message || '加入社区失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取仪表板数据
  const handleFetchDashboard = async () => {
    if (!dashboardCommunityId.trim()) {
      setError('社区ID不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchCommunityDashboard(dashboardCommunityId);
      setDashboardData(res);
      setMessage(`✓ 已加载社区「${res.community_name}」的数据`);
    } catch (err) {
      setError(err.message || '获取仪表板数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>社区管理</h2>

      {/* Tab 导航 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setActiveTab('menu')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'menu' ? '#007bff' : '#e0e0e0',
            color: activeTab === 'menu' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          功能菜单
        </button>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'create' ? '#007bff' : '#e0e0e0',
            color: activeTab === 'create' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          创建社区
        </button>
        <button
          onClick={() => setActiveTab('join')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'join' ? '#007bff' : '#e0e0e0',
            color: activeTab === 'join' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          加入社区
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'dashboard' ? '#007bff' : '#e0e0e0',
            color: activeTab === 'dashboard' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          查看图表
        </button>
      </div>

      {/* 状态消息 */}
      {message && (
        <div
          style={{
            padding: '12px',
            marginBottom: '15px',
            backgroundColor: '#d4edda',
            color: '#155724',
            borderRadius: '4px',
            border: '1px solid #c3e6cb'
          }}
        >
          {message}
        </div>
      )}
      {error && (
        <div
          style={{
            padding: '12px',
            marginBottom: '15px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}
        >
          {error}
        </div>
      )}

      {/* 功能菜单 */}
      {activeTab === 'menu' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div
            style={{
              padding: '20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              backgroundColor: '#f9f9f9'
            }}
            onClick={() => setActiveTab('create')}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
          >
            <h3>📝 创建社区</h3>
            <p>创建一个新的社区，邀请其他用户加入</p>
          </div>
          <div
            style={{
              padding: '20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              backgroundColor: '#f9f9f9'
            }}
            onClick={() => setActiveTab('join')}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
          >
            <h3>🚀 加入社区</h3>
            <p>使用社区ID加入已有的社区</p>
          </div>
          <div
            style={{
              padding: '20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              backgroundColor: '#f9f9f9',
              gridColumn: '1 / -1'
            }}
            onClick={() => setActiveTab('dashboard')}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
          >
            <h3>📊 查看图表</h3>
            <p>查看社区聚合看板 - 查看所有菜品的打饭量、剩余量、摄入量和用餐速度的平均值</p>
          </div>
        </div>
      )}

      {/* 创建社区 */}
      {activeTab === 'create' && (
        <div>
          <h3>创建新社区</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              社区名称 *
            </label>
            <input
              type="text"
              placeholder="输入社区名称，如：MIT 黑客松健康营"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              社区描述
            </label>
            <textarea
              placeholder="输入社区描述（可选）"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                minHeight: '100px',
                fontFamily: 'inherit'
              }}
            />
          </div>
          <button
            onClick={handleCreateCommunity}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '创建中...' : '创建社区'}
          </button>
          {createdCommunityId && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
              <p style={{ margin: 0 }}>社区ID: <code>{createdCommunityId}</code></p>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>请妥善保管，用于分享给其他用户加入</p>
            </div>
          )}
        </div>
      )}

      {/* 加入社区 */}
      {activeTab === 'join' && (
        <div>
          <h3>加入现有社区</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              社区ID *
            </label>
            <input
              type="text"
              placeholder="输入社区ID"
              value={joinForm.communityId}
              onChange={(e) => setJoinForm({ ...joinForm, communityId: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            onClick={handleJoinCommunity}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '加入中...' : '加入社区'}
          </button>
          {joinedCommunity && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
              <p style={{ margin: 0 }}>✓ 已成功加入社区 ID: <code>{joinedCommunity}</code></p>
            </div>
          )}
        </div>
      )}

      {/* 查看图表 */}
      {activeTab === 'dashboard' && (
        <div>
          <h3>社区大屏聚合看板</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              社区ID *
            </label>
            <input
              type="text"
              placeholder="输入社区ID"
              value={dashboardCommunityId}
              onChange={(e) => setDashboardCommunityId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                marginBottom: '10px'
              }}
            />
            <button
              onClick={handleFetchDashboard}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '加载中...' : '加载仪表板'}
            </button>
          </div>

          {dashboardData && (
            <div style={{ marginTop: '20px' }}>
              <div
                style={{
                  padding: '15px',
                  backgroundColor: '#f0f8ff',
                  borderRadius: '4px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #0066cc'
                }}
              >
                <h4 style={{ margin: '0 0 10px 0' }}>{dashboardData.community_name}</h4>
                <p style={{ margin: '5px 0' }}>
                  💼 社区成员数: <strong>{dashboardData.member_count}</strong>
                </p>
              </div>

              <h4>菜品统计平均值</h4>
              {dashboardData.food_avg_stats && dashboardData.food_avg_stats.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '15px'
                  }}
                >
                  {dashboardData.food_avg_stats.map((food, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '15px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#fafafa'
                      }}
                    >
                      <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>
                        🍱 {food.food_name}
                      </h5>
                      <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#666' }}>
                        <p style={{ margin: '3px 0' }}>
                          📤 平均打饭量: <strong>{food.avg_served_g.toFixed(1)}g</strong>
                        </p>
                        <p style={{ margin: '3px 0' }}>
                          🗑️ 平均剩余量: <strong>{food.avg_leftover_g.toFixed(1)}g</strong>
                        </p>
                        <p style={{ margin: '3px 0' }}>
                          🥄 平均摄入量: <strong>{food.avg_intake_g.toFixed(1)}g</strong>
                        </p>
                        <p style={{ margin: '3px 0' }}>
                          ⚡ 平均用餐速度: <strong>{food.avg_speed_g_per_min.toFixed(1)}g/min</strong>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999' }}>暂无菜品数据</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
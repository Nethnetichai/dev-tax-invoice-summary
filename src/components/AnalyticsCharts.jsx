import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from 'recharts';
import { format, parseISO } from 'date-fns';

const AnalyticsCharts = ({ data = [] }) => {
  const chartData = useMemo(() => {
    const stats = {};
    
    data.forEach(item => {
      if (!item.orderDate) return;
      const date = item.orderDate.split(' ')[0];
      stats[date] = (stats[date] || 0) + 1;
    });

    return Object.entries(stats)
      .map(([date, count]) => ({
        date,
        count,
        formattedDate: format(parseISO(date), 'dd MMM')
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data]);

  const productData = useMemo(() => {
    const stats = {};
    
    data.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const name = item.productName || 'Unknown';
          stats[name] = (stats[name] || 0) + 1;
        });
      }
    });

    return Object.entries(stats)
      .map(([name, count]) => ({
        name: name.substring(0, 25) + (name.length > 25 ? '...' : ''),
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="grid-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
      <div className="glass-card" style={{ padding: '1.5rem', height: '350px' }}>
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'left', fontSize: '1rem', opacity: 0.8 }}>จำนวนใบกำกับภาษีรายวัน</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis 
              dataKey="formattedDate" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
            />
            <Tooltip 
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#3b82f6' }}
            />
            <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', height: '350px' }}>
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'left', fontSize: '1rem', opacity: 0.8 }}>จำนวน Invoice แยกตามสินค้า (Top 5)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={productData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} width={120} />
            <Tooltip 
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
            />
            <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsCharts;

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProbData {
  drawCount: number;
  exact: number;
  cumulativeAtLeast: number;
}

interface Props {
  data: ProbData[];
}

export const ProbabilityChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="w-full h-64 mt-4 bg-slate-900 rounded-xl p-4 border border-slate-800">
      <h3 className="text-sm font-semibold text-slate-400 mb-4">Probability of opening X copies</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" unit="%" domain={[0, 100]} />
          <YAxis dataKey="drawCount" type="category" stroke="#94a3b8" label={{ value: 'Copies', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(value: number) => [`${value}%`, 'Chance']}
          />
          <Bar dataKey="exact" fill="#22d3ee" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? '#64748b' : '#22d3ee'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
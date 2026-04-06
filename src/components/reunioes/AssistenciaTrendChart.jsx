import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AssistenciaTrendChart({ dadosGrafico }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" dataKey="meio" name="Meio de Semana" stroke="#f97316" strokeWidth={4} dot={{ r: 6, fill: '#fff' }} />
                <Line type="monotone" dataKey="fim" name="Fim de Semana" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#fff' }} />
            </LineChart>
        </ResponsiveContainer>
    );
}

'use client'

import React from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Kept in its own file so the charting library is downloaded after the page is shown (see ProgressPage).

interface Props {
  kind: 'line' | 'bar'
  data: any[]
  dataKey: string
  color: string
  name: string
  wholeNumbers?: boolean
}

export default function ProgressChart({ kind, data, dataKey, color, name, wholeNumbers }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      {kind === 'line' ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={dataKey} connectNulls stroke={color} strokeWidth={2} name={name} />
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={!wholeNumbers} />
          <Tooltip />
          <Legend />
          <Bar dataKey={dataKey} fill={color} name={name} />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

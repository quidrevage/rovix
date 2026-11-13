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
  /** More lines on the same line chart. */
  more?: { dataKey: string; color: string; name: string }[]
}

export default function ProgressChart({ kind, data, dataKey, color, name, wholeNumbers, more = [] }: Props) {
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
          {more.map((line) => (
            <Line key={line.dataKey} type="monotone" dataKey={line.dataKey} connectNulls stroke={line.color} strokeWidth={2} name={line.name} />
          ))}
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

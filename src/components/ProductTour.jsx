import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Joyride, EVENTS, STATUS } from 'react-joyride'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { NAV_ITEMS, canAccessRoute } from '../utils/constants'

// ─── Page preview illustrations (inline SVG, dark-themed) ────────────────────

function PreviewDashboard() {
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* stat cards row */}
      {[0,1,2,3].map((i) => (
        <g key={i} transform={`translate(${4 + i * 84}, 4)`}>
          <rect width="80" height="44" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
          <rect x="4" y="4" width="16" height="16" rx="3" fill={['#0891b2','#10b981','#f59e0b','#ef4444'][i]} opacity=".3"/>
          <rect x="22" y="8" width="30" height="4" rx="2" fill="#ffffff18"/>
          <rect x="22" y="15" width="20" height="4" rx="2" fill="#ffffff10"/>
          <rect x="4" y="26" width="24" height="10" rx="2" fill="#ffffff22"/>
          <rect x="32" y="30" width="40" height="4" rx="2" fill="#ffffff0a"/>
        </g>
      ))}
      {/* chart area */}
      <rect x="4" y="54" width="200" height="90" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="10" y="60" width="60" height="4" rx="2" fill="#ffffff18"/>
      {[0,1,2,3,4,5,6].map((i) => {
        const h = [38,55,42,68,50,72,44][i]
        return (
          <g key={i}>
            <rect x={14 + i * 28} y={138 - h} width="18" height={h * 0.55} rx="3" fill="#0891b222"/>
            <rect x={14 + i * 28} y={138 - h * 0.45} width="18" height={h * 0.3} rx="3" fill="#10b98133"/>
            <rect x={14 + i * 28} y={138 - h * 0.15} width="18" height={h * 0.15} rx="3" fill="#ef444433"/>
          </g>
        )
      })}
      {/* right panel — alerts */}
      <rect x="210" y="54" width="126" height="90" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="216" y="60" width="50" height="4" rx="2" fill="#ffffff18"/>
      {[0,1,2,3].map((i) => (
        <g key={i} transform={`translate(216, ${72 + i * 18})`}>
          <rect width="4" height="13" rx="2" fill={['#ef4444','#f59e0b','#ef4444','#10b981'][i]}/>
          <rect x="8" y="2" width="60" height="3" rx="1.5" fill="#ffffff18"/>
          <rect x="8" y="8" width="40" height="2.5" rx="1.25" fill="#ffffff0e"/>
          <rect x="96" y="2" width="22" height="9" rx="4" fill="#ffffff08" stroke="#ffffff12" strokeWidth=".5"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewLiveFeedback() {
  const rows = [
    { color: '#10b981', label: 'Happy' },
    { color: '#ef4444', label: 'Unhappy' },
    { color: '#f59e0b', label: 'Neutral' },
    { color: '#10b981', label: 'Happy' },
    { color: '#ef4444', label: 'Unhappy' },
  ]
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* toolbar */}
      <rect x="4" y="4" width="332" height="26" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="10" y="11" width="70" height="4" rx="2" fill="#0891b230"/>
      <rect x="90" y="11" width="50" height="4" rx="2" fill="#ffffff12"/>
      <rect x="260" y="8" width="70" height="11" rx="5" fill="#0891b222" stroke="#0891b240" strokeWidth=".5"/>
      <rect x="266" y="11" width="5" height="5" rx="2.5" fill="#0891b2"/>
      <rect x="275" y="12" width="40" height="3" rx="1.5" fill="#ffffff18"/>
      {/* live pulse */}
      <circle cx="300" cy="17" r="4" fill="#10b98122"/>
      <circle cx="300" cy="17" r="2.5" fill="#10b981"/>
      {/* table header */}
      <rect x="4" y="36" width="332" height="16" rx="4" fill="#131e25" stroke="#ffffff08" strokeWidth="1"/>
      {[0,60,120,200,260].map((x, i) => (
        <rect key={i} x={10 + x} y="41" width={[40,44,60,44,60][i]} height="3" rx="1.5" fill="#ffffff20"/>
      ))}
      {/* rows */}
      {rows.map((r, i) => (
        <g key={i} transform={`translate(4, ${54 + i * 19})`}>
          <rect width="332" height="17" rx="3" fill={i % 2 === 0 ? '#162329' : '#1a2830'} stroke="#ffffff06" strokeWidth=".5"/>
          <rect x="6" y="4" width="8" height="8" rx="4" fill={r.color} opacity=".8"/>
          <rect x="20" y="5.5" width="35" height="3" rx="1.5" fill="#ffffff20"/>
          <rect x="70" y="5.5" width="44" height="3" rx="1.5" fill="#ffffff15"/>
          <rect x="130" y="4" width="40" height="9" rx="3" fill={r.color + '22'}/>
          <rect x="134" y="6" width="28" height="4" rx="2" fill={r.color + '88'}/>
          <rect x="210" y="5.5" width="36" height="3" rx="1.5" fill="#ffffff12"/>
          <rect x="270" y="5.5" width="30" height="3" rx="1.5" fill="#ffffff10"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewSiteMap() {
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* map background */}
      <rect x="4" y="4" width="240" height="142" rx="6" fill="#0f1c22" stroke="#0891b230" strokeWidth="1"/>
      {/* grid lines */}
      {[30,60,90,120].map(y => <line key={y} x1="4" y1={y} x2="244" y2={y} stroke="#ffffff06" strokeWidth=".5"/>)}
      {[44,84,124,164,204].map(x => <line key={x} x1={x} y1="4" x2={x} y2="146" stroke="#ffffff06" strokeWidth=".5"/>)}
      {/* floor zones */}
      <rect x="14" y="14" width="80" height="55" rx="5" fill="#0891b215" stroke="#0891b250" strokeWidth="1"/>
      <rect x="104" y="14" width="60" height="55" rx="5" fill="#10b98115" stroke="#10b98150" strokeWidth="1"/>
      <rect x="14" y="80" width="60" height="55" rx="5" fill="#f59e0b15" stroke="#f59e0b50" strokeWidth="1"/>
      <rect x="84" y="80" width="80" height="55" rx="5" fill="#ef444415" stroke="#ef444450" strokeWidth="1"/>
      {/* labels */}
      <rect x="20" y="34" width="30" height="4" rx="2" fill="#0891b260"/>
      <rect x="110" y="34" width="24" height="4" rx="2" fill="#10b98160"/>
      <rect x="20" y="100" width="28" height="4" rx="2" fill="#f59e0b60"/>
      <rect x="90" y="100" width="36" height="4" rx="2" fill="#ef444460"/>
      {/* device dots */}
      {[[28,28],[48,20],[120,20],[140,30],[25,95],[100,95],[130,90]].map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill={['#10b981','#10b981','#10b981','#f59e0b','#ef4444','#10b981','#10b981'][i]} opacity=".9"/>
      ))}
      {/* heatmap legend */}
      <rect x="170" y="118" width="65" height="22" rx="4" fill="#0b141988" stroke="#ffffff10" strokeWidth=".5"/>
      <rect x="174" y="122" width="57" height="3" rx="1.5" fill="#ffffff18"/>
      <defs>
        <linearGradient id="hm" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981"/>
          <stop offset="50%" stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#ef4444"/>
        </linearGradient>
      </defs>
      <rect x="174" y="128" width="57" height="6" rx="3" fill="url(#hm)" opacity=".7"/>
      {/* right panel */}
      <rect x="250" y="4" width="86" height="142" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="256" y="10" width="50" height="4" rx="2" fill="#ffffff18"/>
      {[0,1,2,3,4].map(i => (
        <g key={i} transform={`translate(256, ${22 + i * 23})`}>
          <rect width="74" height="18" rx="4" fill="#162329" stroke="#ffffff08" strokeWidth=".5"/>
          <rect x="4" y="4" width="8" height="8" rx="4" fill={['#10b981','#10b981','#f59e0b','#ef4444','#10b981'][i]} opacity=".8"/>
          <rect x="16" y="4" width="34" height="3" rx="1.5" fill="#ffffff18"/>
          <rect x="16" y="10" width="24" height="2.5" rx="1.25" fill="#ffffff0e"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewDevices() {
  const statuses = ['#10b981','#10b981','#f59e0b','#ef4444','#10b981','#94a3b8']
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* summary cards */}
      {[
        { label:'Total', val:'148', color:'#0891b2' },
        { label:'Online', val:'132', color:'#10b981' },
        { label:'Low Bat', val:'11', color:'#f59e0b' },
        { label:'Offline', val:'5', color:'#ef4444' },
      ].map((c, i) => (
        <g key={i} transform={`translate(${4 + i * 84}, 4)`}>
          <rect width="80" height="34" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
          <rect x="4" y="4" width="4" height="26" rx="2" fill={c.color} opacity=".7"/>
          <rect x="14" y="6" width="28" height="3" rx="1.5" fill="#ffffff15"/>
          <rect x="14" y="14" width="20" height="8" rx="2" fill="#ffffff22"/>
          <rect x="44" y="16" width="28" height="6" rx="3" fill={c.color + '20'}/>
          <rect x="48" y="18" width="18" height="3" rx="1.5" fill={c.color + '80'}/>
        </g>
      ))}
      {/* table */}
      <rect x="4" y="44" width="332" height="14" rx="4" fill="#131e25" stroke="#ffffff08" strokeWidth=".5"/>
      {[0,70,140,210,270].map((x, i) => (
        <rect key={i} x={10 + x} y="49" width={[55,55,55,44,50][i]} height="3" rx="1.5" fill="#ffffff20"/>
      ))}
      {statuses.map((color, i) => (
        <g key={i} transform={`translate(4, ${60 + i * 16})`}>
          <rect width="332" height="14" rx="3" fill={i % 2 === 0 ? '#162329' : '#1a2830'} stroke="#ffffff05" strokeWidth=".5"/>
          {/* EUI */}
          <rect x="6" y="4" width="55" height="3" rx="1.5" fill="#ffffff18"/>
          {/* Location */}
          <rect x="76" y="4" width="44" height="3" rx="1.5" fill="#ffffff12"/>
          {/* Status pill */}
          <rect x="146" y="2" width="40" height="9" rx="4" fill={color + '22'}/>
          <circle cx="152" cy="7" r="2.5" fill={color} opacity=".9"/>
          <rect x="158" y="4.5" width="22" height="3" rx="1.5" fill={color + '80'}/>
          {/* Battery bar */}
          <rect x="216" y="4" width="40" height="5" rx="2.5" fill="#ffffff08"/>
          <rect x="216" y="4" width={[38,34,10,36,30,8][i]} height="5" rx="2.5" fill={[
            '#10b981','#10b981','#f59e0b','#ef4444','#10b981','#ef4444'
          ][i]} opacity=".7"/>
          {/* Last seen */}
          <rect x="276" y="4" width="40" height="3" rx="1.5" fill="#ffffff10"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewGateways() {
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* header cards */}
      {[
        { color:'#10b981', label:'Online' },
        { color:'#ef4444', label:'Offline' },
        { color:'#0891b2', label:'Total' },
      ].map((c, i) => (
        <g key={i} transform={`translate(${4 + i * 112}, 4)`}>
          <rect width="108" height="36" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
          <rect x="4" y="4" width="4" height="28" rx="2" fill={c.color} opacity=".6"/>
          <rect x="14" y="7" width="40" height="4" rx="2" fill="#ffffff15"/>
          <rect x="14" y="18" width="24" height="8" rx="3" fill="#ffffff20"/>
          <rect x="74" y="10" width="28" height="14" rx="5" fill={c.color + '20'} stroke={c.color + '40'} strokeWidth=".5"/>
          <circle cx="82" cy="17" r="3" fill={c.color} opacity=".8"/>
          <rect x="88" y="15" width="8" height="3" rx="1.5" fill={c.color + '70'}/>
        </g>
      ))}
      {/* gateway list */}
      <rect x="4" y="46" width="332" height="14" rx="4" fill="#131e25" stroke="#ffffff08" strokeWidth=".5"/>
      {[0,80,160,230].map((x, i) => (
        <rect key={i} x={10 + x} y="51" width={[65,65,55,80][i]} height="3" rx="1.5" fill="#ffffff20"/>
      ))}
      {[0,1,2,3,4].map((i) => (
        <g key={i} transform={`translate(4, ${62 + i * 17})`}>
          <rect width="332" height="15" rx="3" fill={i % 2 === 0 ? '#162329' : '#1a2830'} stroke="#ffffff05" strokeWidth=".5"/>
          {/* signal icon */}
          <rect x="6" y="3" width="2" height="6" rx="1" fill={i === 1 ? '#ef4444' : '#10b981'} opacity=".9"/>
          <rect x="10" y="2" width="2" height="8" rx="1" fill={i === 1 ? '#ef4444' : '#10b981'} opacity=".7"/>
          <rect x="14" y="1" width="2" height="10" rx="1" fill={i === 1 ? '#ef4444' : '#10b981'} opacity=".5"/>
          {/* name */}
          <rect x="22" y="5" width="55" height="3" rx="1.5" fill="#ffffff18"/>
          {/* location */}
          <rect x="90" y="5" width="55" height="3" rx="1.5" fill="#ffffff12"/>
          {/* devices connected */}
          <rect x="170" y="4" width="32" height="8" rx="3" fill="#0891b215" stroke="#0891b240" strokeWidth=".5"/>
          <rect x="174" y="6" width="20" height="3" rx="1.5" fill="#0891b270"/>
          {/* uptime */}
          <rect x="240" y="5" width="50" height="3" rx="1.5" fill="#ffffff10"/>
          {/* action */}
          <rect x="308" y="4" width="18" height="8" rx="3" fill="#ffffff08" stroke="#ffffff15" strokeWidth=".5"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewAlerts() {
  const priorities = [
    { c:'#ef4444', label:'Critical', w:58 },
    { c:'#f97316', label:'High', w:46 },
    { c:'#f59e0b', label:'Medium', w:50 },
    { c:'#10b981', label:'Low', w:38 },
    { c:'#ef4444', label:'Critical', w:58 },
  ]
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* stat row */}
      {[
        { c:'#ef4444', label:'Open', n:'12' },
        { c:'#f59e0b', label:'In Progress', n:'5' },
        { c:'#10b981', label:'Resolved', n:'89' },
      ].map((s, i) => (
        <g key={i} transform={`translate(${4 + i * 112}, 4)`}>
          <rect width="108" height="32" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
          <rect x="4" y="4" width="4" height="24" rx="2" fill={s.c} opacity=".7"/>
          <rect x="14" y="6" width="36" height="3" rx="1.5" fill="#ffffff15"/>
          <rect x="14" y="14" width="20" height="8" rx="2" fill="#ffffff22"/>
          <rect x="74" y="8" width="28" height="14" rx="5" fill={s.c + '18'} stroke={s.c + '35'} strokeWidth=".5"/>
          <rect x="80" y="13" width="16" height="3" rx="1.5" fill={s.c + '80'}/>
        </g>
      ))}
      {/* alert cards */}
      {priorities.map((p, i) => (
        <g key={i} transform={`translate(4, ${42 + i * 22})`}>
          <rect width="332" height="19" rx="5" fill="#1a2830" stroke="#ffffff08" strokeWidth=".5"/>
          <rect width="3" height="19" rx="1.5" fill={p.c} opacity=".8"/>
          {/* priority badge */}
          <rect x="8" y="4" width={p.w} height="10" rx="4" fill={p.c + '18'} stroke={p.c + '35'} strokeWidth=".5"/>
          <circle cx="14" cy="9" r="2.5" fill={p.c} opacity=".9"/>
          <rect x="19" y="6.5" width={p.w - 14} height="3" rx="1.5" fill={p.c + '80'}/>
          {/* location */}
          <rect x={p.w + 14} y="4.5" width="70" height="3" rx="1.5" fill="#ffffff18"/>
          <rect x={p.w + 14} y="10.5" width="50" height="2.5" rx="1.25" fill="#ffffff0e"/>
          {/* action buttons */}
          <rect x="270" y="4" width="28" height="11" rx="4" fill="#0891b220" stroke="#0891b240" strokeWidth=".5"/>
          <rect x="274" y="7" width="18" height="3" rx="1.5" fill="#0891b270"/>
          <rect x="302" y="4" width="24" height="11" rx="4" fill="#10b98120" stroke="#10b98140" strokeWidth=".5"/>
          <rect x="306" y="7" width="14" height="3" rx="1.5" fill="#10b98170"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewReports() {
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* filter bar */}
      <rect x="4" y="4" width="332" height="26" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      {[0,1,2,3].map(i => (
        <rect key={i} x={10 + i * 82} y="10" width="76" height="14" rx="5" fill={i === 0 ? '#0891b220' : '#ffffff08'} stroke={i === 0 ? '#0891b240' : '#ffffff10'} strokeWidth=".5"/>
      ))}
      <rect x="310" y="9" width="22" height="14" rx="5" fill="#10b98120" stroke="#10b98140" strokeWidth=".5"/>
      {/* chart */}
      <rect x="4" y="36" width="204" height="110" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="10" y="42" width="60" height="4" rx="2" fill="#ffffff18"/>
      <polyline
        points="14,130 40,108 66,118 92,90 118,100 144,78 170,88 196,72"
        fill="none" stroke="#0891b2" strokeWidth="1.5" strokeLinejoin="round"/>
      <polyline
        points="14,138 40,128 66,130 92,118 118,122 144,110 170,116 196,102"
        fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round"/>
      <polyline
        points="14,142 40,136 66,140 92,132 118,138 144,130 170,136 196,124"
        fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* legend */}
      {[
        { c:'#0891b2', label:'Happy' },
        { c:'#10b981', label:'Neutral' },
        { c:'#ef4444', label:'Unhappy' },
      ].map((l, i) => (
        <g key={i} transform={`translate(${14 + i * 60}, 58)`}>
          <rect width="8" height="4" rx="2" fill={l.c}/>
          <rect x="11" y=".5" width="30" height="3" rx="1.5" fill="#ffffff18"/>
        </g>
      ))}
      {/* summary table */}
      <rect x="214" y="36" width="122" height="110" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="220" y="42" width="50" height="4" rx="2" fill="#ffffff18"/>
      {['Total','Happy','Neutral','Unhappy','Score'].map((_, i) => (
        <g key={i} transform={`translate(220, ${52 + i * 18})`}>
          <rect width="110" height="14" rx="3" fill={i % 2 === 0 ? '#162329' : '#1a2830'} stroke="#ffffff06" strokeWidth=".5"/>
          <rect x="4" y="4.5" width="40" height="3" rx="1.5" fill="#ffffff18"/>
          <rect x="70" y="4.5" width="28" height="3" rx="1.5" fill={['#ffffff22','#10b98160','#f59e0b60','#ef444460','#0891b260'][i]}/>
        </g>
      ))}
    </svg>
  )
}

function PreviewSiteConfig() {
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* step breadcrumb */}
      {['Site','Floor','Zone','Devices'].map((_, i) => (
        <g key={i} transform={`translate(${4 + i * 84}, 4)`}>
          <rect width="80" height="20" rx="4" fill={i === 0 ? '#0891b230' : '#1a2830'} stroke={i === 0 ? '#0891b250' : '#ffffff10'} strokeWidth=".5"/>
          <circle cx="12" cy="10" r="5" fill={i === 0 ? '#0891b2' : '#ffffff15'}/>
          <rect x="22" y="8" width="35" height="3" rx="1.5" fill={i === 0 ? '#ffffff30' : '#ffffff15'}/>
        </g>
      ))}
      {/* left site tree */}
      <rect x="4" y="30" width="110" height="116" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="10" y="36" width="50" height="4" rx="2" fill="#ffffff18"/>
      {[
        { indent:0, c:'#0891b2' },
        { indent:10, c:'#10b981' },
        { indent:20, c:'#ffffff' },
        { indent:20, c:'#ffffff' },
        { indent:10, c:'#10b981' },
        { indent:20, c:'#ffffff' },
      ].map((r, i) => (
        <g key={i} transform={`translate(${10 + r.indent}, ${46 + i * 16})`}>
          <rect width={90 - r.indent} height="13" rx="3" fill={i === 0 ? '#0891b218' : '#ffffff05'} stroke={i === 0 ? '#0891b230' : '#ffffff08'} strokeWidth=".5"/>
          <rect x="4" y="4" width="4" height="4" rx="2" fill={r.c} opacity=".7"/>
          <rect x="12" y="4.5" width={50 - r.indent} height="3" rx="1.5" fill="#ffffff18"/>
        </g>
      ))}
      {/* floor plan canvas */}
      <rect x="120" y="30" width="216" height="116" rx="6" fill="#0f1c22" stroke="#0891b230" strokeWidth="1"/>
      {/* grid */}
      {[50,70,90,110,130].map(y => <line key={y} x1="120" y1={y} x2="336" y2={y} stroke="#ffffff05" strokeWidth=".5"/>)}
      {[140,168,196,224,252,280,308].map(x => <line key={x} x1={x} y1="30" x2={x} y2="146" stroke="#ffffff05" strokeWidth=".5"/>)}
      {/* zones */}
      <rect x="128" y="38" width="90" height="50" rx="4" fill="#0891b212" stroke="#0891b250" strokeWidth="1"/>
      <rect x="226" y="38" width="60" height="50" rx="4" fill="#10b98112" stroke="#10b98150" strokeWidth="1"/>
      <rect x="128" y="96" width="60" height="40" rx="4" fill="#f59e0b12" stroke="#f59e0b50" strokeWidth="1"/>
      <rect x="196" y="96" width="90" height="40" rx="4" fill="#ef444412" stroke="#ef444450" strokeWidth="1"/>
      {/* labels */}
      <rect x="136" y="60" width="28" height="4" rx="2" fill="#0891b250"/>
      <rect x="234" y="60" width="24" height="4" rx="2" fill="#10b98150"/>
      <rect x="136" y="112" width="22" height="4" rx="2" fill="#f59e0b50"/>
      <rect x="204" y="112" width="28" height="4" rx="2" fill="#ef444450"/>
    </svg>
  )
}

function PreviewDisaster() {
  const statuses = [
    { label: 'API Server', color: '#10b981' },
    { label: 'Database', color: '#10b981' },
    { label: 'LoRaWAN', color: '#f59e0b' },
    { label: 'Notifications', color: '#10b981' },
  ]
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* tabs */}
      {['Overview','Incident Log','Audit Log'].map((_, i) => (
        <g key={i} transform={`translate(${4 + i * 112}, 4)`}>
          <rect width="108" height="20" rx="5" fill={i === 0 ? '#0891b225' : '#1a2830'} stroke={i === 0 ? '#0891b245' : '#ffffff10'} strokeWidth=".5"/>
          <rect x="8" y="7.5" width={[55,60,46][i]} height="4" rx="2" fill={i === 0 ? '#0891b280' : '#ffffff18'}/>
        </g>
      ))}
      {/* system status cards */}
      {statuses.map((s, i) => (
        <g key={i} transform={`translate(${4 + i * 84}, 30)`}>
          <rect width="80" height="46" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth=".5"/>
          {/* indicator pulse */}
          <circle cx="12" cy="12" r="5" fill={s.color} opacity=".2"/>
          <circle cx="12" cy="12" r="3" fill={s.color}/>
          <rect x="22" y="8" width="50" height="3" rx="1.5" fill="#ffffff18"/>
          <rect x="22" y="14" width="38" height="3" rx="1.5" fill={s.color + '60'}/>
          {/* mini bar */}
          <rect x="8" y="30" width="64" height="5" rx="2.5" fill="#ffffff08"/>
          <rect x="8" y="30" width={[64,64,36,64][i]} height="5" rx="2.5" fill={s.color} opacity=".5"/>
        </g>
      ))}
      {/* incident table */}
      <rect x="4" y="82" width="332" height="14" rx="4" fill="#131e25" stroke="#ffffff08" strokeWidth=".5"/>
      {[0,90,180,260].map((x, i) => (
        <rect key={i} x={10 + x} y="87" width={[70,70,68,60][i]} height="3" rx="1.5" fill="#ffffff20"/>
      ))}
      {[0,1,2,3].map((i) => (
        <g key={i} transform={`translate(4, ${98 + i * 14})`}>
          <rect width="332" height="12" rx="3" fill={i % 2 === 0 ? '#162329' : '#1a2830'} stroke="#ffffff05" strokeWidth=".5"/>
          <rect x="6" y="3.5" width={[60,48,52,44][i]} height="3" rx="1.5" fill="#ffffff15"/>
          <rect x="96" y="3" width="48" height="6" rx="3" fill={['#ef444418','#f59e0b18','#10b98118','#f59e0b18'][i]} stroke={['#ef444435','#f59e0b35','#10b98135','#f59e0b35'][i]} strokeWidth=".5"/>
          <rect x="100" y="4.5" width="34" height="3" rx="1.5" fill={['#ef444470','#f59e0b70','#10b98170','#f59e0b70'][i]}/>
          <rect x="190" y="3.5" width="55" height="3" rx="1.5" fill="#ffffff12"/>
          <rect x="266" y="3.5" width="55" height="3" rx="1.5" fill="#ffffff10"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewUserManagement() {
  const roles = [
    { label: 'Super Admin', color: '#ef4444' },
    { label: 'Vendor Admin', color: '#f59e0b' },
    { label: 'Regional Mgr', color: '#0891b2' },
    { label: 'Facility Mgr', color: '#10b981' },
    { label: 'Viewer', color: '#94a3b8' },
  ]
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* header action row */}
      <rect x="4" y="4" width="332" height="24" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth=".5"/>
      <rect x="10" y="10" width="80" height="4" rx="2" fill="#ffffff18"/>
      <rect x="270" y="8" width="60" height="10" rx="5" fill="#0891b222" stroke="#0891b240" strokeWidth=".5"/>
      <rect x="276" y="11" width="40" height="3" rx="1.5" fill="#0891b270"/>
      {/* role section labels + tables */}
      {roles.map((r, i) => (
        <g key={i} transform={`translate(4, ${34 + i * 23})`}>
          {/* section label */}
          <rect width="332" height="21" rx="4" fill={i % 2 === 0 ? '#162329' : '#1a2830'} stroke="#ffffff06" strokeWidth=".5"/>
          {/* role pill */}
          <rect x="4" y="6" width="76" height="9" rx="4" fill={r.color + '18'} stroke={r.color + '35'} strokeWidth=".5"/>
          <circle cx="11" cy="10.5" r="2.5" fill={r.color}/>
          <rect x="17" y="7.5" width={[52,50,58,56,34][i]} height="3.5" rx="1.75" fill={r.color + '70'}/>
          {/* user count pill */}
          <rect x="86" y="7" width="28" height="8" rx="4" fill="#ffffff08" stroke="#ffffff15" strokeWidth=".5"/>
          <rect x="90" y="9.5" width="18" height="3" rx="1.5" fill="#ffffff25"/>
          {/* email / name snippets */}
          <rect x="124" y="7.5" width="80" height="3" rx="1.5" fill="#ffffff15"/>
          <rect x="214" y="7.5" width="60" height="3" rx="1.5" fill="#ffffff10"/>
          {/* action btn */}
          <rect x="304" y="6.5" width="22" height="9" rx="4" fill="#ffffff08" stroke="#ffffff15" strokeWidth=".5"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewAuditHistory() {
  const actions = [
    { label: 'CREATE', color: '#10b981' },
    { label: 'UPDATE', color: '#3b82f6' },
    { label: 'DELETE', color: '#ef4444' },
    { label: 'ASSIGN', color: '#8b5cf6' },
    { label: 'UPDATE', color: '#3b82f6' },
    { label: 'CREATE', color: '#10b981' },
  ]
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* filter bar */}
      <rect x="4" y="4" width="332" height="24" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth=".5"/>
      {/* search */}
      <rect x="10" y="9" width="120" height="12" rx="4" fill="#162329" stroke="#ffffff12" strokeWidth=".5"/>
      <rect x="15" y="12.5" width="60" height="3" rx="1.5" fill="#ffffff15"/>
      {/* module filter */}
      <rect x="138" y="9" width="80" height="12" rx="4" fill="#162329" stroke="#ffffff12" strokeWidth=".5"/>
      <rect x="143" y="12.5" width="45" height="3" rx="1.5" fill="#ffffff15"/>
      {/* action filter */}
      <rect x="226" y="9" width="70" height="12" rx="4" fill="#162329" stroke="#ffffff12" strokeWidth=".5"/>
      <rect x="231" y="12.5" width="40" height="3" rx="1.5" fill="#ffffff15"/>
      {/* export btn */}
      <rect x="304" y="9" width="28" height="12" rx="4" fill="#0891b220" stroke="#0891b240" strokeWidth=".5"/>
      <rect x="308" y="12.5" width="18" height="3" rx="1.5" fill="#0891b270"/>
      {/* table header */}
      <rect x="4" y="34" width="332" height="14" rx="4" fill="#131e25" stroke="#ffffff08" strokeWidth=".5"/>
      {[0,72,144,216,276].map((x, i) => (
        <rect key={i} x={10 + x} y="39" width={[55,55,55,44,44][i]} height="3" rx="1.5" fill="#ffffff22"/>
      ))}
      {/* rows */}
      {actions.map((a, i) => (
        <g key={i} transform={`translate(4, ${50 + i * 17})`}>
          <rect width="332" height="15" rx="3" fill={i % 2 === 0 ? '#162329' : '#1a2830'} stroke="#ffffff05" strokeWidth=".5"/>
          {/* timestamp */}
          <rect x="6" y="5" width="55" height="3" rx="1.5" fill="#ffffff18"/>
          {/* module pill */}
          <rect x="78" y="3.5" width="46" height="8" rx="4" fill="#0891b215" stroke="#0891b230" strokeWidth=".5"/>
          <rect x="82" y="5.5" width="30" height="3" rx="1.5" fill="#0891b260"/>
          {/* action badge */}
          <rect x="150" y="3.5" width="44" height="8" rx="4" fill={a.color + '18'} stroke={a.color + '35'} strokeWidth=".5"/>
          <rect x="154" y="5.5" width="30" height="3" rx="1.5" fill={a.color + '70'}/>
          {/* user */}
          <rect x="222" y="5" width="50" height="3" rx="1.5" fill="#ffffff15"/>
          {/* detail */}
          <rect x="282" y="5" width="44" height="3" rx="1.5" fill="#ffffff10"/>
        </g>
      ))}
    </svg>
  )
}

function PreviewSettings() {
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* left section nav */}
      <rect x="4" y="4" width="90" height="142" rx="6" fill="#0f1c22" stroke="#ffffff10" strokeWidth=".5"/>
      <rect x="10" y="10" width="50" height="4" rx="2" fill="#ffffff18"/>
      {[
        { label: 'Organisation', active: true },
        { label: 'Alerts', active: false },
        { label: 'Notifications', active: false },
        { label: 'Security', active: false },
        { label: 'Reports', active: false },
      ].map((s, i) => (
        <g key={i} transform={`translate(10, ${22 + i * 22})`}>
          <rect width="74" height="17" rx="4" fill={s.active ? '#0891b218' : '#ffffff05'} stroke={s.active ? '#0891b235' : 'none'}/>
          {s.active && <rect width="3" height="17" rx="1.5" fill="#0891b2"/>}
          <rect x="8" y="6" width={[54,34,58,42,40][i]} height="4" rx="2" fill={s.active ? '#ffffff28' : '#ffffff15'}/>
        </g>
      ))}
      {/* right form area */}
      <rect x="100" y="4" width="236" height="142" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth=".5"/>
      <rect x="108" y="10" width="80" height="5" rx="2.5" fill="#ffffff22"/>
      <rect x="108" y="18" width="130" height="3" rx="1.5" fill="#ffffff0e"/>
      {/* form fields */}
      {[
        { label: 'Organisation Name', w: 120 },
        { label: 'Time Zone', w: 90 },
        { label: 'Teams Webhook', w: 150 },
        { label: 'Report Frequency', w: 80 },
      ].map((f, i) => (
        <g key={i} transform={`translate(108, ${28 + i * 26})`}>
          <rect x="0" y="0" width={60} height="3" rx="1.5" fill="#ffffff25"/>
          <rect x="0" y="7" width="212" height="12" rx="4" fill="#162329" stroke="#ffffff12" strokeWidth=".5"/>
          <rect x="6" y="10" width={f.w} height="3" rx="1.5" fill="#ffffff20"/>
        </g>
      ))}
      {/* save button */}
      <rect x="108" y="132" width="70" height="10" rx="5" fill="#0891b2" opacity=".8"/>
      <rect x="116" y="135.5" width="48" height="3" rx="1.5" fill="#ffffff60"/>
      {/* toggle switches decorative */}
      <rect x="220" y="132" width="28" height="10" rx="5" fill="#10b98130" stroke="#10b98150" strokeWidth=".5"/>
      <circle cx="242" cy="137" r="4" fill="#10b981"/>
    </svg>
  )
}

function PreviewWelcome() {
  return (
    <svg viewBox="0 0 340 150" xmlns="http://www.w3.org/2000/svg" className="srfs-tour-preview">
      {/* sidebar mock */}
      <rect x="4" y="4" width="70" height="142" rx="6" fill="#0b1419" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="10" y="10" width="38" height="8" rx="3" fill="#0891b230"/>
      {[0,1,2,3,4,5,6,7].map(i => (
        <g key={i} transform={`translate(10, ${26 + i * 14})`}>
          <rect width="50" height="10" rx="3" fill={i === 0 ? '#0891b220' : '#ffffff05'} stroke={i === 0 ? '#0891b230' : 'none'}/>
          <rect x="3" y="2.5" width="5" height="5" rx="2" fill={i === 0 ? '#0891b2' : '#ffffff18'}/>
          <rect x="11" y="3.5" width="28" height="3" rx="1.5" fill="#ffffff15"/>
        </g>
      ))}
      {/* main area */}
      <rect x="80" y="4" width="256" height="24" rx="6" fill="#0f1c22" stroke="#ffffff10" strokeWidth="1"/>
      <rect x="86" y="11" width="60" height="4" rx="2" fill="#ffffff18"/>
      <rect x="290" y="9" width="40" height="10" rx="4" fill="#0891b215" stroke="#0891b235" strokeWidth=".5"/>
      {/* content cards */}
      {[0,1,2,3].map(i => (
        <g key={i} transform={`translate(${80 + i * 64}, 34)`}>
          <rect width="60" height="30" rx="5" fill="#1a2830" stroke="#ffffff10" strokeWidth=".5"/>
          <rect x="4" y="4" width="4" height="22" rx="2" fill={['#0891b2','#10b981','#f59e0b','#ef4444'][i]} opacity=".6"/>
          <rect x="12" y="6" width="28" height="3" rx="1.5" fill="#ffffff18"/>
          <rect x="12" y="14" width="18" height="8" rx="2" fill="#ffffff22"/>
        </g>
      ))}
      {/* chart */}
      <rect x="80" y="70" width="160" height="76" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth=".5"/>
      {[0,1,2,3,4,5].map(i => {
        const h = [30,45,36,55,42,50][i]
        return <rect key={i} x={88 + i * 25} y={140 - h} width="16" height={h} rx="3" fill={['#0891b2','#10b981','#0891b2','#10b981','#0891b2','#10b981'][i]} opacity=".4"/>
      })}
      {/* right widget */}
      <rect x="246" y="70" width="90" height="76" rx="6" fill="#1a2830" stroke="#ffffff10" strokeWidth=".5"/>
      {[0,1,2,3].map(i => (
        <g key={i} transform={`translate(252, ${76 + i * 17})`}>
          <rect width="78" height="13" rx="3" fill="#162329" stroke="#ffffff06" strokeWidth=".5"/>
          <rect x="4" y="4" width="4" height="5" rx="2" fill={['#ef4444','#f59e0b','#ef4444','#10b981'][i]} opacity=".8"/>
          <rect x="12" y="4.5" width="40" height="3" rx="1.5" fill="#ffffff15"/>
        </g>
      ))}
    </svg>
  )
}

// Map route paths to their preview component
const PAGE_PREVIEWS = {
  '/dashboard':     <PreviewDashboard />,
  '/live-feedback': <PreviewLiveFeedback />,
  '/sidemap':       <PreviewSiteMap />,
  '/site-config':   <PreviewSiteConfig />,
  '/devices':       <PreviewDevices />,
  '/gateways':      <PreviewGateways />,
  '/alerts':        <PreviewAlerts />,
  '/reports':       <PreviewReports />,
  '/disaster':      <PreviewDisaster />,
  '/users':         <PreviewUserManagement />,
  '/audit-history': <PreviewAuditHistory />,
  '/settings':      <PreviewSettings />,
}

// ─── Tour copy ────────────────────────────────────────────────────────────────
const TOUR_COPY = {
  '/dashboard':     ['Dashboard',           'Start here for an at-a-glance view of feedback, alerts, and device health.'],
  '/live-feedback': ['Live Feedback',       'Watch incoming restroom feedback in real time and identify issues as they happen.'],
  '/sidemap':       ['Sitemap',             'Use the interactive site map to understand restroom status across your facility.'],
  '/site-config':   ['Site Configuration', 'Configure sites, floors, zones, and their layout for your organisation.'],
  '/devices':       ['Device Management',  'Monitor device connectivity, battery levels, and device assignments.'],
  '/gateways':      ['Gateway Management', 'Review LoRaWAN gateway status and connected device activity.'],
  '/alerts':        ['Alert Management',   'Acknowledge, assign, and resolve feedback-driven operational alerts.'],
  '/reports':       ['Reports',            'Generate and export reports to track performance and recurring issues.'],
  '/disaster':      ['Disaster Management','Monitor system health, track incidents, and coordinate recovery across all components.'],
  '/users':         ['User Management',    'Create and manage users, assign roles, and control access across your organisation.'],
  '/audit-history': ['Audit History',      'Track every configuration change and user action with a full timestamped log.'],
  '/settings':      ['Settings',           'Configure organisation details, alert thresholds, notifications, and security policies.'],
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function TourTooltip({ index, isLastStep, primaryProps, skipProps, backProps, step, tooltipProps, size }) {
  const preview = step.data?.preview ?? null

  return (
    <div {...tooltipProps} className="srfs-tour-tooltip">
      <div className="srfs-tour-tooltip__glow" aria-hidden="true" />

      <div className="srfs-tour-tooltip__header">
        <span className="srfs-tour-tooltip__eyebrow">
          {index === 0 ? 'Welcome' : 'Quick tour'}
        </span>
        <div className="srfs-tour-tooltip__progress" aria-label={`Step ${index + 1} of ${size}`}>
          {Array.from({ length: size }).map((_, i) => (
            <span
              key={i}
              className={`srfs-tour-tooltip__dot${i <= index ? ' is-active' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="srfs-tour-tooltip__title">{step.title}</div>
      <div className="srfs-tour-tooltip__content">{step.content}</div>

      {preview && (
        <div className="srfs-tour-preview-wrap" aria-hidden="true">
          {preview}
        </div>
      )}

      <div className="srfs-tour-tooltip__footer">
        {!isLastStep && (
          <button type="button" className="srfs-tour-btn srfs-tour-btn--muted" {...skipProps}>
            Skip tour
          </button>
        )}
        {index > 0 && (
          <button type="button" className="srfs-tour-btn srfs-tour-btn--ghost" {...backProps}>
            Back
          </button>
        )}
        <button type="button" className="srfs-tour-btn srfs-tour-btn--primary" {...primaryProps}>
          {isLastStep ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProductTour() {
  const { user, updateUser } = useAuth()
  const [run, setRun] = useState(false)
  const savingRef = useRef(false)

  const steps = useMemo(() => {
    if (!user) return []
    const navSteps = NAV_ITEMS
      .filter((item) => TOUR_COPY[item.path] && canAccessRoute(user.role, item.path))
      .map((item) => ({
        target: `[data-tour-id="${item.path}"]`,
        title: TOUR_COPY[item.path][0],
        content: TOUR_COPY[item.path][1],
        placement: 'right',
        disableBeacon: true,
        data: { preview: PAGE_PREVIEWS[item.path] ?? null },
      }))
    return [
      {
        target: 'body',
        placement: 'center',
        title: 'Welcome to Smart Restroom',
        content: `Hi ${user.name?.split(' ')[0] || 'there'}! This quick tour introduces the key tools available for your role.`,
        disableBeacon: true,
        data: { preview: <PreviewWelcome /> },
      },
      ...navSteps,
    ]
  }, [user])

  const broadcastTourState = useCallback((active) => {
    window.dispatchEvent(new CustomEvent('srfs-tour-state', { detail: { active } }))
    // Suppress Leaflet's stacking context while the overlay is visible so it
    // doesn't bleed through the Joyride backdrop.
    document.body.classList.toggle('srfs-tour-active', active)
  }, [])

  const startTour = useCallback(() => {
    if (!steps.length) return
    broadcastTourState(true)
    setRun(true)
  }, [broadcastTourState, steps.length])

  useEffect(() => {
    const handler = () => startTour()
    window.addEventListener('srfs-tour-restart', handler)
    return () => window.removeEventListener('srfs-tour-restart', handler)
  }, [startTour])

  useEffect(() => {
    let cancelled = false
    async function checkFirstTour() {
      if (!user) return
      try {
        const { tutorialStatus } = await api.get('/api/auth/tutorial')
        if (cancelled) return
        updateUser({ tutorialStatus })
        if (tutorialStatus === 'pending') {
          // Show the spotlight beacon on the navbar button first,
          // then auto-start the tour after a short pause so the user
          // sees the highlight before it begins.
          window.dispatchEvent(new CustomEvent('srfs-tour-spotlight-on'))
          setTimeout(() => {
            if (cancelled) return
            window.dispatchEvent(new CustomEvent('srfs-tour-spotlight-off'))
            startTour()
          }, 2800)
        }
      } catch (err) {
        console.warn('Unable to load tutorial status:', err)
      }
    }
    checkFirstTour()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const finishTour = useCallback(async (finalStatus) => {
    if (savingRef.current) return
    savingRef.current = true
    setRun(false)
    broadcastTourState(false)
    updateUser({ tutorialStatus: finalStatus })
    try {
      await api.put('/api/auth/tutorial', { tutorialStatus: finalStatus })
    } catch (err) {
      console.warn('Unable to save tutorial status:', err)
    } finally {
      savingRef.current = false
    }
  }, [broadcastTourState, updateUser])

  const handleEvent = useCallback((data) => {
    const { type, status } = data
    if (type === EVENTS.TOUR_END) {
      finishTour(status === STATUS.SKIPPED ? 'skipped' : 'completed')
    }
  }, [finishTour])

  if (!user || !steps.length) return null

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      spotlightPadding={16}
      onEvent={handleEvent}
      tooltipComponent={TourTooltip}
      locale={{ back: 'Back', close: 'Finish', last: 'Finish', next: 'Next', skip: 'Skip' }}
      styles={{
        options: {
          primaryColor: '#0891b2',
          backgroundColor: '#162329',
          textColor: '#e8f0f2',
          arrowColor: '#162329',
          overlayColor: 'rgba(11, 20, 25, 0.72)',
          zIndex: 10000,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  )
}

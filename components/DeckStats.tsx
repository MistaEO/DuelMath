import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Card } from '../types';

interface DeckStatsProps {
  cards: Card[];
}

export const DeckStats: React.FC<DeckStatsProps> = ({ cards }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!cards.length || !svgRef.current) return;

    // Categorize
    const counts = {
      Monster: 0,
      Spell: 0,
      Trap: 0
    };

    cards.forEach(c => {
      if (c.type.includes('Monster')) counts.Monster++;
      else if (c.type.includes('Spell')) counts.Spell++;
      else if (c.type.includes('Trap')) counts.Trap++;
    });

    const data = Object.entries(counts).map(([label, value]) => ({ label, value }));
    const total = cards.length;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 200;
    const height = 200;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal()
      .domain(["Monster", "Spell", "Trap"])
      .range(["#f59e0b", "#10b981", "#ec4899"]);

    const pie = d3.pie<{ label: string; value: number }>()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius);

    const arcs = svg.selectAll("arc")
      .data(pie(data))
      .enter()
      .append("g")
      .attr("class", "arc");

    arcs.append("path")
      .attr("d", arc)
      // @ts-ignore - D3 type mismatch with scaleOrdinal often happens, casting is okay or ignore
      .attr("fill", d => color(d.data.label))
      .attr("stroke", "#0f172a")
      .style("stroke-width", "2px");

    // Add center text
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .text(total)
      .attr("fill", "white")
      .style("font-size", "24px")
      .style("font-weight", "bold");

    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .text("Cards")
      .attr("fill", "#94a3b8")
      .style("font-size", "12px");

  }, [cards]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl border border-slate-700">
      <h3 className="mb-2 text-sm font-semibold text-slate-400 uppercase tracking-wider">Composition</h3>
      <svg ref={svgRef}></svg>
      <div className="flex gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Monster</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Spell</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Trap</div>
      </div>
    </div>
  );
};
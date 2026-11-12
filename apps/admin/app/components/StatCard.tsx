"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  badge?: {
    text: string;
    tone: "success" | "warning" | "info";
  };
  icon?: string;
}

export function StatCard({ label, value, subValue, badge, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && <span style={{ fontSize: "18px" }}>{icon}</span>}
      </div>

      <div className="stat-value">{value}</div>

      {(subValue || badge) && (
        <div className="stat-footer">
          {badge && <span className={`stat-pill ${badge.tone}`}>{badge.text}</span>}
          {subValue && <span style={{ color: "var(--text-secondary)" }}>{subValue}</span>}
        </div>
      )}
    </div>
  );
}


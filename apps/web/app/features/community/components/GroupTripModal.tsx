"use client";

import React, { useState } from "react";
import type { GroupTrip, MarketRoute } from "../types";
import type { GroupChatMessage } from "../initial-data";

interface GroupTripModalProps {
  trip: GroupTrip | null;
  onClose: () => void;
  activeUsername: string;
  groupMessages: GroupChatMessage[];
  marketRoutes: MarketRoute[];
  userSavedRoutes: string[];
  initialTab?: "overview" | "route" | "members" | "chat";
  onAddToMyTrip: (route: { title: string; stops?: unknown[] }) => void;
  onSendMessage: (text: string, attachedRouteTitle?: string, isAnnouncement?: boolean) => void;
}

export function GroupTripModal({
  trip,
  onClose,
  activeUsername,
  groupMessages,
  marketRoutes: _marketRoutes,
  userSavedRoutes,
  initialTab = "overview",
  onAddToMyTrip,
  onSendMessage,
}: GroupTripModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "route" | "members" | "chat">(initialTab);
  const [chatInputText, setChatInputText] = useState("");
  const [attachedRouteTitle, setAttachedRouteTitle] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);

  if (!trip) return null;

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;

    onSendMessage(chatInputText.trim(), attachedRouteTitle || undefined, isAnnouncement);
    setChatInputText("");
    setAttachedRouteTitle("");
    setIsAnnouncement(false);
  };

  return (
    <div className="community-modal-overlay" onClick={onClose}>
      <div className="space-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="space-modal-header">
          <div className="space-header-meta">
            <span className="space-eyebrow">GRUP SEYAHATİ &amp; ETKİNLİK MASASI</span>
            <h3 className="space-title">{trip.title}</h3>
            <span className="space-dest">
              📍 {trip.destination} · {trip.dates}
            </span>
          </div>
          <button type="button" className="btn-modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-sub-tabs">
          <button
            type="button"
            className={`space-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📋 Genel Bakış
          </button>
          <button
            type="button"
            className={`space-tab-btn ${activeTab === "route" ? "active" : ""}`}
            onClick={() => setActiveTab("route")}
          >
            🗺️ Rota &amp; Duraklar
          </button>
          <button
            type="button"
            className={`space-tab-btn ${activeTab === "members" ? "active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            👥 Katılımcılar ({trip.attendees.length})
          </button>
          <button
            type="button"
            className={`space-tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            💬 Grup Sohbeti
          </button>
        </div>

        <div className="space-modal-body">
          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="overview-tab-content">
              <p className="overview-desc">{trip.description}</p>
              <div className="overview-metrics-grid">
                <div className="metric-box">
                  <span>Tarih</span>
                  <strong>{trip.dates}</strong>
                </div>
                <div className="metric-box">
                  <span>Kapasite</span>
                  <strong>
                    {trip.attendees.length} / {trip.capacity} Kişi
                  </strong>
                </div>
                <div className="metric-box">
                  <span>Buluşma Noktası</span>
                  <strong>{trip.meetingPoint}</strong>
                </div>
                <div className="metric-box">
                  <span>Katılım Ücreti</span>
                  <strong>
                    {trip.pricePerPerson && trip.pricePerPerson > 0
                      ? `${trip.pricePerPerson} ₺`
                      : "Ücretsiz"}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Route */}
          {activeTab === "route" && (
            <div className="route-tab-content">
              <div className="route-action-banner">
                <span>
                  Bu gezi için belirlenen resmi duraklar haritada görüntülenmeye hazırdır.
                </span>
                <button
                  type="button"
                  className="btn-action-small"
                  onClick={() => onAddToMyTrip({ title: trip.title, stops: trip.routeStops })}
                >
                  ➕ Seyahatime Ekle
                </button>
              </div>

              <ol className="stops-ordered-list">
                {trip.routeStops.map((stop, idx) => (
                  <li key={idx} className="stop-item-row">
                    <span className="stop-number-circle">{idx + 1}</span>
                    <div>
                      <strong>{stop.label}</strong>
                      <p>{stop.address}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tab 3: Members */}
          {activeTab === "members" && (
            <div className="members-tab-content">
              <h4>Grup Katılımcıları &amp; Başvurular</h4>
              <div className="attendees-list">
                {trip.attendees.map((att) => (
                  <div key={att.id} className="attendee-card-row">
                    <div className="attendee-info">
                      <strong>@{att.username}</strong>
                      <p>&quot;{att.note}&quot;</p>
                    </div>
                    <span className={`status-badge ${att.status}`}>
                      {att.status === "approved" ? "✓ Onaylandı" : "⏳ Beklemede"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Chat */}
          {activeTab === "chat" && (
            <div className="chat-tab-content">
              <div className="chat-messages-scroll">
                {groupMessages
                  .filter((m) => m.tripId === trip.id)
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat-bubble ${msg.isAnnouncement ? "announcement" : ""} ${
                        msg.senderUsername === activeUsername ? "me" : "other"
                      }`}
                    >
                      <div className="bubble-header">
                        <strong>{msg.senderDisplayName}</strong>
                        <span>{msg.createdAt}</span>
                      </div>
                      <p>{msg.text}</p>

                      {/* Ekli Gezi Rotası & Arkadaş Bulma Kartı */}
                      {msg.attachedRoute && (
                        <div className="chat-attached-route-card">
                          <div className="attached-route-info">
                            <span className="material-symbols-outlined text-[#10B981]">map</span>
                            <div>
                              <strong>{msg.attachedRoute.title}</strong>
                              <p>
                                {msg.attachedRoute.stopsCount} Durak ·{" "}
                                {msg.attachedRoute.destination}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/desk/?route=${encodeURIComponent(msg.attachedRoute.title)}`}
                            className="btn-inspect-attached-route"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Rotayı İncele &amp; Katıl ➔
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Chat Form */}
              <form onSubmit={handleChatSubmit} className="chat-send-form">
                {trip.organizerUsername === activeUsername && (
                  <label className="announcement-checkbox-label">
                    <input
                      type="checkbox"
                      checked={isAnnouncement}
                      onChange={(e) => setIsAnnouncement(e.target.checked)}
                    />
                    <span>📢 Organizatör Duyurusu Olarak Gönder</span>
                  </label>
                )}

                {/* Gezi Rotası Paylaş & Arkadaş Bul Barı */}
                <div className="chat-route-share-bar">
                  <span className="material-symbols-outlined text-[17px] text-[#10B981]">
                    route
                  </span>
                  <select
                    className="chat-route-select"
                    value={attachedRouteTitle}
                    onChange={(e) => setAttachedRouteTitle(e.target.value)}
                  >
                    <option value="">
                      (İsteğe Bağlı) Mesaja Gezi Rotası Ekle &amp; Arkadaş Ara...
                    </option>
                    {userSavedRoutes.map((rTitle, idx) => (
                      <option key={idx} value={rTitle}>
                        🗺️ {rTitle}
                      </option>
                    ))}
                    <option value="İstanbul Tarihi Yarımada & Boğaz">
                      🗺️ İstanbul Tarihi Yarımada &amp; Boğaz
                    </option>
                    <option value="Roma Antik Miras & Trastevere">
                      🗺️ Roma Antik Miras &amp; Trastevere
                    </option>
                    <option value="Kapadokya Vadileri & Gün Batımı">
                      🗺️ Kapadokya Vadileri &amp; Gün Batımı
                    </option>
                  </select>
                </div>

                <div className="input-with-button">
                  <input
                    type="text"
                    placeholder={
                      attachedRouteTitle
                        ? "Rotanız hakkında bir şeyler yazın..."
                        : "Gruba mesaj yazın veya rota paylaşıp gezi arkadaşı arayın..."
                    }
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    className="chat-text-input"
                  />
                  <button type="submit" className="chat-send-btn">
                    Gönder
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

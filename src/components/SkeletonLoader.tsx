// Reusable skeleton components for loading states

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-image" />
      <div className="skeleton-text skeleton-text-lg" />
      <div className="skeleton-text skeleton-text-sm" />
    </div>
  );
}

export function SkeletonOverview() {
  return (
    <div className="overview-page">
      {/* Banner skeleton */}
      <div className="overview-banner">
        <div
          className="skeleton-image"
          style={{ width: "120px", height: "120px", borderRadius: "50%" }}
        />
        <div className="overview-banner-info" style={{ flex: 1 }}>
          <div
            className="skeleton-text skeleton-text-xl"
            style={{ width: "200px", marginBottom: "12px" }}
          />
          <div
            className="skeleton-text skeleton-text-md"
            style={{ width: "150px", marginBottom: "16px" }}
          />
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "100%", marginBottom: "8px" }}
          />
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "80%", marginBottom: "16px" }}
          />
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "200px" }}
          />
        </div>
      </div>

      {/* Stats row skeleton - 4 cards */}
      <div className="overview-stats-row">
        {/* Top Artist Card */}
        <div className="overview-stat-card-large">
          <div
            className="skeleton-image"
            style={{ width: "80px", height: "80px", borderRadius: "8px" }}
          />
          <div className="overview-stat-card-content">
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "80px", margin: "0 auto 8px" }}
            />
            <div
              className="skeleton-text skeleton-text-md"
              style={{ width: "120px", margin: "0 auto 4px" }}
            />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "80px", margin: "0 auto" }}
            />
          </div>
        </div>

        {/* Top Track Card */}
        <div className="overview-stat-card-large">
          <div
            className="skeleton-image"
            style={{ width: "80px", height: "80px", borderRadius: "8px" }}
          />
          <div className="overview-stat-card-content">
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "80px", margin: "0 auto 8px" }}
            />
            <div
              className="skeleton-text skeleton-text-md"
              style={{ width: "120px", margin: "0 auto 4px" }}
            />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "80px", margin: "0 auto" }}
            />
          </div>
        </div>

        {/* Total Scrobbles Card */}
        <div className="overview-stat-card-large overview-stat-card-simple">
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "100px", margin: "0 auto 12px" }}
          />
          <div
            className="skeleton-text skeleton-text-xl"
            style={{ width: "120px", margin: "0 auto", height: "32px" }}
          />
        </div>

        {/* Member Since Card */}
        <div className="overview-stat-card-large overview-stat-card-simple">
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "100px", margin: "0 auto 12px" }}
          />
          <div
            className="skeleton-text skeleton-text-xl"
            style={{ width: "80px", margin: "0 auto", height: "32px" }}
          />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCharts() {
  return (
    <div className="charts-section">
      <div className="section-header">
        <div
          className="skeleton-text skeleton-text-title"
          style={{ width: "150px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "250px" }}
        />
      </div>

      <div className="charts-controls">
        <div className="control-group">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-button" />
          ))}
        </div>
      </div>

      <div className="charts-controls-row">
        <div className="control-group">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-button" />
          ))}
        </div>
        <div className="control-group">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-button" />
          ))}
        </div>
      </div>

      <div className="chart-grid chart-grid-6x6">
        {Array.from({ length: 36 }).map((_, i) => (
          <div key={i} className="chart-cell">
            <div
              className="skeleton-image"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonRecent() {
  return (
    <div className="recent-section">
      <div className="section-header">
        <div
          className="skeleton-text skeleton-text-title"
          style={{ width: "150px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "250px" }}
        />
      </div>

      {/* Header card skeleton */}
      <div className="recent-header-card">
        <div
          className="skeleton-image"
          style={{ width: "80px", height: "80px" }}
        />
        <div style={{ flex: 1 }}>
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "100px", marginBottom: "8px" }}
          />
          <div
            className="skeleton-text skeleton-text-md"
            style={{ width: "200px", marginBottom: "4px" }}
          />
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "150px", marginBottom: "4px" }}
          />
          <div
            className="skeleton-text skeleton-text-sm"
            style={{ width: "180px" }}
          />
        </div>
      </div>

      {/* Track list skeleton */}
      <div className="recent-list">
        {Array.from({ length: 49 }).map((_, i) => (
          <div key={i} className="recent-list-row">
            <div
              className="skeleton-image"
              style={{ width: "48px", height: "48px" }}
            />
            <div style={{ flex: 1 }}>
              <div
                className="skeleton-text skeleton-text-sm"
                style={{ width: "60%", marginBottom: "4px" }}
              />
              <div
                className="skeleton-text skeleton-text-sm"
                style={{ width: "40%" }}
              />
            </div>
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "60px" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTaste() {
  return (
    <div className="taste-section">
      <div className="section-header">
        <div
          className="skeleton-text skeleton-text-title"
          style={{ width: "150px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "300px" }}
        />
      </div>

      <div className="taste-list">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="taste-row">
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "32px" }}
            />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "180px" }}
            />
            <div className="skeleton-bar" style={{ flex: 1 }} />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "48px" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonWrapped() {
  return (
    <div className="wrapped-container">
      <div className="section-header">
        <div
          className="skeleton-text skeleton-text-title"
          style={{ width: "180px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "350px" }}
        />
      </div>

      <div className="wrapped-header">
        <div className="wrapped-controls">
          <div className="control-group">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton-button" />
            ))}
          </div>
        </div>
        <div
          className="skeleton-button"
          style={{ width: "40px", height: "40px", borderRadius: "50%" }}
        />
      </div>

      <div className="wrapped-slides" style={{ height: "480px" }}>
        <div
          className="wrapped-slide"
          style={{
            background: "#111111",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "700px" }}>
            <div
              className="skeleton-text skeleton-text-sm"
              style={{
                width: "150px",
                margin: "0 auto 48px",
                background: "rgba(255,255,255,0.2)",
              }}
            />
            <div
              className="skeleton-text skeleton-text-xl"
              style={{
                width: "300px",
                margin: "0 auto 48px",
                height: "48px",
                background: "rgba(255,255,255,0.2)",
              }}
            />
            <div
              className="skeleton-text"
              style={{
                width: "400px",
                margin: "0 auto",
                height: "80px",
                background: "rgba(255,255,255,0.2)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="wrapped-nav">
        <div className="skeleton-button" style={{ width: "80px" }} />
        <div className="wrapped-nav-dots">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="wrapped-nav-dot" />
          ))}
        </div>
        <div className="skeleton-button" style={{ width: "80px" }} />
      </div>

      <div className="page-based-on">
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "200px", margin: "0 auto" }}
        />
      </div>
    </div>
  );
}

export function SkeletonDiscover() {
  return (
    <div className="discover-section">
      <div className="section-header">
        <div
          className="skeleton-text skeleton-text-title"
          style={{ width: "180px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "350px" }}
        />
      </div>

      <div className="discover-controls">
        <div className="control-group">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-button" />
          ))}
        </div>
      </div>

      {/* Discovery score card skeleton */}
      <div className="discover-score-card">
        <div
          className="skeleton-text skeleton-text-xl"
          style={{ width: "150px", margin: "0 auto 16px" }}
        />
        <div
          className="skeleton-text skeleton-text-md"
          style={{ width: "200px", margin: "0 auto 32px" }}
        />

        <div className="discover-score-bars">
          <div className="discover-score-bar-row">
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "100px" }}
            />
            <div className="skeleton-bar" style={{ flex: 1 }} />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "48px" }}
            />
          </div>
          <div className="discover-score-bar-row">
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "100px" }}
            />
            <div className="skeleton-bar" style={{ flex: 1 }} />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "48px" }}
            />
          </div>
        </div>

        <div className="discover-score-extremes">
          <div className="discover-score-extreme">
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "120px", margin: "0 auto 8px" }}
            />
            <div
              className="skeleton-text skeleton-text-md"
              style={{ width: "150px", margin: "0 auto 4px" }}
            />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "100px", margin: "0 auto" }}
            />
          </div>
          <div className="discover-score-extreme">
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "120px", margin: "0 auto 8px" }}
            />
            <div
              className="skeleton-text skeleton-text-md"
              style={{ width: "150px", margin: "0 auto 4px" }}
            />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "100px", margin: "0 auto" }}
            />
          </div>
        </div>
      </div>

      {/* Recommendations skeleton */}
      <div className="discover-recommendations">
        <div
          className="skeleton-text skeleton-text-lg"
          style={{ width: "250px", marginBottom: "8px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "200px", marginBottom: "24px" }}
        />

        <div className="discover-tabs">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-button" />
          ))}
        </div>

        <div className="discover-rec-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="discover-rec-card">
              <div
                className="skeleton-image"
                style={{ width: "100%", aspectRatio: "1" }}
              />
              <div
                className="skeleton-text skeleton-text-md"
                style={{ width: "80%", marginTop: "12px" }}
              />
              <div
                className="skeleton-text skeleton-text-sm"
                style={{ width: "60%", marginTop: "4px" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonInsights() {
  return (
    <div className="insights-section">
      <div className="section-header">
        <div
          className="skeleton-text skeleton-text-title"
          style={{ width: "150px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "300px" }}
        />
      </div>

      {/* Personality skeleton */}
      <div className="insights-personality">
        <div
          className="skeleton-text skeleton-text-lg"
          style={{ width: "200px", marginBottom: "24px" }}
        />

        <div className="insights-personality-result">
          <div className="insights-personality-header">
            <div
              className="skeleton-text skeleton-text-xl"
              style={{ width: "250px", margin: "0 auto 16px" }}
            />
            <div
              className="skeleton-text skeleton-text-sm"
              style={{ width: "300px", margin: "0 auto" }}
            />
          </div>

          <div className="insights-dimensions">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="insights-dimension">
                <div className="insights-dimension-header">
                  <div
                    className="skeleton-text skeleton-text-sm"
                    style={{ width: "100px" }}
                  />
                  <div
                    className="skeleton-text skeleton-text-sm"
                    style={{ width: "50px" }}
                  />
                </div>
                <div className="skeleton-bar" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compatibility skeleton */}
      <div className="insights-compatibility">
        <div
          className="skeleton-text skeleton-text-lg"
          style={{ width: "200px", marginBottom: "24px" }}
        />
        <div className="insights-compare-form">
          <div className="skeleton-input" style={{ flex: 1 }} />
          <div className="skeleton-button" style={{ width: "100px" }} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonStreaks() {
  return (
    <div className="streaks-section">
      <div className="section-header">
        <div
          className="skeleton-text skeleton-text-title"
          style={{ width: "150px" }}
        />
        <div
          className="skeleton-text skeleton-text-sm"
          style={{ width: "320px" }}
        />
      </div>

      {["artist streaks", "track streaks", "album streaks"].map((label) => (
        <div key={label} className="streaks-category">
          <div
            className="skeleton-text skeleton-text-lg"
            style={{ width: "160px", marginBottom: "16px" }}
          />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="streaks-row">
              <div
                className="skeleton-text skeleton-text-sm"
                style={{ width: "24px", flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div
                  className="skeleton-text skeleton-text-md"
                  style={{ width: "55%", marginBottom: "6px" }}
                />
                <div
                  className="skeleton-text skeleton-text-sm"
                  style={{ width: "35%" }}
                />
              </div>
              <div
                className="skeleton-text skeleton-text-sm"
                style={{ width: "80px" }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

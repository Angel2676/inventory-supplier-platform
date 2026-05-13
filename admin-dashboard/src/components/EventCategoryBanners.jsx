function EventCategoryBanners({ onSelectType }) {
  const categories = [
    {
      type: "football",
      title: "Football Events",
      subtitle: "Serie A, Premier League, Champions League and top European matches.",
      label: "Explore football"
    },
    {
      type: "concert",
      title: "Live Concerts",
      subtitle: "Italian and international concerts with real-time ticket availability.",
      label: "Explore concerts"
    },
    {
      type: "formula_1",
      title: "Formula 1",
      subtitle: "Grand Prix inventory and premium motorsport ticket access.",
      label: "Explore F1"
    }
  ];

  return (
    <div className="category-banners-grid">
      {categories.map((category) => (
        <button
          key={category.type}
          type="button"
          className={`category-banner category-${category.type}`}
          onClick={() => onSelectType(category.type)}
        >
          <div>
            <span>SportManiaTravel</span>
            <h3>{category.title}</h3>
            <p>{category.subtitle}</p>
          </div>

          <strong>{category.label}</strong>
        </button>
      ))}
    </div>
  );
}

export default EventCategoryBanners;
function EventCategoryBanners({ selectedType = "", onSelectType }) {
  const categories = [
    {
      type: "football",
      title: "Football Events",
      subtitle:
        "Serie A, Premier League, Champions League and top European matches.",
      label: "Explore football"
    },
    {
      type: "concert",
      title: "Live Concerts",
      subtitle:
        "Italian and international concerts with real-time ticket availability.",
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
      {categories.map((category) => {
        const isSelected = selectedType === category.type;

        return (
          <button
            key={category.type}
            type="button"
            className={`category-banner category-${category.type} ${
              isSelected ? "category-banner-selected" : ""
            }`}
            onClick={() => onSelectType(category.type)}
          >
            {isSelected && (
              <div className="category-selected-badge">✓ Selected</div>
            )}

            <div>
              <span>SportManiaTravel</span>
              <h3>{category.title}</h3>
              <p>{category.subtitle}</p>
            </div>

            <strong>{isSelected ? "Selected" : category.label}</strong>
          </button>
        );
      })}
    </div>
  );
}

export default EventCategoryBanners;

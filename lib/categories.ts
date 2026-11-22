export const categories: Record<string, string[]> = {
  cafe: ['Coffee', 'Food', 'Ambience', 'Service'],
  bar: ['Drinks', 'Music', 'Ambience', 'Service'],
  thali: ['Taste', 'Variety', 'Freshness', 'Service'],
  hotel: ['Rooms', 'Cleanliness', 'Hospitality', 'Location', 'Facilities'],
  restaurant: ['Food', 'Service', 'Cleanliness', 'Ambience', 'Staff'],
  optical: ['Frame collection', 'Lens quality', 'Eye testing', 'Staff assistance', 'Pricing'],
  jewellery: ['Collection', 'Craftsmanship', 'Staff assistance', 'Pricing'],
  salon: ['Service', 'Cleanliness', 'Staff', 'Comfort'],
  clinic: ['Communication', 'Cleanliness', 'Waiting time', 'Staff assistance'],
  retail: ['Selection', 'Service', 'Pricing'],
  automobile: ['Service', 'Communication', 'Timeliness', 'Pricing'],
  education: ['Teaching', 'Facilities', 'Communication'],
  professional: ['Communication', 'Service', 'Timeliness'],
  general: ['Service', 'Communication', 'Pricing', 'Overall experience'],
};
export const sentiments = ['positive', 'neutral', 'critical'] as const;

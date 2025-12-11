import places from '@/backend/places.json';
import './VillageLabels.css';

export const createVillageLabelMarkers = (L: any) => {
  const villagePlaces = places.filter(place => place.category === 'Village');

  return villagePlaces.map(village => {
    const icon = L.divIcon({
      className: 'village-label',
      html: `<div>${village.name}</div>`,
      iconSize: [100, 40],
    });

    return L.marker([village.latitude, village.longitude], { icon: icon, zIndexOffset: 1000 });
  });
};

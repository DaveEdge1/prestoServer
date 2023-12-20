const duesseldorf = L.latLng(35.2, -111.645);
const osm = L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

const map = L.map($('.map')[0], {
  center: duesseldorf,
  zoom: 10,
  layers: [osm]
});

map.addLayer(L.marker(duesseldorf));

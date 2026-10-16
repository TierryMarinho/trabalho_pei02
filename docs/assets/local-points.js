// Base inicial limitada à Grande Vitória. Cadastros consultados em 15/10/2026.
// Fonte municipal: https://ecopontos.vilavelha.es.gov.br/
// Fonte OSM: consulta Overpass a https://maps.mail.ru/osm/tools/overpass/api/interpreter
// Os pontos não foram vistoriados; confirme funcionamento e aceitação.
export const LOCAL_POINTS = [
  {
    "key": "pmvv/232",
    "name": "PEV Eletrônicos — Paul",
    "address": "Rua da Lancha, 211, 29103, Vila Velha",
    "lat": -20.328309499802472,
    "lon": -40.33789852352126,
    "accepted": [
      "Eletrônicos",
      "TVs e monitores"
    ],
    "filters": [
      "electronics",
      "large"
    ],
    "hours": "Seg. a sex.: 08h–16h40; sáb.: 07h–12h (confirme)",
    "phone": "",
    "osmUrl": "https://ecopontos.vilavelha.es.gov.br/",
    "sourceLabel": "Prefeitura de Vila Velha",
    "sourceDate": "15/10/2026"
  },
  {
    "key": "node/3198772691",
    "name": "Eco Ponto — Revertec",
    "address": "Vitória, ES. Endereço de rua não informado no cadastro; consulte o mapa.",
    "lat": -20.3132181,
    "lon": -40.289044,
    "accepted": [
      "Eletrônicos",
      "Computadores",
      "Celulares",
      "Pilhas e baterias",
      "TVs e monitores"
    ],
    "filters": [
      "electronics",
      "batteries",
      "large"
    ],
    "hours": "",
    "phone": "",
    "osmUrl": "https://www.openstreetmap.org/node/3198772691",
    "sourceLabel": "OpenStreetMap",
    "sourceDate": "15/10/2026"
  }
];

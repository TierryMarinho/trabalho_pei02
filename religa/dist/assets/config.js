// Endpoints públicos, sem chaves. Ajuste aqui se um provedor mudar.
// Projetado para demonstração acadêmica de baixo tráfego.
export const CONFIG = Object.freeze({
  cep: 'https://viacep.com.br/ws/',
  cepCoordinates: 'https://cep.awesomeapi.com.br/json/',
  geocoder: 'https://photon.komoot.io',
  overpass: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  overpassFallback: 'https://overpass.private.coffee/api/interpreter',
  timeout: 15000,
  pointsTimeout: 32000,
  cacheDuration: 10 * 60 * 1000,
  maxRadius: 50000,
  resultPageSize: 6,
});

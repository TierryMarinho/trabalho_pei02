import { CONFIG } from './config.js';
import { LOCAL_POINTS } from './local-points.js';

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function parseSearch(value) {
  const text = String(value).trim();
  if (!text) throw new Error('Digite um CEP ou endereço para começar.');
  if (/^[\d\s.\-]+$/.test(text)) {
    const cep = text.replace(/\D/g, '');
    if (cep.length !== 8) throw new Error('O CEP precisa ter 8 números. Exemplo: 29101-010.');
    return { type: 'cep', value: cep };
  }
  if (text.length < 5) throw new Error('Informe a rua e a cidade, ou um CEP com 8 números.');
  return { type: 'address', value: text };
}

export function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function haversine(a, b) {
  if (!validCoordinates(a.lat, a.lon) || !validCoordinates(b.lat, b.lon)) throw new Error('Coordenadas inválidas.');
  const rad = Math.PI / 180;
  const dLat = (b.lat-a.lat)*rad, dLon=(b.lon-a.lon)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}

export const MATERIAL_TAGS = Object.freeze({
  electronics: ['electrical_items','small_electrical_appliances','computers','mobile_phones','electronics','e_waste'],
  batteries: ['batteries'],
  large: ['white_goods','electrical_appliances','tv_monitor'],
});
export const TAG_LABELS = Object.freeze({
  electrical_items:'Eletrônicos', small_electrical_appliances:'Pequenos aparelhos', computers:'Computadores',
  mobile_phones:'Celulares', electronics:'Eletrônicos', e_waste:'Eletrônicos', batteries:'Pilhas e baterias',
  white_goods:'Linha branca', electrical_appliances:'Eletrodomésticos', tv_monitor:'TVs e monitores',
});

export function tagsFor(material) {
  if (material === 'all') return [...new Set(Object.values(MATERIAL_TAGS).flat())];
  if (!MATERIAL_TAGS[material]) throw new Error('Selecione um tipo de material válido.');
  return MATERIAL_TAGS[material];
}

export function buildQuery(origin, radius, material) {
  if (!validCoordinates(origin.lat, origin.lon)) throw new Error('Localização inválida.');
  if (![10000,25000,50000].includes(Number(radius))) throw new Error('Selecione uma distância válida.');
  // Arredondar o centro evita enviar a posição precisa do dispositivo.
  // Mais 250 m garantem cobertura do círculo original antes do filtro exato.
  const lat=Number(origin.lat).toFixed(3), lon=Number(origin.lon).toFixed(3);
  const tagPattern=tagsFor(material).join('|');
  // Uma única seleção espacial evita repetir a consulta para cada material.
  return `[out:json][timeout:25];nwr(around:${Number(radius)+250},${lat},${lon})[~"^recycling:(${tagPattern})$"~"^yes$"];out center tags;`;
}

export function normalizePoints(elements, origin, radius, material) {
  const allowed=tagsFor(material), seen=new Set(), result=[];
  for (const element of elements ?? []) {
    const tags=element.tags??{};
    if (['private','no'].includes(tags.access) || tags.disused==='yes' || tags.abandoned==='yes' || tags.demolished==='yes') continue;
    if (!allowed.some(tag=>tags[`recycling:${tag}`]==='yes')) continue;
    const position={lat:element.lat??element.center?.lat,lon:element.lon??element.center?.lon};
    if (!validCoordinates(position.lat,position.lon)) continue;
    if (!['node','way','relation'].includes(element.type) || !Number.isSafeInteger(element.id) || element.id<=0) continue;
    const distance=haversine(origin,position);
    if (distance>radius/1000) continue;
    const key=`${element.type}/${element.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const street=[tags['addr:street'],tags['addr:housenumber']].filter(Boolean).join(', ');
    const address=[street,tags['addr:suburb'],tags['addr:city'],tags['addr:state']].filter(Boolean).join(' · ') || tags['addr:full'] || 'Endereço não informado no cadastro. Consulte o mapa.';
    const accepted=[...new Set(Object.keys(TAG_LABELS).filter(tag=>tags[`recycling:${tag}`]==='yes').map(tag=>TAG_LABELS[tag]))];
    result.push({key,...position,distance,name:tags.name||tags.operator||'Ponto de coleta cadastrado',address,accepted,operator:tags.operator||'',hours:tags.opening_hours||'',phone:tags['contact:phone']||tags.phone||'',osmUrl:`https://www.openstreetmap.org/${key}`});
  }
  return result.sort((a,b)=>a.distance-b.distance);
}

export function scenario(rate) {
  const value=Math.max(20,Math.min(60,Number(rate)||20));
  return { rate:value, recycled:82*value/100, undocumented:82*(100-value)/100 };
}

export function formatDistance(distance) {
  if (distance<1) return `${Math.round(distance*1000)} m`;
  return `${distance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km`;
}

export function nearbyLocalPoints(origin,radius,material) {
  tagsFor(material);
  return LOCAL_POINTS.filter(point=>material==='all'||point.filters.includes(material))
    .map(point=>({...point,distance:haversine(origin,point)}))
    .filter(point=>point.distance<=radius/1000)
    .sort((a,b)=>a.distance-b.distance);
}

export function mapURL(point) {
  const pad=.012;
  const params=new URLSearchParams({bbox:[point.lon-pad,point.lat-pad,point.lon+pad,point.lat+pad].join(','),layer:'mapnik',marker:`${point.lat},${point.lon}`});
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}

export function routeURL(point, origin) {
  const params=new URLSearchParams({api:'1',destination:`${point.lat},${point.lon}`});
  if (origin && validCoordinates(origin.lat,origin.lon)) params.set('origin',`${origin.lat},${origin.lon}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

export function photonCandidates(data, postal) {
  const states={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
  const seen=new Set();
  return (data.features??[]).flatMap(feature=>{
    const p=feature.properties??{}, coords=feature.geometry?.coordinates??[];
    if (p.countrycode?.toUpperCase()!=='BR' || !validCoordinates(coords[1],coords[0])) return [];
    const city=p.city||p.locality||p.county||(['city','town','municipality','village'].includes(p.osm_value)?p.name:'');
    // Não usar um resultado de outra cidade para representar um CEP.
    if (postal && city && normalize(city)!==normalize(postal.localidade)) return [];
    if (postal?.uf && ![normalize(postal.uf),normalize(states[postal.uf])].includes(normalize(p.state))) return [];
    // Não confundir uma rua de nome parecido com a rua do CEP.
    if (postal?.logradouro) {
      const street=normalize(p.street || p.name).replace(/\b(av|avenida|rua|r|travessa)\b\.?/g,'').replace(/\s+/g,' ').trim();
      const expected=normalize(postal.logradouro).replace(/\b(av|avenida|rua|r|travessa)\b\.?/g,'').replace(/\s+/g,' ').trim();
      if(street!==expected) return [];
    }
    const parts=[p.name,[p.street,p.housenumber].filter(Boolean).join(', '),p.district,city,p.state,p.postcode].filter(Boolean);
    const label=[...new Set(parts)].join(' · ');
    const key=`${coords[1].toFixed(5)},${coords[0].toFixed(5)}`;
    if (!label||seen.has(key)) return [];
    seen.add(key);
    const atCity=!p.street && ['city','town','municipality','village'].includes(p.osm_value);
    const precision=atCity?'Centro aproximado da cidade. Use a localização do dispositivo para mais precisão.':postal?'Posição aproximada do CEP ou da rua; não representa necessariamente o seu imóvel.':'Posição do endereço no mapa; confirme o local antes de continuar.';
    return [{lat:coords[1],lon:coords[0],label,precision}];
  });
}

// Cache apenas em memória: desaparece ao fechar ou recarregar a página.
const cache=new Map();
let lastRequest=0;
async function getJSON(url,{timeout=CONFIG.timeout,signal}={}) {
  const cached=cache.get(url);
  if (cached && Date.now()-cached.time<CONFIG.cacheDuration) return cached.value;
  if (signal?.aborted) throw new DOMException('Busca cancelada.','AbortError');
  const wait=Math.max(0,1100-(Date.now()-lastRequest));
  if (wait) await new Promise(resolve=>setTimeout(resolve,wait));
  if (signal?.aborted) throw new DOMException('Busca cancelada.','AbortError');
  lastRequest=Date.now();
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),timeout);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'},referrerPolicy:'strict-origin-when-cross-origin'});
    if (!response.ok) throw new Error(response.status===429?'O serviço está recebendo muitas buscas. Aguarde um pouco e tente novamente.':`O serviço de consulta está indisponível no momento (HTTP ${response.status}).`);
    const value=await response.json();
    cache.set(url,{value,time:Date.now()});
    if (cache.size>30) cache.delete(cache.keys().next().value);
    return value;
  } catch(error) {
    if (signal?.aborted) throw new DOMException('Busca cancelada.','AbortError');
    if(error.name==='AbortError') throw new Error('A consulta demorou mais que o esperado. Tente novamente ou consulte as redes de coleta abaixo.');
    if(error instanceof TypeError) throw new Error('Não foi possível acessar o serviço de busca. Verifique sua conexão ou consulte as redes de coleta abaixo.');
    throw error;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export async function resolveLocation(input,signal) {
  const parsed=parseSearch(input);
  let postal=null, params;
  if (parsed.type==='cep') {
    // Coordenadas específicas do CEP evitam casar ruas apenas por similaridade.
    try {
      const data=await getJSON(`${CONFIG.cepCoordinates}${parsed.value}`,{signal});
      const lat=Number(data.lat),lon=Number(data.lng);
      if(data.cep===parsed.value && data.city && data.state && data.lat && data.lng && validCoordinates(lat,lon) && lat>=-34 && lat<=6 && lon>=-74 && lon<=-28) {
        const label=[data.address,data.district,`${data.city} / ${data.state}`,parsed.value.replace(/(\d{5})(\d{3})/,'$1-$2')].filter(Boolean).join(' · ');
        return {candidates:[{lat,lon,label,precision:'Posição aproximada do CEP; não representa necessariamente o seu imóvel.'}],postalLabel:label};
      }
    } catch(error) { if(signal?.aborted)throw error; }
    postal=await getJSON(`${CONFIG.cep}${parsed.value}/json/`,{signal});
    if(postal.erro) throw new Error('CEP não encontrado. Confira os números ou tente informar o endereço completo.');
    if(!postal.localidade) throw new Error('O serviço de CEP retornou um endereço incompleto. Tente buscar pela rua e cidade.');
    params=new URLSearchParams({countrycode:'BR',city:postal.localidade,limit:'6'});
    if(postal.logradouro) params.set('street',postal.logradouro);
    const data=await getJSON(`${CONFIG.geocoder}/structured?${params}`,{signal});
    let results=photonCandidates(data,postal);
    if(!results.length) {
      // Fallback explícito para o centro municipal: sempre requer confirmação.
      const data=await getJSON(`${CONFIG.geocoder}/api/?${new URLSearchParams({q:`${postal.localidade}, ${postal.uf}, Brasil`,countrycode:'BR',limit:'5'})}`,{signal});
      results=photonCandidates(data,{...postal,logradouro:''}).filter(p=>normalize(p.label).includes(normalize(postal.localidade))).map(p=>({...p,precision:'Não localizamos a rua deste CEP. Esta é uma referência aproximada da cidade. Use a localização do dispositivo para mais precisão.'}));
    }
    if(!results.length) throw new Error('O CEP existe, mas não conseguimos localizar a rua no mapa. Tente seu endereço ou use a localização do dispositivo.');
    return {candidates:results,postalLabel:[postal.logradouro,postal.bairro,`${postal.localidade} / ${postal.uf}`].filter(Boolean).join(' · ')};
  }
  params=new URLSearchParams({q:parsed.value,countrycode:'BR',limit:'6'});
  const data=await getJSON(`${CONFIG.geocoder}/api/?${params}`,{signal});
  const candidates=photonCandidates(data);
  if(!candidates.length) throw new Error('Endereço não encontrado no Brasil. Inclua a cidade e o estado, ou tente usar o CEP.');
  return {candidates,postalLabel:null};
}

export async function findPoints(origin,radius,material,signal) {
  const query=buildQuery(origin,radius,material);
  for (const [index,endpoint] of [CONFIG.overpass,CONFIG.overpassFallback].entries()) {
    try {
      const data=await getJSON(`${endpoint}?${new URLSearchParams({data:query})}`,{signal,timeout:CONFIG.pointsTimeout});
      if(data.remark || !Array.isArray(data.elements)) throw new Error('A base de pontos não concluiu a consulta. Tente uma distância menor ou consulte as redes de coleta.');
      return normalizePoints(data.elements,origin,radius,material);
    } catch(error) {
      if(signal?.aborted || index===1)throw error;
    }
  }
}

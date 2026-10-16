import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch,haversine,buildQuery,normalizePoints,scenario,photonCandidates,mapURL,routeURL,nearbyLocalPoints } from '../docs/assets/core.js';

test('CEP com e sem máscara; CEP incompleto não vira endereço',()=>{
  assert.deepEqual(parseSearch('29101-010'),{type:'cep',value:'29101010'});
  assert.deepEqual(parseSearch('29101010'),{type:'cep',value:'29101010'});
  assert.equal(parseSearch('Avenida Paulista, São Paulo').type,'address');
  assert.throws(()=>parseSearch('1234'),/8 números/);
  assert.throws(()=>parseSearch('  '),/Digite/);
});
test('distância geográfica conhecida e posição coincidente',()=>{
  assert.equal(haversine({lat:0,lon:0},{lat:0,lon:0}),0);
  const distance=haversine({lat:0,lon:0},{lat:0,lon:1});
  assert.ok(Math.abs(distance-111.195)<.01);
});
test('consulta exige tags de aceitação, limita raio e arredonda a origem',()=>{
  const q=buildQuery({lat:-20.329723,lon:-40.292057},25000,'batteries');
  assert.match(q,/recycling:\(batteries\)/);
  assert.doesNotMatch(q,/electrical_items/);
  assert.match(q,/-20.330,-40.292/);
  assert.throws(()=>buildQuery({lat:0,lon:0},1000000,'all'));
  assert.throws(()=>buildQuery({lat:0,lon:0},10000,'untrusted'));
});
test('pontos vêm ordenados e excluem restritos, incompatíveis, distantes e duplicatas',()=>{
  const origin={lat:-20.33,lon:-40.29};
  const make=(id,lon,tags={})=>({type:'node',id,lat:-20.33,lon,tags:{'recycling:batteries':'yes',...tags}});
  const elements=[make(1,-40.30),make(2,-40.291),make(3,-40.292,{access:'private'}),make(4,-40.29,{'recycling:batteries':'no'}),make(5,-42),make(2,-40.291),make(6,-40.29,{disused:'yes'}),{type:'node',id:7,tags:{'recycling:batteries':'yes'}}];
  const points=normalizePoints(elements,origin,10000,'batteries');
  assert.deepEqual(points.map(p=>p.key),['node/2','node/1']);
  assert.deepEqual(points[0].accepted,['Pilhas e baterias']);
});
test('geocodificação rejeita outro país e cidade incompatível com o CEP',()=>{
  const feature=(country,city,lat=-20,lon=-40)=>({properties:{countrycode:country,city,name:'Rua A'},geometry:{coordinates:[lon,lat]}});
  const data={features:[feature('BR','Vila Velha'),feature('US','Vila Velha'),feature('BR','Vila Velha',99),feature('BR','São Paulo')]};
  const result=photonCandidates(data,{localidade:'Vila Velha'});
  assert.equal(result.length,1);
  assert.match(result[0].precision,/aproximada/);
});
test('cenários mantêm 82 milhões t e comparam 20% e 60%',()=>{
  const a=scenario(20),b=scenario(60);
  assert.equal(a.recycled,16.4);assert.equal(b.recycled,49.2);
  assert.equal(b.undocumented,32.8);
  assert.equal(b.recycled+b.undocumented,82);
  assert.equal(scenario(95).rate,60);
});
test('CEP não usa rua parecida nem cidade de outro estado',()=>{
  const feature=(name,state)=>({properties:{countrycode:'BR',city:'Vila Velha',state,name},geometry:{coordinates:[-40.28,-20.34]}});
  const data={features:[feature('Avenida Antônio Gil Vellozo','ES'),feature('Avenida Antônio Ferreira de Queiroz','ES'),feature('Avenida Antônio Gil Vellozo','SP')]};
  const result=photonCandidates(data,{localidade:'Vila Velha',uf:'ES',logradouro:'Avenida Antônio Gil Vellozo'});
  assert.equal(result.length,1);
  assert.match(result[0].label,/Gil Vellozo/);
});
test('rotas e mapa usam o destino real do resultado',()=>{
  const point={lat:-20.33,lon:-40.29};
  const map=new URL(mapURL(point));assert.equal(map.searchParams.get('marker'),'-20.33,-40.29');
  const route=new URL(routeURL(point,{lat:-20.32,lon:-40.28}));
  assert.equal(route.searchParams.get('destination'),'-20.33,-40.29');
  assert.equal(route.searchParams.get('origin'),'-20.32,-40.28');
});
test('base inicial retorna pontos reais por distância e não inventa cobertura fora da região',()=>{
  const found=nearbyLocalPoints({lat:-20.342083,lon:-40.2836927},25000,'all');
  assert.equal(found.length,2);assert.ok(found[0].distance<found[1].distance);
  assert.equal(nearbyLocalPoints({lat:-23.55,lon:-46.63},25000,'all').length,0);
  assert.equal(nearbyLocalPoints({lat:-20.342083,lon:-40.2836927},25000,'batteries').length,1);
});

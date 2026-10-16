import { CONFIG } from './config.js';
import { normalize, parseSearch, resolveLocation, findPoints, nearbyLocalPoints, formatDistance, mapURL, routeURL, scenario } from './core.js';

const $=id=>document.getElementById(id);
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#${name}"/></svg>`;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state={controller:null,origin:null,points:[],shown:CONFIG.resultPageSize,material:'all',radius:25000,busy:false};

// Menu móvel: navegação por teclado e fechamento ao escolher uma seção.
$('menu-button').addEventListener('click',()=>{
  const open=$('menu-button').getAttribute('aria-expanded')!=='true';
  $('menu-button').setAttribute('aria-expanded',String(open));
  $('menu-button').setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
  $('mobile-menu').hidden=!open;
});
$('mobile-menu').querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
  $('mobile-menu').hidden=true;
  $('menu-button').setAttribute('aria-expanded','false');
  $('menu-button').setAttribute('aria-label','Abrir menu');
}));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('mobile-menu').hidden){$('mobile-menu').hidden=true;$('menu-button').setAttribute('aria-expanded','false');$('menu-button').focus();}
});

function setStatus(message,error=false) {
  $('finder-status').textContent=message;
  $('finder-status').style.color=error?'#9b3829':'#285e49';
}
function setBusy(busy) {
  state.busy=busy;
  for(const id of ['location','material','radius','search-button','geolocation-button','national-search']) $(id).disabled=busy;
  $('finder-form').setAttribute('aria-busy',String(busy));
  $('search-button').innerHTML=busy?'<span class="spinner" aria-hidden="true"></span><span>Consultando…</span>':`${icon('search')}<span>Buscar pontos próximos</span>`;
}
function newController() {
  state.controller?.abort();
  state.controller=new AbortController();
  return state.controller;
}
function resetResults() {
  $('results').hidden=true;
  $('results-list').replaceChildren();
  $('map-panel').hidden=true;
  $('collection-map').removeAttribute('src');
  state.points=[];
  state.shown=CONFIG.resultPageSize;
}
function showCandidates(candidates,postalLabel) {
  const container=$('location-choices');
  container.replaceChildren();
  setStatus(postalLabel?`CEP localizado: ${postalLabel}. Escolha a referência para a busca:`:'Encontramos estas referências. Selecione o local da sua busca:');
  candidates.forEach(candidate=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='block w-full rounded-xl border border-forest/20 bg-white p-4 text-left transition hover:bg-sage';
    const title=document.createElement('span');title.className='block text-xs font-semibold leading-6';title.textContent=candidate.label;
    const note=document.createElement('span');note.className='mt-1 block text-[10px] leading-5 text-muted';note.textContent=candidate.precision;
    button.append(title,note);
    button.addEventListener('click',()=>searchNear(candidate));
    container.append(button);
  });
  container.hidden=false;
  container.querySelector('button')?.focus();
}

$('finder-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(state.busy)return;
  try{parseSearch($('location').value);}catch(error){setStatus(error.message,true);$('location').setAttribute('aria-invalid','true');$('location').focus();return;}
  $('location').removeAttribute('aria-invalid');
  const controller=newController();
  resetResults();$('location-choices').hidden=true;setBusy(true);setStatus('Localizando o endereço…');
  try {
    const {candidates,postalLabel}=await resolveLocation($('location').value,controller.signal);
    if(controller.signal.aborted)return;
    showCandidates(candidates,postalLabel);
  } catch(error){if(error.name!=='AbortError')setStatus(error.message,true);}
  finally{if(state.controller===controller)setBusy(false);}
});

$('location').addEventListener('input',()=>{
  $('location').removeAttribute('aria-invalid');
  $('location-choices').hidden=true;
  // Resultados pertencem a uma consulta específica, nunca ao texto recém-editado.
  if(!$('results').hidden){resetResults();setStatus('Endereço alterado. Faça uma nova busca.');}
});
for(const id of ['material','radius']) $(id).addEventListener('change',()=>{
  if(!$('results').hidden){resetResults();setStatus('Filtro alterado. Faça uma nova busca para atualizar os pontos.');}
});

$('geolocation-button').addEventListener('click',()=>{
  if(state.busy)return;
  if(!navigator.geolocation){setStatus('Seu navegador não oferece localização. Informe o CEP ou endereço.',true);return;}
  const controller=newController();
  resetResults();$('location-choices').hidden=true;setBusy(true);setStatus('Aguardando a permissão de localização do navegador…');
  navigator.geolocation.getCurrentPosition(position=>{
    if(controller.signal.aborted)return;
    const {latitude:lat,longitude:lon,accuracy}=position.coords;
    if(lat< -34 ||lat>6 ||lon< -74 ||lon> -28){setBusy(false);setStatus('Este localizador está preparado para buscas no Brasil. Informe um CEP brasileiro.',true);return;}
    setBusy(false);
    searchNear({lat,lon,label:'Localização do dispositivo',precision:`Precisão informada pelo dispositivo: aproximadamente ${Math.round(accuracy)} m.`});
  },error=>{
    if(controller.signal.aborted)return;
    setBusy(false);
    const messages={1:'A localização não foi autorizada. Você pode buscar pelo CEP ou endereço.',2:'Não foi possível determinar sua localização. Tente um CEP ou endereço.',3:'A localização demorou para responder. Tente novamente ou informe seu CEP.'};
    setStatus(messages[error.code]||'Localização indisponível. Informe um CEP ou endereço.',true);
  },{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
});

async function searchNear(origin,national=false) {
  const controller=newController();
  state.origin=origin;state.material=$('material').value;state.radius=Number($('radius').value);
  resetResults();$('location-choices').hidden=true;setBusy(true);
  setStatus(`Buscando pontos cadastrados a até ${state.radius/1000} km. Isso pode levar alguns segundos…`);
  try {
    const local=nearbyLocalPoints(origin,state.radius,state.material);
    let points=local, source='Base inicial da Grande Vitória, consultada em 15/10/2026. Cobertura limitada.';
    let networkFailure='';
    if(national||!local.length){
      try{
        const online=await findPoints(origin,state.radius,state.material,controller.signal);
        points=[...new Map([...local,...online].map(point=>[point.key,point])).values()].sort((a,b)=>a.distance-b.distance);
        source='Consulta online ao OpenStreetMap'+(local.length?' e base inicial da Grande Vitória.':'.');
      }catch(error){
        if(controller.signal.aborted||!local.length)throw error;
        networkFailure='A consulta nacional está indisponível. Mantivemos os pontos da base inicial da Grande Vitória; confirme as condições com o local.';
      }
    }
    if(controller.signal.aborted)return;
    state.points=points;
    $('results-title').textContent=points.length?`${points.length} ${points.length===1?'ponto encontrado':'pontos encontrados'}`:'Nenhum ponto cadastrado encontrado';
    $('results-summary').textContent=`${source} Referência: ${origin.label}. ${origin.precision} Raio: ${state.radius/1000} km. Distâncias em linha reta.`;
    $('results').hidden=false;
    $('national-search').hidden=!local.length||national;
    setStatus(networkFailure || (points.length?'Busca concluída. Os pontos estão ordenados pela distância.':'A base não encontrou pontos com esse material na área consultada.'),!!networkFailure);
    renderPoints();
    if(points.length)showMap(points[0]);
    $('results-title').focus({preventScroll:true});
    $('results').scrollIntoView({behavior:'smooth',block:'start'});
  } catch(error){if(error.name!=='AbortError')setStatus(error.message,true);}
  finally{if(state.controller===controller)setBusy(false);}
}
$('national-search').addEventListener('click',()=>{if(state.origin&&!state.busy)searchNear(state.origin,true);});

function showMap(point) {
  $('map-panel').hidden=false;
  $('collection-map').src=mapURL(point);
  $('map-caption').textContent=point.name;
  $('collection-map').title=`Ponto de coleta: ${point.name}, no OpenStreetMap`;
  document.querySelectorAll('[data-map-key]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mapKey===point.key)));
}
function renderPoints() {
  const container=$('results-list');container.replaceChildren();
  $('more-results').hidden=state.shown>=state.points.length;
  if(!state.points.length){
    $('results-layout').classList.remove('lg:grid-cols-2');
    container.innerHTML=`<div class="rounded-2xl bg-sage p-6"><div class="mb-3 text-pine">${icon('map-pin')}</div><h4 class="font-semibold">A busca pode ir um pouco mais longe.</h4><p class="mt-2 text-sm leading-7 text-muted">Não encontrar um cadastro não significa que não exista coleta na sua região. Aumente o raio para 50 km ou consulte as redes abaixo.</p><div class="mt-5 flex flex-wrap gap-3"><a class="btn btn-primary" href="https://greeneletron.org.br/localizador" target="_blank" rel="noopener noreferrer">Consultar Green Eletron ${icon('arrow-up-right')}</a><a class="btn btn-outline" href="https://abree.org.br/pontos-de-recebimento" target="_blank" rel="noopener noreferrer">Consultar ABREE ${icon('arrow-up-right')}</a></div></div>`;
    return;
  }
  $('results-layout').classList.add('lg:grid-cols-2');
  state.points.slice(0,state.shown).forEach((point,index)=>{
    const card=document.createElement('article');card.className='result-card';
    const badges=point.accepted.map(label=>`<span class="tag">${escapeHTML(label)}</span>`).join('');
    card.innerHTML=`<div class="flex items-start justify-between gap-4"><h4 class="text-sm font-bold leading-6">${escapeHTML(point.name)}</h4><span class="shrink-0 rounded-full bg-lime px-3 py-1.5 text-xs font-bold">${formatDistance(point.distance)}</span></div>${index===0?'<p class="mt-1 text-[10px] font-semibold text-pine">Mais próximo entre os resultados encontrados</p>':''}<p class="mt-3 text-xs leading-6 text-muted">${escapeHTML(point.address)}</p><div class="mt-3 flex flex-wrap gap-1.5">${badges}</div>${point.phone?`<p class="mt-2 text-[11px] leading-5 text-muted">Contato informado: ${escapeHTML(point.phone)}</p>`:''}${point.hours?`<p class="mt-2 text-[11px] leading-5 text-muted">Horário no cadastro: ${escapeHTML(point.hours)}</p>`:'<p class="mt-2 text-[11px] text-muted">Horários não informados. Confirme antes de ir.</p>'}<div class="mt-4 flex flex-wrap items-center gap-3"><a class="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2.5 text-xs font-semibold text-white" href="${routeURL(point,state.origin)}" target="_blank" rel="noopener noreferrer">Traçar rota ${icon('route')}</a><button class="inline-flex items-center gap-1.5 rounded-full border border-forest/20 px-4 py-2.5 text-xs font-semibold hover:bg-sage" type="button" data-map-key="${point.key}" aria-pressed="false">Ver no mapa</button><a class="inline-link text-[10px] text-muted" href="${point.osmUrl}" target="_blank" rel="noopener noreferrer">Ver cadastro ↗</a></div>`;
    card.querySelector('button').addEventListener('click',()=>showMap(point));
    const source=document.createElement('p');source.className='mt-3 text-[10px] leading-5 text-muted';source.textContent=`Fonte: ${point.sourceLabel||'OpenStreetMap'} · ${point.sourceDate?'cadastro consultado em '+point.sourceDate:'consulta online'}. Confirme a aceitação do seu item.`;card.append(source);
    container.append(card);
  });
}
$('more-results').addEventListener('click',()=>{const previous=state.shown;state.shown+=CONFIG.resultPageSize;renderPoints();$('results-list').children[previous]?.querySelector('a')?.focus();});
$('clear-search').addEventListener('click',()=>{
  state.controller?.abort();setBusy(false);state.origin=null;resetResults();$('location-choices').hidden=true;
  $('location').value='';setStatus('');$('location').focus();
});

// Guias curtos, específicos para cada família de equipamento.
const guides={
  phones:{title:'Celulares e tablets',icon:'smartphone',filter:'electronics',intro:'Informações pessoais merecem cuidado até no último dia de uso.',steps:['Se ainda funciona, avalie conserto, doação ou revenda responsável.','Faça backup, saia de todas as contas e siga o apagamento indicado pelo fabricante. Remova chip e cartão de memória.','Entregue o aparelho inteiro a um ponto que aceite celulares e eletrônicos portáteis.'],warning:'Bateria inchada, danificada ou presa ao aparelho? Não tente removê-la. Peça orientação ao fabricante ou à assistência antes do transporte.'},
  computers:{title:'Computadores e notebooks',icon:'laptop',filter:'electronics',intro:'Um computador antigo ainda pode ter peças úteis e materiais recuperáveis.',steps:['Verifique se uma manutenção ou atualização pode prolongar a vida útil.','Faça backup e siga um procedimento de apagamento seguro para o HD ou SSD. Excluir arquivos não garante sua remoção definitiva.','Confirme se o ponto aceita o computador e seus acessórios. Se o aparelho não liga, consulte um serviço de destruição segura dos dados.'],warning:'Não desmonte componentes ou baterias sem orientação. TVs e monitores podem ter regras diferentes das aplicáveis a notebooks.'},
  cables:{title:'Cabos e acessórios',icon:'cable',filter:'electronics',intro:'O cabo esquecido também faz parte do ciclo dos eletrônicos.',steps:['Separe o que ainda funciona para reutilizar ou doar.','Reúna cabos, carregadores, teclados, mouses e fones sem quebrar ou queimar os componentes.','Confirme o recebimento de acessórios no ponto de coleta de eletrônicos.'],warning:'Não coloque acessórios eletrônicos na coleta comum de plástico ou metal. Não queime cabos para tentar recuperar o cobre.'},
  batteries:{title:'Pilhas e baterias',icon:'battery',filter:'batteries',intro:'O descarte precisa de atenção especial, mesmo quando a carga parece ter acabado.',steps:['Para unidades intactas, isole terminais expostos com fita não condutiva e mantenha cada unidade separada, evitando contato com metais.','Não abra, amasse ou perfure. Se a bateria estiver dentro do aparelho e não for removível pelo usuário, mantenha o equipamento inteiro.','Use um coletor específico que aceite o tipo de pilha ou bateria. Consulte o fabricante para baterias de veículos e bicicletas elétricas.'],warning:'Se estiver inchada, quente, vazando ou danificada, interrompa o uso e a carga. Peça orientação ao fabricante ou a uma assistência e confirme o recebimento especializado antes de transportar.'},
  small:{title:'Pequenos aparelhos',icon:'plug',filter:'electronics',intro:'Secadores, liquidificadores, ferros e outros aparelhos também precisam de um destino adequado.',steps:['Antes de descartar, considere reparo, manutenção ou doação se o equipamento for seguro e funcionar.','Desligue da tomada. Remova resíduos de uso sem abrir o aparelho nem mexer em componentes internos.','Consulte se o coletor aceita aquele aparelho, tamanho e quantidade. Entregue sem desmontar.'],warning:'O símbolo de reciclagem em uma peça não significa que o aparelho inteiro pode ir para a coleta seletiva comum.'},
  large:{title:'TVs e grandes aparelhos',icon:'fridge',filter:'large',intro:'Planejar a entrega evita viagens perdidas e descarte em locais inadequados.',steps:['Consulte o fabricante, a loja, a prefeitura ou uma rede de logística reversa para saber onde entregar ou agendar a retirada.','Informe o tipo, tamanho e condições do equipamento antes de transportar. Alguns pontos só recebem itens pequenos.','Mantenha o aparelho inteiro. Não quebre telas nem tente liberar gases de geladeiras ou aparelhos de ar-condicionado.'],warning:'Confirme separadamente a aceitação de TVs, geladeiras e outros itens grandes. Lâmpadas e painéis solares exigem consulta a uma rede específica.'},
};
let selectedGuide='phones';
document.querySelectorAll('[data-guide]').forEach(button=>button.addEventListener('click',()=>{
  selectedGuide=button.dataset.guide;
  const guide=guides[selectedGuide];
  $('guide-title').textContent=guide.title;$('guide-intro').textContent=guide.intro;$('guide-icon').innerHTML=icon(guide.icon);$('guide-warning').textContent=guide.warning;
  $('guide-steps').replaceChildren();
  guide.steps.forEach((step,i)=>{const li=document.createElement('li');li.className='flex gap-3 text-sm leading-7';li.innerHTML=`<span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime text-xs font-bold">${i+1}</span><span>${escapeHTML(step)}</span>`;$('guide-steps').append(li);});
  $('guide-dialog').showModal();
}));
$('close-guide').addEventListener('click',()=>$('guide-dialog').close());
$('guide-dialog').addEventListener('click',event=>{if(event.target===$('guide-dialog')){const rect=$('guide-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('guide-dialog').close();}});
$('guide-find').addEventListener('click',()=>{
  state.controller?.abort();setBusy(false);$('location-choices').hidden=true;
  $('material').value=guides[selectedGuide].filter;$('guide-dialog').close();resetResults();
  setStatus('Material selecionado. Informe seu CEP ou endereço para buscar.');
  $('pontos').scrollIntoView({behavior:'smooth'});$('location').focus({preventScroll:true});
});

function updateScenario(value) {
  const data=scenario(value), f=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
  $('recycling-rate').value=data.rate;
  $('recycling-rate').setAttribute('aria-valuetext',`${data.rate} por cento de reciclagem`);
  $('scenario-rate').textContent=`${data.rate}%`;
  $('recycled-segment').style.width=`${data.rate}%`;
  $('scenario-bar').setAttribute('aria-label',`${data.rate}% com coleta e reciclagem documentadas; ${100-data.rate}% sem coleta e reciclagem documentadas.`);
  $('recycled-amount').innerHTML=`${f(data.recycled)} <span class="text-xs font-normal">milhões t</span>`;
  $('unmanaged-amount').innerHTML=`${f(data.undocumented)} <span class="text-xs font-normal">milhões t</span>`;
  for(const [id,target] of [['scenario-current',20],['scenario-better',60]]){
    const active=data.rate===target;
    $(id).setAttribute('aria-pressed',String(active));$(id).classList.toggle('bg-forest',active);$(id).classList.toggle('text-white',active);
  }
  $('scenario-note').textContent=data.rate===20?'No cenário tendencial do relatório, a taxa cai de 22,3% em 2022 para cerca de 20% em 2030.':data.rate===60?'Com 60%, seriam 32,8 milhões t a mais com coleta e reciclagem documentadas do que no cenário de 20%. O relatório estima benefícios econômicos acima dos custos em mais de US$ 38 bilhões.':`Nesta simulação, ${f(data.recycled-16.4)} milhões t adicionais teriam coleta e reciclagem documentadas em relação ao cenário de 20%.`;
}
$('recycling-rate').addEventListener('input',event=>updateScenario(event.target.value));
$('scenario-current').addEventListener('click',()=>updateScenario(20));
$('scenario-better').addEventListener('click',()=>updateScenario(60));

const questions=[...document.querySelectorAll('.faq-item')];
$('faq-search').addEventListener('input',event=>{
  const term=normalize(event.target.value);let count=0;
  questions.forEach(question=>{
    const match=normalize(`${question.textContent} ${question.dataset.keywords}`).includes(term);
    question.hidden=!match;if(match)count++;
  });
  $('faq-empty').hidden=count>0;
  $('faq-status').textContent=term?`${count} ${count===1?'pergunta encontrada':'perguntas encontradas'}.`:'';
});

# ReLiga

Site acadêmico sobre sustentabilidade e descarte responsável de eletrônicos.
Feito em **HTML sem framework, JavaScript nativo e Tailwind CSS**. O site publicado é inteiramente estático; não há banco de dados, backend, login próprio ou chave de API no código.

## Executar

Os arquivos prontos estão em `dist/`. Sirva essa pasta com um servidor HTTP local ou hospedagem estática. Por exemplo, com Python instalado:

```sh
python -m http.server 8000 --directory dist
```

Abra `http://localhost:8000`. Como há módulos JavaScript, abrir o HTML diretamente por `file://` não é suficiente. A localização do dispositivo requer HTTPS ou localhost e permissão do visitante.

## Editar

- `dist/index.html`: conteúdo e classes Tailwind.
- `dist/assets/app.js`: interface, guias, perguntas e simulação.
- `dist/assets/core.js`: localização, busca, filtros e distâncias.
- `dist/assets/config.js`: endereços dos serviços e limites.
- `src/styles.css`: tema, componentes e estilos Tailwind.
- `dist/assets/styles.css`: CSS final, compilado e incluído no site.

Após mudar classes Tailwind ou o tema:

```sh
npm install
npm run build:css
```

O site não precisa de Node.js em produção nem do CDN de execução do Tailwind.

## Como funciona o localizador

1. CEPs brasileiros usam as coordenadas da AwesomeAPI; ViaCEP e Photon são alternativas se o serviço não responder.
2. Endereços são geocodificados pelo Photon. O visitante confirma a referência encontrada. Quando o CEP só permite localizar a cidade, a aproximação é explicitamente indicada.
3. A localização do dispositivo também pode ser usada mediante permissão.
4. Uma base inicial com dois pontos reais da Grande Vitória é retornada imediatamente quando há pontos compatíveis no raio. Os cadastros vêm do mapa oficial da Prefeitura de Vila Velha e de uma resposta real do OpenStreetMap, consultados em 15/10/2026. Não houve vistoria presencial. O botão “Consultar também a base nacional” amplia a consulta; fora da região, a consulta nacional é automática.
5. O serviço Overpass de VK Maps (com Private.coffee como alternativa) consulta cadastros do OpenStreetMap que **declaram aceitar** os materiais selecionados. Não se assume que todo ecoponto receba eletrônicos.
6. Os resultados são filtrados pelo raio de 10, 25 ou 50 km e ordenados pela fórmula de Haversine. Distância em linha reta não é distância de trajeto.
7. Um mapa mostra o ponto selecionado. O link de rota abre o Google Maps com origem e destino.

**Verificação externa:** AwesomeAPI, ViaCEP e Photon responderam às consultas de teste, com CORS. Uma consulta Overpass retornou um ponto real; outras apresentaram timeout, e a instância Private.coffee retornou HTTP 500. A base inicial evita depender desses serviços para exibir os dois pontos locais. Não foi realizada revisão visual em navegador neste ambiente.

**Limites:** a base colaborativa é incompleta e pode estar desatualizada. “Mais próximo” significa mais próximo entre os resultados cadastrados encontrados. Sem resultados não significa ausência de coleta na região. Links oficiais de Green Eletron e ABREE ficam disponíveis, inclusive quando as APIs falham. A aceitação de cada item deve ser confirmada diretamente com o ponto.

As consultas externas só ocorrem após uma ação do visitante. Há timeout, cancelamento, prevenção de requisições simultâneas na interface e cache temporário em memória. A origem enviada à consulta de pontos é arredondada a três casas decimais. O endereço ou CEP é enviado aos provedores de geocodificação; nenhum histórico é salvo em servidor próprio ou localStorage. Fontes tipográficas usam Google Fonts, com fontes de sistema como alternativa.

O Photon público é adequado a este projeto acadêmico de baixo tráfego, sem garantia de disponibilidade. Para ampla distribuição, contratar um provedor ou hospedar a geocodificação. Consulte as políticas:

- https://github.com/komoot/photon
- https://docs.awesomeapi.com.br/api-cep
- https://viacep.com.br/
- https://maps.mail.ru/osm/tools/overpass/
- https://overpass.private.coffee/
- https://www.openstreetmap.org/copyright

## Conteúdo acadêmico

Dados e projeções: Global E-waste Monitor 2024 (ITU/UNITAR). O cenário de 2030 é uma projeção daquela edição, não um dado observado nem uma projeção nova. A simulação multiplica a projeção de 82 milhões t pela taxa escolhida. Taxas intermediárias são ilustrativas. “Sem coleta e reciclagem documentadas” não é sinônimo de “nada foi reciclado”.

- https://ewastemonitor.info/the-global-e-waste-monitor-2024/
- https://www.itu.int/en/ITU-D/Environment/Pages/Publications/The-Global-E-waste-Monitor-2024.aspx
- https://unitar.org/about/news-stories/press/global-e-waste-monitor-2024-electronic-waste-rising-five-times-faster-documented-e-waste-recycling
- https://greeneletron.org.br/
- https://abree.org.br/pontos-de-recebimento
- https://www.epa.gov/recycle/used-lithium-ion-batteries
- https://ecopontos.vilavelha.es.gov.br/
- https://www.openstreetmap.org/node/3198772691

## Verificação

`npm test` verifica CEPs, distância conhecida, ordenação, filtros, exclusão de locais privados, geocodificação, simulação e links de mapa/rota. APIs públicas podem ficar indisponíveis; conferir suas respostas reais antes de uma apresentação.

## Imagem

`dist/assets/hero.webp` é uma imagem ilustrativa criada com o ImageGen integrado, sem representar um ponto real de coleta. Prompt: “Premium editorial studio still-life photograph for a Brazilian responsible electronic waste disposal website. Silver laptop, smartphone, rolled USB cable, off-white headphones on limestone podium; separate potted green plant, pale sage backdrop and abstract circular arch, natural sunlight, realistic tactile materials, no labels or logos.”

## Publicação

O diretório `dist` pode ser servido por hospedagem estática. A identidade de hospedagem em `.openai/hosting.json` é específica deste Site e não deve ser copiada para criar outro Site.

import type { Coordinates, MapShop } from './shop-map';

/** Only public map fields cross into the isolated map document. Never include a session/key. */
export function shopMapDocument(shops: MapShop[], location: Coordinates | null): string {
  const data = JSON.stringify({ shops: shops.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })), location }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UniLink registered shop map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous">
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" integrity="sha256-YU3qCpj/P06tdPBJGPax0bm6Q1wltfwjsho5TR4+TYc=" crossorigin="anonymous">
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" integrity="sha256-YSWCMtmNZNwqex4CEw1nQhvFub2lmU7vcCKP+XVwwXA=" crossorigin="anonymous">
<style>html,body,#map{height:100%;width:100%;margin:0;background:#eaf0f6}body{font-family:system-ui}.shop-pin{background:none;border:0}.pin{width:34px;height:34px;border:3px solid white;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:#1a73e8;box-shadow:0 3px 8px #1238;display:grid;place-items:center}.pin svg{transform:rotate(45deg)}.selected .pin{background:#f97316}.leaflet-tooltip{font-family:system-ui;font-weight:600}.leaflet-control-attribution{font-size:10px!important}.marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:#1a73e833}.marker-cluster div{background:#1a73e8;color:white;font-weight:700}.you{background:#1a73e8;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px #1a73e833}</style></head><body><div id="map" aria-label="Registered shop locations"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js" integrity="sha256-Hk4dIpcqOSb0hZjgyvFOP+cEmDXUKKNE/tT542ZbNQg=" crossorigin="anonymous"></script>
<script>
const data=${data};
function notify(payload){const message=JSON.stringify(payload);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');}
try {
 if(!window.L)throw new Error('Map could not load. Use the shop list or try again.');
 const map=L.map('map',{scrollWheelZoom:false,zoomControl:true,attributionControl:true}).setView([-17.8252,31.0335],13);
 map.zoomControl.setPosition('topright');
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}).addTo(map);
 let failures=0;tiles.on('tileerror',()=>{if(++failures===4)notify({type:'error',message:'Map tiles are unavailable. You can still choose a shop from the list.'});});
 const layer=L.markerClusterGroup?L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:42}):L.layerGroup();
 const icon=L.divIcon({className:'shop-pin',iconSize:[40,46],iconAnchor:[20,43],html:'<span class="pin"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9h18l-2-6H5L3 9zm2 1v10h14V10M9 20v-7h6v7"/></svg></span>'});
 let selected=null;
 data.shops.forEach(shop=>{
   const marker=L.marker([shop.latitude,shop.longitude],{icon,title:shop.name,alt:shop.name,keyboard:true});
   const label=document.createElement('span');label.textContent=shop.name;marker.bindTooltip(label,{direction:'top',offset:[0,-32]});
   marker.on('click',()=>{if(selected&&selected.getElement())selected.getElement().classList.remove('selected');selected=marker;if(marker.getElement())marker.getElement().classList.add('selected');notify({type:'select',id:shop.id});});
   layer.addLayer(marker);
 });layer.addTo(map);
 if(data.location){L.marker([data.location.latitude,data.location.longitude],{icon:L.divIcon({className:'you',iconSize:[14,14],iconAnchor:[10,10]}),title:'Your location'}).addTo(map);map.setView([data.location.latitude,data.location.longitude],14);}
 else if(data.shops.length){map.fitBounds(L.latLngBounds(data.shops.map(s=>[s.latitude,s.longitude])),{padding:[40,40],maxZoom:15});}
 new ResizeObserver(()=>map.invalidateSize()).observe(document.getElementById('map'));
 notify({type:'ready'});
}catch(error){notify({type:'error',message:error.message||'Map unavailable. Use the shop list.'});}
</script></body></html>`;
}

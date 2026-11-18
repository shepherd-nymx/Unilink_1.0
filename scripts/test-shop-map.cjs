const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(path,requireFn=require){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:requireFn});return module.exports}
const {validShopCoordinates,normalizeMapShops,filterMapShops}=load('lib/shop-map.ts');
for(const pair of [[null,31],['',31],[' ',31],[true,31],[91,31],[-17,181],[0,0],[NaN,31],[-17,Infinity],['abc',31]])assert.equal(validShopCoordinates(...pair),false,JSON.stringify(pair));
assert.equal(validShopCoordinates('-17.8252','31.0335'),true);assert.equal(validShopCoordinates(0,31),true);assert.equal(validShopCoordinates(-17,0),true);
const good={id:'a',name:'Town Fresh',status:'active',latitude:'-17.8252',longitude:'31.0335',category:'Grocery',address:'Harare'};
const shops=normalizeMapShops([good,{...good,id:'pending',status:'pending_approval'},{...good,id:'suspended',status:'suspended'},{...good,id:'missing',latitude:null},{...good,id:'invalid',longitude:300}]);
assert.equal(shops.length,1);assert.equal(shops[0].latitude,-17.8252);assert.equal(filterMapShops(shops,'HARARE',null).length,1);assert.equal(filterMapShops(shops,'','Electronics').length,0);assert.equal(filterMapShops(shops,'town','Grocery').length,1);
const {shopMapDocument}=load('lib/shop-map-document.ts');
const html=shopMapDocument([{...shops[0],name:'</script><script>alert(1)</script>'}],null);
assert.ok(!html.includes('"name":"</script>'));assert.ok(html.includes('textContent=shop.name'));assert.ok(html.includes('OpenStreetMap contributors'));assert.ok(html.includes('scrollWheelZoom:false'));assert.ok(!html.includes('apikey'));console.log('PASS: active/GPS eligibility, boundary/malformed coordinates, search/categories and script-safe map data.');
